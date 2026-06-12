/**
 * Unit tests for avatar asset verification (no network — fetcher injected).
 *
 * Derived profile URLs (profiles/<md5>.jpg) are a convention, not a fact —
 * many migrated users have no image behind theirs. The backend must not emit
 * URLs it hasn't verified; missing assets resolve to the deterministic
 * dicebear avatar (same generator the frontend uses), so every consumer gets
 * a renderable URL.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveDerivedAvatars,
  generateAvatarUrl,
  primeAvatarAsset,
  shouldRefreshStoredAvatar,
  _resetAvatarCache,
} from '../../src/messaging/avatarAssets.js';

const URL_OK = 'https://assets.example.com/profiles/aaaa.jpg';
const URL_MISSING = 'https://assets.example.com/profiles/bbbb.jpg';

const fetcherFor = (codes: Record<string, number>) =>
  vi.fn(async (url: string) => ({ status: codes[url] ?? 404 }));

beforeEach(() => _resetAvatarCache());

describe('resolveDerivedAvatars', () => {
  it('keeps URLs whose asset exists; swaps missing ones to dicebear', async () => {
    const fetcher = fetcherFor({ [URL_OK]: 206, [URL_MISSING]: 404 });
    const out = await resolveDerivedAvatars(
      [
        { url: URL_OK, seedKey: 'aaaa' },
        { url: URL_MISSING, seedKey: 'bbbb' },
      ],
      fetcher,
    );
    expect(out.get(URL_OK)).toBe(URL_OK);
    expect(out.get(URL_MISSING)).toBe(generateAvatarUrl('bbbb'));
  });

  it('caches results — second resolve does not re-fetch', async () => {
    const fetcher = fetcherFor({ [URL_OK]: 200 });
    await resolveDerivedAvatars([{ url: URL_OK, seedKey: 'aaaa' }], fetcher);
    await resolveDerivedAvatars([{ url: URL_OK, seedKey: 'aaaa' }], fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fails open on fetch errors (keeps the URL; frontend onError still covers it)', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network down');
    });
    const out = await resolveDerivedAvatars([{ url: URL_OK, seedKey: 'aaaa' }], fetcher);
    expect(out.get(URL_OK)).toBe(URL_OK);
  });

  it('primeAvatarAsset marks a URL as existing without fetching (upload path)', async () => {
    const fetcher = fetcherFor({}); // would 404 everything
    primeAvatarAsset(URL_MISSING);
    const out = await resolveDerivedAvatars([{ url: URL_MISSING, seedKey: 'bbbb' }], fetcher);
    expect(out.get(URL_MISSING)).toBe(URL_MISSING);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent checks for the same URL', async () => {
    const fetcher = fetcherFor({ [URL_OK]: 206 });
    await resolveDerivedAvatars(
      [
        { url: URL_OK, seedKey: 'aaaa' },
        { url: URL_OK, seedKey: 'aaaa' },
      ],
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('shouldRefreshStoredAvatar', () => {
  const ASSETS = 'https://assets.bookofmormon.online/profiles/feedfacefeedfacefeedfacefeedface.jpg';
  const GOOGLE = 'https://lh3.googleusercontent.com/a/fresh';

  it('refreshes when nothing is stored and no S3 asset exists', () => {
    expect(shouldRefreshStoredAvatar({ fresh: GOOGLE, stored: null, s3Exists: false })).toBe(true);
    expect(shouldRefreshStoredAvatar({ fresh: GOOGLE, stored: '', s3Exists: false })).toBe(true);
  });

  it('refreshes a stale external provider URL', () => {
    expect(
      shouldRefreshStoredAvatar({
        fresh: GOOGLE,
        stored: 'https://lh3.googleusercontent.com/a/old',
        s3Exists: false,
      }),
    ).toBe(true);
  });

  it('never overwrites the migrated assets-host mirror', () => {
    expect(shouldRefreshStoredAvatar({ fresh: GOOGLE, stored: ASSETS, s3Exists: false })).toBe(false);
  });

  it('never shadows an explicit S3 upload (conventional asset exists)', () => {
    expect(shouldRefreshStoredAvatar({ fresh: GOOGLE, stored: null, s3Exists: true })).toBe(false);
  });

  it('does nothing without a fresh URL', () => {
    expect(shouldRefreshStoredAvatar({ fresh: '', stored: null, s3Exists: false })).toBe(false);
  });
});

describe('generateAvatarUrl', () => {
  it('is deterministic and mirrors the frontend generator shape', () => {
    const url = generateAvatarUrl('feedfacefeedfacefeedfacefeedface');
    expect(url).toBe(generateAvatarUrl('feedfacefeedfacefeedfacefeedface'));
    expect(url).toMatch(/^https:\/\/api\.dicebear\.com\/7\.x\/thumbs\/svg\?seed=feedf&/);
    expect(url).toContain('scale=70');
  });
});
