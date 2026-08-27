// Single source of truth for language path prefixes (the site is multilingual by
// subdomain; for bots the language also appears as a leading path segment).
// LANG_PREFIXES excludes 'en' (the default); LOCALE_SEGS includes it, for
// stripping a leading /{lang}/ segment.
export const LANG_PREFIXES = ['ko', 'fr', 'de', 'es', 'pt', 'ja', 'zh']
export const LOCALE_SEGS = new Set(['en', ...LANG_PREFIXES])
