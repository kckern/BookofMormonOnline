/**
 * media/s3.ts — profile-image storage (port of legacy src/library/s3.ts).
 *
 * Resizes an uploaded image to a 256×256 JPEG and PUTs it to S3 under the key
 * from media/profileImage.ts (`profiles/<md5(username)>.jpg`, the same key the
 * read side derives; dicebear fallback on 404). Best-effort CloudFront
 * invalidation when a distribution id is configured.
 *
 * Credentials come from the standard AWS provider chain (env / instance role).
 * Env: S3_BUCKET (required), S3_PUBLIC_URL (default assets.bookofmormon.online),
 *      CLOUDFRONT_DISTRIBUTION_ID (optional).
 *
 * NB: callers gate on ctx.sandbox BEFORE invoking this — sandbox must not touch S3.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { profileImageKey } from './profileImage.js';

interface CommandSender<TCommand> {
  send(command: TCommand): Promise<unknown>;
}

export interface ProfileImageStorageDependencies {
  bucket?: string;
  publicUrl: string;
  distributionId?: string;
  s3: CommandSender<PutObjectCommand>;
  cloudFront: CommandSender<CreateInvalidationCommand>;
}

const runtimeDependencies: ProfileImageStorageDependencies = {
  bucket: env.S3_BUCKET,
  publicUrl: env.S3_PUBLIC_URL.replace(/\/+$/, ''),
  distributionId: env.CLOUDFRONT_DISTRIBUTION_ID,
  s3: new S3Client({ region: env.AWS_REGION }),
  cloudFront: new CloudFrontClient({ region: env.AWS_REGION }),
};

/**
 * Upload a base64 image as the user's profile avatar. Returns the public URL,
 * version-busted with the upload timestamp (`…/profiles/<hash>.jpg?v=<ms>`).
 *
 * The key is stable and overwritten in place, so the bare URL is a mutable
 * resource: a client that has already loaded the previous photo keeps serving
 * it from its own cache, and a CloudFront invalidation cannot reach that.
 * Callers persist the returned URL so every consumer fetches a key it has
 * never seen. See docs/bugs/2026-09-01-profile-photo-reverts.md.
 *
 * Throws on misconfiguration, invalid input, processing failure, or S3 failure.
 */
export async function uploadProfileImage(base64Data: string, userHash: string): Promise<string> {
  return uploadProfileImageWithDependencies(base64Data, userHash, runtimeDependencies);
}

/** Test seam for the storage adapter; production callers use uploadProfileImage. */
export async function uploadProfileImageWithDependencies(
  base64Data: string,
  userHash: string,
  dependencies: ProfileImageStorageDependencies,
): Promise<string> {
  const bucket = dependencies.bucket;
  if (!bucket) {
    throw new Error('Profile image storage not configured (S3_BUCKET unset)');
  }
  if (!base64Data || base64Data.trim() === '') {
    throw new Error('Image data is required');
  }
  if (!userHash || !/^[a-f0-9]{32}$/i.test(userHash)) {
    throw new Error('Invalid user hash format');
  }

  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Clean, 'base64');
  const startedAt = Date.now();

  console.info('[profile-image] upload start', {
    hash: userHash,
    inputBytes: imageBuffer.length,
  });

  let processedImage: Buffer;
  try {
    processedImage = await sharp(imageBuffer)
      .resize(256, 256, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new Error('Could not process image data');
  }

  const key = profileImageKey(userHash);

  try {
    await dependencies.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: processedImage,
        ContentType: 'image/jpeg',
        // Short and revalidating: this key is mutable (a re-upload overwrites
        // it), so a year-long lifetime made stale avatars effectively
        // permanent for anyone who had already loaded one. Fresh reads are
        // guaranteed by the ?v= version on the returned URL; this bound just
        // keeps the bare URL (frontend fallback path) from going stale.
        CacheControl: 'public, max-age=300',
      }),
    );
  } catch (error) {
    throw new Error(
      `Failed to upload image: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Best-effort CDN invalidation — the upload already succeeded.
  const distributionId = dependencies.distributionId;
  let invalidated = false;
  if (distributionId) {
    try {
      await dependencies.cloudFront.send(
        new CreateInvalidationCommand({
          DistributionId: distributionId,
          InvalidationBatch: {
            CallerReference: `profile-${userHash}-${Date.now()}`,
            Paths: { Quantity: 1, Items: [`/${key}`] },
          },
        }),
      );
      invalidated = true;
    } catch (err) {
      console.error('[s3] CloudFront invalidation failed (non-fatal):', err);
    }
  }

  console.info('[profile-image] upload success', {
    hash: userHash,
    key,
    outputBytes: processedImage.length,
    durationMs: Date.now() - startedAt,
    invalidated,
  });

  return `${dependencies.publicUrl.replace(/\/+$/, '')}/${key}?v=${startedAt}`;
}
