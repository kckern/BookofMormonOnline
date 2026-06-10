/**
 * media/s3.ts — profile-image storage (port of legacy src/library/s3.ts).
 *
 * Resizes an uploaded image to a 256×256 JPEG and PUTs it to S3 at
 * `profiles/<md5(username)>.jpg` — the same key the frontend derives avatars from
 * ({S3_PUBLIC_URL}/profiles/<hash>.jpg, dicebear fallback on 404). Best-effort
 * CloudFront invalidation when a distribution id is configured.
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

const s3Client = new S3Client({});
const cloudFrontClient = new CloudFrontClient({});

const PROFILE_IMAGE_BASE_URL = (
  process.env['S3_PUBLIC_URL'] || 'https://assets.bookofmormon.online'
).replace(/\/+$/, '');

/** Derived public URL for a user's avatar (matches the frontend convention). */
export function getProfileImageUrl(userHash: string): string {
  return `${PROFILE_IMAGE_BASE_URL}/profiles/${userHash}.jpg`;
}

/**
 * Upload a base64 image as the user's profile avatar. Returns the public URL.
 * Throws on misconfiguration, invalid input, processing failure, or S3 failure.
 */
export async function uploadProfileImage(base64Data: string, userHash: string): Promise<string> {
  const bucket = process.env['S3_BUCKET'];
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

  let processedImage: Buffer;
  try {
    processedImage = await sharp(imageBuffer)
      .resize(256, 256, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new Error('Could not process image data');
  }

  const key = `profiles/${userHash}.jpg`;

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: processedImage,
        ContentType: 'image/jpeg',
        CacheControl: 'max-age=31536000',
      }),
    );
  } catch (error) {
    throw new Error(
      `Failed to upload image: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Best-effort CDN invalidation — the upload already succeeded.
  const distributionId = process.env['CLOUDFRONT_DISTRIBUTION_ID'];
  if (distributionId) {
    try {
      await cloudFrontClient.send(
        new CreateInvalidationCommand({
          DistributionId: distributionId,
          InvalidationBatch: {
            CallerReference: `profile-${userHash}-${Date.now()}`,
            Paths: { Quantity: 1, Items: [`/${key}`] },
          },
        }),
      );
    } catch (err) {
      console.error('[s3] CloudFront invalidation failed (non-fatal):', err);
    }
  }

  return `${PROFILE_IMAGE_BASE_URL}/${key}`;
}
