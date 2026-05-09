import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import sharp from 'sharp';
import { AppError, ErrorCode, ValidationError } from './errors';

const s3Client = new S3Client({});
const cloudFrontClient = new CloudFrontClient({});

export async function uploadProfileImage(base64Data: string, userHash: string): Promise<string> {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, 'Profile image storage not configured', 500);
  }

  if (!base64Data || base64Data.trim() === '') {
    throw new ValidationError('Image data is required');
  }
  if (!userHash || !/^[a-f0-9]{32}$/i.test(userHash)) {
    throw new ValidationError('Invalid user hash format');
  }

  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Clean, 'base64');

  let processedImage: Buffer;
  try {
    processedImage = await sharp(imageBuffer)
      .resize(256, 256, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (error) {
    throw new ValidationError('Could not process image data');
  }

  const key = `profiles/${userHash}.jpg`;

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: processedImage,
      ContentType: 'image/jpeg',
      CacheControl: 'max-age=31536000',
    }));
  } catch (error) {
    throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Failed to upload image', 502, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
  if (distributionId) {
    try {
      await cloudFrontClient.send(new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: `profile-${userHash}-${Date.now()}`,
          Paths: { Quantity: 1, Items: [`/${key}`] },
        },
      }));
    } catch (error) {
      // Upload already succeeded — invalidation is best-effort.
      console.error('CDN invalidation failed:', error);
    }
  }

  return `https://assets.bookofmormon.online/${key}`;
}

export function getProfileImageUrl(userHash: string): string {
  return `https://assets.bookofmormon.online/profiles/${userHash}.jpg`;
}
