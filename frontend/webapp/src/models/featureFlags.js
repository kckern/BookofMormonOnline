/** @format */
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

const MESSENGER_HOSTS = (process.env.REACT_APP_MESSENGER_HOSTS || 'staging')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

/** Runtime decision: build flag OR a hostname match. Safe outside the browser (SSR → false). */
export function isMessengerEnabled() {
  if (BUILD_FLAG) return true;
  const host = (typeof window !== 'undefined' && window.location && window.location.host) || '';
  if (!host) return false;
  const subdomain = host.split('.')[0]; // "staging", "staging-ko", "ko", "localhost:3000"
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
 * Stable per page load (hostname doesn't change), so consumers can import this constant
 * exactly where they previously wrote `process.env.REACT_APP_USE_MESSENGER === 'true'`.
 */
export const USE_MESSENGER = isMessengerEnabled();
