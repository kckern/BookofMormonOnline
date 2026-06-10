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

const SUPPORTED = env.SUPPORTED_LANGUAGES.split(',').map((s) => s.trim());

const LANG_DOMAINS: Record<string, string> = {
  'xn--289a67xla.kr': 'ko',
};

export function resolveLang(host: string | undefined, urlPath: string): string {
  const subdomain = (host ?? '').split('.')[0] ?? '';
  // legacy: req.url.split('/').reverse().shift() || 'en' — the LAST segment
  const pathlang = urlPath.split('?')[0]?.split('/').reverse()[0] || 'en';
  const langDomain = host ? LANG_DOMAINS[host] : undefined;
  return SUPPORTED.includes(subdomain) ? subdomain : langDomain || pathlang || 'en';
}
