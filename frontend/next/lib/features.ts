import features from '@/config/features.generated.json'

export type SeoIntent = 'crawl' | 'noindex' | 'remove'

// Language segments stripped before matching. For bots the middleware does NOT
// strip the locale prefix, so a subdomain-language URL arrives as /{lang}/…;
// mirror the middleware's CRA_LOCALE_SEG (which includes 'en').
const LOCALE_SEGS = new Set(['en', 'ko', 'fr', 'de', 'es', 'pt', 'ja', 'zh'])

interface FeatureCfg {
  seo?: SeoIntent
  paths?: string[]
}

function normalize(input: string): string {
  let path = input.split('?')[0]
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  const segs = path.split('/').filter(Boolean)
  if (segs.length && LOCALE_SEGS.has(segs[0])) segs.shift()
  return '/' + segs.join('/')
}

// Flatten non-crawl features into [normalized prefix, intent] once at module load.
const GATES: Array<{ prefix: string; intent: SeoIntent }> = Object.values(
  features as Record<string, FeatureCfg>,
)
  .filter((f) => f && f.seo && f.seo !== 'crawl' && Array.isArray(f.paths))
  .flatMap((f) => f.paths!.map((p) => ({ prefix: normalize(p), intent: f.seo! })))

function isSegmentPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + '/')
}

// Longest-prefix wins; default 'crawl' when no gate owns the path.
export function seoIntentForPath(pathname: string): SeoIntent {
  const path = normalize(pathname)
  let best: { prefix: string; intent: SeoIntent } | null = null
  for (const g of GATES) {
    if (isSegmentPrefix(path, g.prefix) && (!best || g.prefix.length > best.prefix.length)) {
      best = g
    }
  }
  return best ? best.intent : 'crawl'
}
