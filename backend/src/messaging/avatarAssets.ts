/**
 * messaging/avatarAssets.ts — verified avatar URLs.
 *
 * Derived profile URLs ({base}/profiles/<md5>.jpg) are a convention shared
 * with the upload path (BomUser.uploadProfileImage writes S3 by key, no DB
 * row) — so whether an image actually exists can only be known by asking the
 * asset host. This module checks existence with a 1-byte ranged GET (the CDN
 * 403s HEAD requests) and caches the answer in-process:
 *
 *   - exists   → cached 24 h (images are practically immutable; overwrites
 *                keep the same key so the URL stays valid)
 *   - missing  → cached 60 s (so a fresh upload shows up within a minute,
 *                and uploadProfileImage primes the cache to make it instant)
 *   - error    → fail open: report "exists" but only cache for 60 s; the
 *                frontend's onError fallback still covers a real 404.
 *
 * Missing assets resolve to the deterministic dicebear avatar — a straight
 * port of frontend UserAvatar.generateAvatarUrl so both ends draw the same
 * face for the same user.
 */

const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 2000;

type Fetcher = (url: string) => Promise<{ status: number }>;

type CacheEntry = { exists: boolean; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<boolean>>();

/** Test hook: clear all cached existence state. */
export function _resetAvatarCache(): void {
  cache.clear();
  inFlight.clear();
}

/** Mark a URL as existing (e.g. right after a successful S3 upload). */
export function primeAvatarAsset(url: string): void {
  cache.set(url, { exists: true, expiresAt: Date.now() + POSITIVE_TTL_MS });
}

const defaultFetcher: Fetcher = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

async function urlExists(url: string, fetcher: Fetcher): Promise<boolean> {
  const hit = cache.get(url);
  if (hit && hit.expiresAt > Date.now()) return hit.exists;

  const pending = inFlight.get(url);
  if (pending) return pending;

  const check = (async () => {
    try {
      const res = await fetcher(url);
      const exists = res.status >= 200 && res.status < 300;
      cache.set(url, {
        exists,
        expiresAt: Date.now() + (exists ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
      });
      return exists;
    } catch {
      // Asset host unreachable — fail open, retry after the negative TTL.
      cache.set(url, { exists: true, expiresAt: Date.now() + NEGATIVE_TTL_MS });
      return true;
    } finally {
      inFlight.delete(url);
    }
  })();
  inFlight.set(url, check);
  return check;
}

/**
 * Resolve a batch of derived avatar URLs to renderable URLs.
 * Returns a Map from input url → verified url (unchanged when the asset
 * exists, dicebear fallback when it doesn't).
 */
export async function resolveDerivedAvatars(
  items: Array<{ url: string; seedKey: string }>,
  fetcher: Fetcher = defaultFetcher,
): Promise<Map<string, string>> {
  const unique = new Map<string, string>(); // url → seedKey
  for (const { url, seedKey } of items) {
    if (!unique.has(url)) unique.set(url, seedKey);
  }
  const out = new Map<string, string>();
  await Promise.all(
    [...unique.entries()].map(async ([url, seedKey]) => {
      out.set(url, (await urlExists(url, fetcher)) ? url : generateAvatarUrl(seedKey));
    }),
  );
  return out;
}

/** Check a single asset URL (cached). Exposed for sign-in avatar refresh. */
export async function avatarAssetExists(url: string): Promise<boolean> {
  return urlExists(url, defaultFetcher);
}

/**
 * Policy for persisting a fresh social-provider avatar URL at sign-in.
 * Priority: explicit S3 upload / migrated assets-host mirror > provider URL.
 * Refresh only fills gaps or replaces a stale external provider URL.
 */
export function shouldRefreshStoredAvatar(args: {
  fresh: string | null | undefined;
  stored: string | null | undefined;
  s3Exists: boolean;
}): boolean {
  const { fresh, stored, s3Exists } = args;
  if (!fresh) return false;
  if (s3Exists) return false;
  if (stored) {
    try {
      if (new URL(stored).host.endsWith('bookofmormon.online')) return false;
    } catch {
      // unparseable stored value — treat as replaceable
    }
  }
  return true;
}

/**
 * Deterministic dicebear avatar — port of frontend
 * components/UserAvatar.js generateAvatarUrl. Keep the two in sync.
 */
export function generateAvatarUrl(userId: string): string {
  const pallettes: Array<[string, string]> = [
    ['FF86F1', 'FF00CC'], ['00FFFF', '000080'], ['99FFCC', '009933'],
    ['FF6699', '990033'], ['33CCFF', '003366'], ['00FF80', '004D40'],
    ['FF9933', '6B4423'], ['FF99FF', '993399'], ['99CCFF', '003399'],
    ['00CC99', '006633'], ['FF9999', '800000'], ['FFFF99', '808000'],
    ['99FF99', '006400'], ['FFCC99', '8B4513'], ['CCCCFF', '000099'],
    ['CC99FF', '660099'], ['FF66CC', '660033'], ['CCFFFF', '006666'],
    ['FF9966', '663300'], ['66CCFF', '002266'], ['99CC66', '435D36'],
    ['66FF66', '003300'], ['FFFF66', '878700'], ['FF9999', '942121'],
    ['FFCCCC', '853333'], ['99CC99', '385438'], ['CCCC99', '545400'],
    ['CCFFCC', '004700'], ['FFCC99', '6B3600'], ['CCFF99', '3B5900'],
    ['FFFFCC', '878600'], ['FF9966', '803000'], ['CCFF66', '315000'],
  ];
  const mouths = ['variant1', 'variant2', 'variant3', 'variant4'];
  const rotations = [0, 20, 340, 40, 320];
  const eyes = 'variant6W10,variant8W14,variant2W10';

  const id = userId || 'user';
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const seed = id.slice(0, 5);
  const pallette = pallettes[hash % pallettes.length] as [string, string];
  const [back, fore] = pallette;
  const mouth = mouths[hash % mouths.length];
  const rotation = rotations[hash % rotations.length];

  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}&backgroundColor=${back}&shapeColor=${fore}&eyes=${eyes}&rotate=${rotation}&scale=70&mouth=${mouth}`;
}
