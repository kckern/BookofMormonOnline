/**
 * media/profileImage.ts — the ONE place that knows where a profile image lives.
 *
 * `{S3_PUBLIC_URL}/profiles/<user_id>.jpg`, where user_id is the messenger id
 * (md5 of the bom_user username — invariant I1). Upload (media/s3.ts), the
 * read-side derivation (messaging/users.ts), existence-cache priming and the
 * data migrations all go through these helpers; nothing else may spell the
 * key out (invariant I4, docs/plans/2026-09-01-identity-avatar-consolidation.md).
 *
 * `S3_PUBLIC_URL` is the single knob. The frontend's
 * REACT_APP_PROFILE_IMAGE_BASE_URL must match it.
 */
import { env } from '../config/env.js';

export const PROFILE_IMAGE_BASE = env.S3_PUBLIC_URL.replace(/\/+$/, '');

export const profileImageKey = (userId: string): string => `profiles/${userId}.jpg`;

/**
 * Public URL for a user's avatar. Pass the upload timestamp as `version` for
 * the URL that gets persisted — the key is stable and overwritten in place,
 * so a re-upload needs a URL clients have never cached.
 */
export const profileImageUrl = (userId: string, version?: number): string =>
  `${PROFILE_IMAGE_BASE}/${profileImageKey(userId)}${version ? `?v=${version}` : ''}`;
