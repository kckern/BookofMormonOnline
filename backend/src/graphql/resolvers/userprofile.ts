/**
 * userprofile mutations — editProfile, changePassword, uploadProfileImage.
 * See docs/reference/backend-mutation-porting-guide.md.
 *
 * Ownership: this file and backend/src/data/loaders/userprofile.ts only.
 * User type field resolvers (social, progress, history, etc.) are owned by userauth.
 */
import { GraphQLError } from 'graphql';
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { hashPassword, verifyPassword, needsRehash } from '../../auth/password.js';
import { md5 } from '../../auth/identity.js';
import { runWrite } from '../../data/writes.js';
import { getUserByToken } from '../../data/loaders/userprofile.js';
import { uploadProfileImage as uploadProfileImageToS3 } from '../../media/s3.js';
import { primeAvatarAsset } from '../../messaging/avatarAssets.js';
import { PROFILE_IMAGE_BASE, claimUploadedProfileUrl } from '../../messaging/users.js';

export const userprofileResolvers: Resolvers = {
  Mutation: {
    /**
     * editProfile — update name/email/zip by token; return User.
     *
     * Legacy (BomUser.ts:478): finds user via token join, strips token from
     * update values, updates bom_user, then returns the merged user object.
     * Returns null when token is missing or invalid.
     *
     * The returned object has the plain column values that graphql-js default
     * resolvers will pick up for the User type scalars (user/name/email/zip).
     * userauth owns the non-trivial User field resolvers (social, progress, etc.)
     * which are not selected by the frontend's editProfile query.
     */
    editProfile: async (_root, args, ctx: AppContext) => {
      // Legacy: `if (!args.token) return false` → Apollo rendered this as `editProfile: {}`
      // (false for a User type resolves as an empty object, which survives null-stripping).
      // Replicate by returning an empty object rather than null.
      if (!args.token) return {} as unknown as never;

      const userRow = await getUserByToken(ctx.db, args.token);
      // Legacy: `if (!myUser?.user) return null` → null-stripped → `data: {}`
      if (!userRow) return null as unknown as never;

      // Build update object — only include provided fields (legacy strips token only)
      const updates: Record<string, string> = {};
      if (args.name != null) updates.name = args.name;
      if (args.email != null) updates.email = args.email;
      if (args.zip != null) updates.zip = args.zip;

      if (Object.keys(updates).length > 0) {
        await runWrite(
          ctx,
          ctx.db.updateTable('bom_user').set(updates).where('user', '=', userRow.user),
        );
      }

      // Return merged row — sandbox suppresses the write but response shape is correct
      return { ...userRow, ...updates } as unknown as never;
    },

    /**
     * changePassword — bcrypt-hash new pass; reject if same as current bcrypt; return Boolean.
     *
     * Legacy (BomUser.ts:523): finds user+pass via token join, hashes new password,
     * compares against existing bcrypt hash (skip comparison for legacy MD5), updates row.
     * Returns false when token/password missing or when new password equals current.
     * Returns true when update affects 1 row (legacy: result.shift() === 1).
     *
     * Under sandbox: write is suppressed → we return true to show a well-formed response.
     * A human validates persistence on a non-sandbox run.
     */
    changePassword: async (_root, args, ctx: AppContext) => {
      if (!args.password) return false;
      if (!args.token) return false;

      const userRow = await getUserByToken(ctx.db, args.token);
      if (!userRow) return false;

      const currentHash = userRow.pass;

      // If current hash is bcrypt (not legacy MD5), reject if same password
      if (currentHash && !needsRehash(currentHash)) {
        const isSame = await verifyPassword(args.password, currentHash);
        if (isSame) return false;
      }

      const newHash = await hashPassword(args.password);

      const result = await runWrite(
        ctx,
        ctx.db.updateTable('bom_user').set({ pass: newHash }).where('user', '=', userRow.user),
      );

      // Under sandbox the write is suppressed; return true (well-formed response)
      if (!result.executed) return true;

      // On a real run: Kysely UpdateResult rows contain the result object
      const firstResult = result.rows[0] as { numAffectedRows?: bigint } | undefined;
      if (firstResult?.numAffectedRows !== undefined) {
        return firstResult.numAffectedRows === 1n;
      }
      // Fallback: rows came back → success
      return result.rows.length > 0;
    },

    /**
     * uploadProfileImage — validate token + store avatar; return Boolean.
     *
     * Legacy (BomUser.ts:506): looks up user by token, computes md5(user.user) as
     * the avatar key, calls uploadProfileImage(imageData, userHash) which:
     *   1. Validates the base64 image data
     *   2. Resizes to 256×256 JPEG via sharp
     *   3. Puts to S3 at profiles/<hash>.jpg  (S3_BUCKET env required)
     *   4. Optionally invalidates CLOUDFRONT_DISTRIBUTION_ID path
     *   Returns the version-busted CDN URL, which we persist as the user's
     *   messenger_users.profile_url before returning Boolean true.
     *
     * The real image sink (src/library/s3.ts) requires AWS credentials + sharp.
     * To activate in the green-field backend, port src/library/s3.ts into
     * backend/src/library/s3.ts and import it here. Under SANDBOX we skip the write
     * and return true to match the response shape.
     *
     * Legacy throws AuthenticationError on invalid token; we replicate that shape
     * (maskedErrors:false → the message "Invalid token" is contract).
     */
    uploadProfileImage: async (_root, args, ctx: AppContext) => {
      const { token, imageData } = args;

      // P-4 size guard: reject oversized payloads before allocating a decode buffer.
      // A base64 string's byte-length approximates (len * 3/4); we cap the raw
      // string at ~6.8 MB which decodes to ≤5 MB of image data.
      const MAX_BASE64_LEN = 5 * 1024 * 1024; // ~3.75 MB decoded — generous for a 256² avatar
      if (typeof imageData === 'string' && imageData.length > MAX_BASE64_LEN) {
        throw new GraphQLError('Image too large (max ~3.75 MB decoded)', {
          extensions: { code: 'PAYLOAD_TOO_LARGE' },
        });
      }

      const userRow = await getUserByToken(ctx.db, token);
      if (!userRow) {
        // Replicate legacy AuthenticationError shape: message + extensions.code = 'UNAUTHORIZED'
        // Legacy used apollo-server's AuthenticationError which added the extension automatically.
        throw new GraphQLError('Invalid token', {
          extensions: { code: 'UNAUTHORIZED' },
        });
      }

      // Compute avatar key (mirrors legacy: md5(user.user))
      const userHash = md5(userRow.user);

      if (ctx.sandbox) {
        // Sandbox must not touch S3 — log intent and return the success shape.
        // eslint-disable-next-line no-console
        console.log(`[sandbox] uploadProfileImage: user=${userRow.user} hash=${userHash} (S3 write suppressed)`);
        return true;
      }

      // Real upload: sharp resize 256² JPEG → S3 profiles/<hash>.jpg (+ CDN invalidation).
      try {
        const uploadedUrl = await uploadProfileImageToS3(imageData, userHash);
        // The existence cache may hold a negative entry from before the
        // upload — mark the conventional URL as live so the avatar shows
        // immediately instead of after the negative TTL.
        primeAvatarAsset(`${PROFILE_IMAGE_BASE}/profiles/${userHash}.jpg`);
        // Writing S3 alone is NOT enough: the read path prefers a stored
        // messenger_users.profile_url over the derived key, so users carrying
        // a migrated gravatar/provider avatar saw the upload succeed and then
        // "revert" on reload. Claim the row (with the version-busted URL, so
        // caches can't serve the previous photo).
        // docs/bugs/2026-09-01-profile-photo-reverts.md
        try {
          await runWrite(
            ctx,
            claimUploadedProfileUrl(ctx.db, {
              userId: userHash,
              profileUrl: uploadedUrl,
            }) as Parameters<typeof runWrite>[1],
          );
        } catch (err) {
          // The object IS stored; only the pointer write failed. Report failure
          // rather than a false success — the user would otherwise see the old
          // photo come back — but keep the DB error out of the response.
          console.error('[profile-image] claim failed after upload', {
            hash: userHash,
            error: err instanceof Error ? err.message : String(err),
          });
          throw new GraphQLError('Profile image upload failed', {
            extensions: { code: 'PROFILE_IMAGE_UPLOAD_FAILED' },
          });
        }
        return true;
      } catch (err) {
        throw new GraphQLError(err instanceof Error ? err.message : 'Profile image upload failed', {
          extensions: { code: 'PROFILE_IMAGE_UPLOAD_FAILED' },
        });
      }
    },
  },
};
