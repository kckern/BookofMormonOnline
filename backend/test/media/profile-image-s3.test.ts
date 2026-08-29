import { CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import {
  uploadProfileImageWithDependencies,
  type ProfileImageStorageDependencies,
} from '../../src/media/s3.js';

const HASH = '0123456789abcdef0123456789abcdef';
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function dependencies(overrides: Partial<ProfileImageStorageDependencies> = {}) {
  return {
    bucket: 'bomonline-media-assets',
    publicUrl: 'https://assets.bookofmormon.online/',
    distributionId: 'E1XB8MGKO3V6SW',
    s3: { send: vi.fn().mockResolvedValue({}) },
    cloudFront: { send: vi.fn().mockResolvedValue({}) },
    ...overrides,
  } satisfies ProfileImageStorageDependencies;
}

describe('profile-image S3 adapter', () => {
  it('resizes to a 256px JPEG, uploads under the deterministic key, and invalidates it', async () => {
    const deps = dependencies();

    const url = await uploadProfileImageWithDependencies(PNG, HASH, deps);

    expect(url).toBe(`https://assets.bookofmormon.online/profiles/${HASH}.jpg`);
    const put = vi.mocked(deps.s3.send).mock.calls[0]?.[0];
    expect(put).toBeInstanceOf(PutObjectCommand);
    expect((put as PutObjectCommand).input).toMatchObject({
      Bucket: 'bomonline-media-assets',
      Key: `profiles/${HASH}.jpg`,
      ContentType: 'image/jpeg',
      CacheControl: 'max-age=31536000',
    });
    const metadata = await sharp((put as PutObjectCommand).input.Body as Buffer).metadata();
    expect(metadata).toMatchObject({ format: 'jpeg', width: 256, height: 256 });

    const invalidation = vi.mocked(deps.cloudFront.send).mock.calls[0]?.[0];
    expect(invalidation).toBeInstanceOf(CreateInvalidationCommand);
    expect((invalidation as CreateInvalidationCommand).input).toMatchObject({
      DistributionId: 'E1XB8MGKO3V6SW',
      InvalidationBatch: { Paths: { Items: [`/profiles/${HASH}.jpg`] } },
    });
  });

  it('rejects missing storage configuration before attempting a write', async () => {
    const deps = dependencies({ bucket: undefined });

    await expect(uploadProfileImageWithDependencies(PNG, HASH, deps)).rejects.toThrow(
      'Profile image storage not configured (S3_BUCKET unset)',
    );
    expect(deps.s3.send).not.toHaveBeenCalled();
  });

  it('surfaces S3 upload errors', async () => {
    const deps = dependencies({
      s3: { send: vi.fn().mockRejectedValue(new Error('AccessDenied')) },
    });

    await expect(uploadProfileImageWithDependencies(PNG, HASH, deps)).rejects.toThrow(
      'Failed to upload image: AccessDenied',
    );
  });

  it('keeps a successful upload successful when invalidation fails', async () => {
    const deps = dependencies({
      cloudFront: { send: vi.fn().mockRejectedValue(new Error('invalidation unavailable')) },
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(uploadProfileImageWithDependencies(PNG, HASH, deps)).resolves.toBe(
      `https://assets.bookofmormon.online/profiles/${HASH}.jpg`,
    );
    expect(error).toHaveBeenCalledWith(
      '[s3] CloudFront invalidation failed (non-fatal):',
      expect.any(Error),
    );
    error.mockRestore();
  });
});
