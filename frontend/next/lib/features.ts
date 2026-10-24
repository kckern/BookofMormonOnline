import features from '@/config/features.generated.json'
import { LOCALE_SEGS } from '@/lib/locales'

export type SeoIntent = 'crawl' | 'noindex' | 'remove'

interface FeatureCfg {
  seo?: SeoIntent
  paths?: string[]
  // Match only these exact paths, not their subtree. An exact entry beats a prefix
  // entry of the same length, so e.g. /history can be crawlable while the
  // /history/<document> pages under it stay noindex.
  exact?: boolean
}

function normalize(input: string): string {
  let path = input.split('?')[0]
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  const segs = path.split('/').filter(Boolean)
  if (segs.length && LOCALE_SEGS.has(segs[0])) segs.shift()
  return '/' + segs.join('/')
}

// Flatten non-crawl features into [normalized prefix, intent] once at module load.
const GATES: Array<{ prefix: string; intent: SeoIntent; exact: boolean }> = Object.values(
  features as Record<string, FeatureCfg>,
)
  // 'crawl' is the default, so a crawl entry only matters when it is exact.
  .filter((f) => f && f.seo && (f.seo !== 'crawl' || f.exact) && Array.isArray(f.paths))
  .flatMap((f) => f.paths!.map((p) => ({ prefix: normalize(p), intent: f.seo!, exact: !!f.exact })))

function isSegmentPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + '/')
}

// Longest-prefix wins; default 'crawl' when no gate owns the path.
export function seoIntentForPath(pathname: string): SeoIntent {
  const path = normalize(pathname)
  let best: { prefix: string; intent: SeoIntent; exact: boolean } | null = null
  for (const g of GATES) {
    const hit = g.exact ? path === g.prefix : isSegmentPrefix(path, g.prefix)
    if (!hit) continue
    if (!best || g.prefix.length > best.prefix.length || (g.prefix.length === best.prefix.length && g.exact && !best.exact)) {
      best = g
    }
  }
  return best ? best.intent : 'crawl'
}
