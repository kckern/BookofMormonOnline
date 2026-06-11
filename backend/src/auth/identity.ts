/**
 * Identity helpers — port of the small utilities in legacy
 * src/resolvers/BomUser.ts (md5, cleanUsername, genUserAvatar).
 */
import { createHash } from 'node:crypto';

export function md5(value: string): string {
  if (!value) return '';
  return createHash('md5').update(value, 'utf8').digest('hex');
}

// Clients sometimes interpolate a missing token into a query as the literal
// string "null"/"undefined" (e.g. a guest whose localStorage token wasn't set
// yet). Such a token must NEVER resolve to or create a user — historically it
// collided: stale bom_user_token rows with token="null" meant any "null"-token
// request acted as those real users (a security hole + cross-user log pollution).
const JUNK_TOKENS = new Set(['', 'null', 'undefined', 'false', 'NaN', 'none']);
export function isValidToken(token: unknown): token is string {
  return typeof token === 'string' && token.length > 0 && !JUNK_TOKENS.has(token);
}

/**
 * Legacy cleanUsername (BomUser.ts:83): if an email is supplied, the stored
 * username is FORCED to the email's local-part — a real constraint (the
 * regression test user had to match this). Otherwise the raw username is
 * slugified.
 */
export function cleanUsername(username: string, email: string): string {
  const emailPrefix = email ? email.split('@')[0] : '';
  if (emailPrefix) return emailPrefix;
  let u = (username || '').toLowerCase().replace(/[^A-Za-z0-9.-]/gi, '.').replace(/[.]+/, '.');
  u = u.replace(/[([].*[)\]]/, '').trim();
  u = u.replace(/[.]+/, '.');
  return u;
}

/**
 * Dicebear avatar URL — verbatim port of legacy genUserAvatar (lib.ts:343).
 * Deterministic palette/mouth/rotation selection from a char-code sum of the
 * user_id; seed is the first 5 chars. Must match byte-for-byte (baselines pin
 * the full URL).
 */
const AVATAR_PALETTES: ReadonlyArray<readonly [string, string]> = [
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
const AVATAR_MOUTHS = ['variant1', 'variant2', 'variant3', 'variant4'];
const AVATAR_ROTATIONS = [0, 20, 340, 40, 320];
const AVATAR_EYES = 'variant6W10,variant8W14,variant2W10';

export function genUserAvatar(userId: string): string {
  const id = userId || 'user';
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const seed = id.slice(0, 5);
  const [back, fore] = AVATAR_PALETTES[hash % AVATAR_PALETTES.length]!;
  const mouth = AVATAR_MOUTHS[hash % AVATAR_MOUTHS.length]!;
  const rotation = AVATAR_ROTATIONS[hash % AVATAR_ROTATIONS.length]!;
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}&backgroundColor=${back}&shapeColor=${fore}&eyes=${AVATAR_EYES}&rotate=${rotation}&scale=70&mouth=${mouth}`;
}
