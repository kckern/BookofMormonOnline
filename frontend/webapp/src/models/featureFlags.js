/** @format */
import features from '../config/features.generated.json';
/**
 * Feature flags — single source of truth.
 *
 * Messaging / study-group chat (the green-field messaging platform) is gated so a
 * SINGLE production build can serve it ON for a staging subdomain and OFF for prod,
 * decided at RUNTIME from the hostname (CRA bakes process.env.REACT_APP_* at build
 * time, so an env-only flag can't differ per subdomain from one deploy).
 *
 * Messaging is enabled when EITHER:
 *   1. the build flag REACT_APP_USE_MESSENGER === 'true' (force-on: local dev / a
 *      dedicated messaging build), OR
 *   2. the current hostname's first subdomain segment matches one of the messaging hosts
 *      (default `staging`) — exactly OR as a `<host>-<lang>` prefix, so both
 *      `staging.bookofmormon.online` AND `staging-ko.bookofmormon.online` /
 *      `staging-{lang}.*` are covered. Override the host list with
 *      REACT_APP_MESSENGER_HOSTS (comma-separated, e.g. "staging,beta").
 *
 * So: deploy one build, point any `staging` / `staging-{lang}` subdomain at it, and
 * messaging is live there while the apex/prod domain stays off — no separate build.
 */

const BUILD_FLAG = process.env.REACT_APP_USE_MESSENGER === 'true';

// Default-enabled hosts. 'staging' covers staging.* + staging-{lang}.*; 'bom' covers the
// dev URL (bom.kckern.net) during the green-field cutover; 'localhost' covers local dev.
// Prod apex (bookofmormon.online → subdomain 'bookofmormon') still does NOT match.
const MESSENGER_HOSTS = (process.env.REACT_APP_MESSENGER_HOSTS || 'staging,bom,localhost')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

// Loopback and RFC1918 private-network hosts — always-on so LAN access to a
// dev box (e.g. http://10.0.0.x:8200) gets the full feature set without
// needing a hostname or build-flag override.
const PRIVATE_HOST = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$)/;

/** Exact, deliberately unlinked production entry point for the messenger beta. */
export function isUnlistedMessengerPath() {
  const path = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
  return path === '/home/feed' || path.startsWith('/home/feed/');
}

/** Runtime decision: build flag OR a hostname match. Safe outside the browser (SSR → false). */
export function isMessengerEnabled() {
  if (BUILD_FLAG) return true;
  if (isUnlistedMessengerPath()) return true;
  const rawHost = (typeof window !== 'undefined' && window.location && window.location.host) || '';
  if (!rawHost) return false;
  const host = rawHost.startsWith('[')
    ? rawHost.slice(1, rawHost.indexOf(']')) // bracketed IPv6: '[::1]:8200' → '::1'
    : rawHost.split(':')[0]; // strip port so 'localhost:8200' → 'localhost'
  if (PRIVATE_HOST.test(host)) return true;
  const subdomain = host.split('.')[0]; // "staging", "staging-ko", "bom", "localhost"
  return MESSENGER_HOSTS.some(
    (h) =>
      // bare subdomain entry ('staging'): exact, or a language-prefixed variant ('staging-ko')
      subdomain === h ||
      subdomain.startsWith(`${h}-`) ||
      // full-host entry (e.g. 'messaging.bookofmormon.online'): exact or as a prefix
      host === h ||
      host.startsWith(`${h}.`),
  );
}

/**
 * The path-only production beta may run the messenger runtime, but must not
 * advertise messenger destinations in global navigation. Staging/dev and a
 * force-enabled build retain the normal navigation.
 */
export function isMessengerNavigationEnabled() {
  return isMessengerEnabled() && !isUnlistedMessengerPath();
}

/**
 * Stable per page load (hostname doesn't change), so consumers can import this constant
 * exactly where they previously wrote `process.env.REACT_APP_USE_MESSENGER === 'true'`.
 */
export const USE_MESSENGER = isMessengerEnabled();

/**
 * Cutover flags — honored in PRODUCTION BUILDS ONLY. In dev (`npm start`) and
 * Jest, NODE_ENV !== 'production', so these are always false and nothing is
 * hidden. A single prod build serves both staging and prod, so staging also
 * applies them (accepted). Source of truth: config/features.yml.
 */
const IS_PROD = process.env.NODE_ENV === 'production';

export const HIDE_HOME_NAV      = IS_PROD && !!features.homeNav?.hidden;
export const HIDE_MATTERS_NAV   = IS_PROD && !!features.mattersNav?.hidden;
export const HIDE_HISTORY_NAV   = IS_PROD && !!features.historyNav?.hidden;
export const HIDE_PASSAGE_NOTES = IS_PROD && !!features.passageNotes?.hidden;
