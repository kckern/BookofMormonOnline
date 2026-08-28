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

// Internal code → BCP47 tag for <html lang>. Identity unless listed.
const BCP47_MAP: Record<string, string> = { swe: 'sv', jpn: 'ja', vn: 'vi', tgl: 'tl', slv: 'sl' }

export function langForHost(host: string | null | undefined): string {
  const bare = (host ?? '').split(',')[0].trim().split(':')[0].toLowerCase()
  return HOST_LANG[bare] ?? 'en'
}

export function bcp47(code: string): string {
  return BCP47_MAP[code] ?? code
}
