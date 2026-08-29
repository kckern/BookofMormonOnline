import { describe, expect, it } from 'vitest';
import { envSchema } from '../../src/config/env.js';

const required = {
  MYSQL_HOST: 'db',
  MYSQL_USER: 'user',
  MYSQL_PASSWORD: 'pass',
};

describe('profile-image environment', () => {
  it('rejects a real-write environment without S3_BUCKET', () => {
    const result = envSchema.safeParse({ ...required, SANDBOX: '0' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['S3_BUCKET'],
          message: 'S3_BUCKET is required when SANDBOX=0',
        }),
      );
    }
  });

  it('accepts sandbox without storage and defaults the AWS region', () => {
    const result = envSchema.parse({ ...required, SANDBOX: '1' });

    expect(result.S3_BUCKET).toBeUndefined();
    expect(result.AWS_REGION).toBe('us-west-2');
  });

  it('accepts the production profile-image configuration', () => {
    const result = envSchema.parse({
      ...required,
      SANDBOX: '0',
      S3_BUCKET: 'bomonline-media-assets',
      S3_PUBLIC_URL: 'https://assets.bookofmormon.online',
      CLOUDFRONT_DISTRIBUTION_ID: 'E1XB8MGKO3V6SW',
      AWS_REGION: 'us-west-2',
    });

    expect(result.S3_BUCKET).toBe('bomonline-media-assets');
    expect(result.S3_PUBLIC_URL).toBe('https://assets.bookofmormon.online');
  });
});
