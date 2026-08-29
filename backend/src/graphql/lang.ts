/**
 * Per-request language resolution — verbatim port of the legacy rules
 * (src/config/apollo.ts context fn): language subdomain wins, then the
 * langDomains map, then the LAST url path segment, then 'en'.
 *
 * lang lives in the request context only; nothing here (or anywhere in this
 * backend) may hold per-request language in module state — that bug class is
 * what docs/bugs/2026-06-09-scripture-guide-global-lang-leak.md documents.
 */
import { env } from '../config/env.js';

/**
 * The application, scripture-guide, and bom_translation rows use `jp` while
 * older environment files advertised `jpn`. Accept the BCP-47 form (`ja`) and
 * both legacy forms at the boundary, then keep one internal/storage code.
 */
export function normalizeInternalLang(value: string): string {
  const lang = value.trim().toLowerCase();
  return lang === 'jpn' || lang === 'ja' ? 'jp' : lang;
}

const SUPPORTED = env.SUPPORTED_LANGUAGES
  .split(',')
  .map(normalizeInternalLang);

const LANG_DOMAINS: Record<string, string> = {
  'xn--289a67xla.kr': 'ko',
};

export function resolveLang(host: string | undefined, urlPath: string): string {
  const subdomain = normalizeInternalLang((host ?? '').split('.')[0] ?? '');
  // legacy: req.url.split('/').reverse().shift() || 'en' — the LAST segment
  const pathlang = normalizeInternalLang(urlPath.split('?')[0]?.split('/').reverse()[0] || 'en');
  const langDomain = host ? LANG_DOMAINS[host] : undefined;
  const candidate = normalizeInternalLang(
    SUPPORTED.includes(subdomain) ? subdomain : langDomain || pathlang || 'en',
  );
  // A1 guard: clamp to the supported set so URL path segments like 'graphql'
  // never overflow bom_user.lang varchar(3). Fall back to 'en' for unknown values.
  return SUPPORTED.includes(candidate) ? candidate : 'en';
}
