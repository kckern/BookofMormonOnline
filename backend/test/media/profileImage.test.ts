/**
 * test/media/profileImage.test.ts
 *
 * Invariant I4 (docs/plans/2026-09-01-identity-avatar-consolidation.md):
 * exactly one module knows that a profile image lives at
 * `{S3_PUBLIC_URL}/profiles/<user_id>.jpg`. Upload, read-side derivation,
 * the existence-cache priming and the data migrations all build the key
 * through these helpers.
 */
import { describe, expect, it } from 'vitest';
import { PROFILE_IMAGE_BASE, profileImageKey, profileImageUrl } from '../../src/media/profileImage.js';

const ID = '9b4291984af9d3c3baaae5af3ece9962';

describe('profileImage', () => {
  it('base comes from S3_PUBLIC_URL with no trailing slash', () => {
    expect(PROFILE_IMAGE_BASE).toMatch(/^https?:\/\/[^/]+(\/[^/]+)*$/);
    expect(PROFILE_IMAGE_BASE.endsWith('/')).toBe(false);
  });

  it('key is profiles/<id>.jpg', () => {
    expect(profileImageKey(ID)).toBe(`profiles/${ID}.jpg`);
  });

  it('url is base + key', () => {
    expect(profileImageUrl(ID)).toBe(`${PROFILE_IMAGE_BASE}/profiles/${ID}.jpg`);
  });

  it('url carries a ?v= version when one is given (cache-busting for re-uploads)', () => {
    expect(profileImageUrl(ID, 1756742000000)).toBe(`${PROFILE_IMAGE_BASE}/profiles/${ID}.jpg?v=1756742000000`);
  });

  it('a zero/undefined version yields the bare url', () => {
    expect(profileImageUrl(ID, 0)).toBe(profileImageUrl(ID));
    expect(profileImageUrl(ID, undefined)).toBe(profileImageUrl(ID));
  });
});
