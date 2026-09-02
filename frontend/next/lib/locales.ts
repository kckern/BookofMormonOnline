// Single source of truth for language path prefixes (the site is multilingual by
// subdomain; for bots the language also appears as a leading path segment).
// LANG_PREFIXES excludes 'en' (the default); LOCALE_SEGS includes it, for
// stripping a leading /{lang}/ segment.
export const LANG_PREFIXES = ['ko', 'fr', 'de', 'es', 'pt', 'ja', 'zh']
export const LOCALE_SEGS = new Set(['en', ...LANG_PREFIXES])

// Host → backend INTERNAL language code (GraphQL endpoint, labels, og lang).
// Verbatim from the CRA LanguageSelect (webapp Sidebar.js). NOTE: 'slv' and 'tr'
// are NOT in the backend SUPPORTED_LANGUAGES and silently clamp to English —
// documented pre-existing gap, out of scope.
export const HOST_LANG: Record<string, string> = {
  'bookofmormon.online': 'en',
  '몰몬경.kr': 'ko',
  'xn--289a67xla.kr': 'ko',
  'libromormon.es': 'es',
  'livredemormon.fr': 'fr',
  'buchmormon.de': 'de',
  'swe.bookofmormon.online': 'swe',
  'sachmacmon.vn': 'vn',
  'xn--80aahtjpadfibw.net': 'ru',
  'mormonovaknjiga.si': 'slv',
  'tr.bookofmormon.online': 'tr',
  'tgl.bookofmormon.online': 'tgl',
}

// Backend-SUPPORTED languages → canonical host, for hreflang alternates. Excludes
// slv/tr (NOT in backend SUPPORTED_LANGUAGES — advertising them would mislabel
// English content as Slovenian/Turkish). ko/ru use the punycode host so the tag
// points at a stable ASCII origin.
export const LANG_HOST: Record<string, string> = {
  en: 'bookofmormon.online',
  ko: 'xn--289a67xla.kr',
  es: 'libromormon.es',
  fr: 'livredemormon.fr',
  de: 'buchmormon.de',
  swe: 'swe.bookofmormon.online',
  vn: 'sachmacmon.vn',
  ru: 'xn--80aahtjpadfibw.net',
  tgl: 'tgl.bookofmormon.online',
}

// Internal code → BCP47 tag for <html lang>. Identity unless listed.
const BCP47_MAP: Record<string, string> = { swe: 'sv', jp: 'ja', jpn: 'ja', vn: 'vi', tgl: 'tl', slv: 'sl' }

export function langForHost(host: string | null | undefined): string {
  const bare = (host ?? '').split(',')[0].trim().split(':')[0].toLowerCase()
  return HOST_LANG[bare] ?? 'en'
}

export function bcp47(code: string): string {
  return BCP47_MAP[code] ?? code
}

// Canonical English home — the redirect target for unauthorized hosts.
export const CANONICAL_EN_HOST = 'bookofmormon.online'

// Authorized English editions / brand-partner hosts. Empty for now.
// Future entries are hard-coded here, e.g. 'cofc.bookofmormon.online': 'en'.
// A host may SERVE only if it appears in HOST_LANG or here. (The value is a lang
// code for future use; langForHost still resolves these to 'en' until wired.)
export const EN_EDITION_HOSTS: Record<string, string> = {}

// Normalize a Host / x-forwarded-host value: first entry of a forwarded chain,
// no port, lowercased. Matches the stripping already done in langForHost/safeHost.
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? '').split(',')[0].trim().split(':')[0].toLowerCase()
}

// True only for explicitly-registered public site hosts.
export function isAuthorizedHost(host: string | null | undefined): boolean {
  const bare = normalizeHost(host)
  return bare in HOST_LANG || bare in EN_EDITION_HOSTS
}

// True for infra/local requests that must never be redirected (health checks,
// dev, IP literals, single-label internal names, hostless internal requests).
// Fails SAFE: an unrecognized internal host serves rather than 301s the site.
export function isInfraHost(host: string | null | undefined): boolean {
  const bare = normalizeHost(host)
  if (!bare) return true                                 // hostless / empty
  if (bare === 'localhost' || bare.endsWith('.local')) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare)) return true   // IPv4 literal
  if (bare.startsWith('[')) return true                   // IPv6 literal, e.g. [::1]:port
  if (!bare.includes('.')) return true                    // single-label service name
  return false
}
