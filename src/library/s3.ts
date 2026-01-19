import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import sharp from 'sharp';

// Use AWS SDK default credential chain - will use env vars, IAM role, etc.
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-2',
});

const cloudFrontClient = new CloudFrontClient({
  region: process.env.AWS_REGION || 'us-west-2',
});

const S3_BUCKET = process.env.S3_BUCKET || 'bomonline-media-assets';
const CLOUDFRONT_DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID || '';

/**
 * Process and upload a profile image to S3
 * @param base64Data - Base64 encoded image data (with or without data URL prefix)
 * @param userHash - MD5 hash of username for the file path
 * @returns The public URL of the uploaded image
 */
export async function uploadProfileImage(base64Data: string, userHash: string): Promise<string> {
  // Input validation
  if (!base64Data || base64Data.trim() === '') {
    throw new Error('Image data is required');
  }
  if (!userHash || !/^[a-f0-9]{32}$/i.test(userHash)) {
    throw new Error('Invalid user hash format');
  }

  // Strip data URL prefix if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');

  let imageBuffer: Buffer;
  try {
    imageBuffer = Buffer.from(base64Clean, 'base64');
  } catch (error) {
    throw new Error('Invalid base64 image data');
  }

  // Resize to 256x256 and convert to JPEG
  let processedImage: Buffer;
  try {
    processedImage = await sharp(imageBuffer)
      .resize(256, 256, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (error) {
    console.error('Image processing failed:', error);
    throw new Error('Failed to process image');
  }

  const key = `profiles/${userHash}.jpg`;

  // Upload to S3
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: processedImage,
      ContentType: 'image/jpeg',
      CacheControl: 'max-age=31536000', // 1 year cache
    }));
  } catch (error) {
    console.error('S3 upload failed:', error);
    throw new Error('Failed to upload image to storage');
  }

  // Invalidate CloudFront cache (don't fail upload if this fails)
  if (CLOUDFRONT_DISTRIBUTION_ID) {
    try {
      await cloudFrontClient.send(new CreateInvalidationCommand({
        DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
        InvalidationBatch: {
          CallerReference: `profile-${userHash}-${Date.now()}`,
          Paths: {
            Quantity: 1,
            Items: [`/${key}`],
          },
        },
      }));
    } catch (error) {
      console.error('CloudFront invalidation failed:', error);
      // Don't throw - image was uploaded successfully
    }
  }

  return `https://assets.bookofmormon.online/${key}`;
}

/**
 * Generate the profile image URL for a user hash
 * @param userHash - MD5 hash of username
 * @returns The expected profile image URL
 */
export function getProfileImageUrl(userHash: string): string {
  return `https://assets.bookofmormon.online/profiles/${userHash}.jpg`;
}
