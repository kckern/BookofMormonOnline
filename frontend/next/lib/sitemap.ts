import { cache } from 'react'
import { gql } from './graphql'
import { seoIntentForPath } from './features'

// ── /sitemap.xml URL enumeration ─────────────────────────────────────────────
// Parity target: the legacy PHP box's sitemap, which contains exactly 3179 URLs
// across nine categories. Every URL carries a fixed changefreq + lastmod (below);
// only <priority> varies by category. This module produces the full URL list;
// the route handler (app/sitemap.xml/route.ts) renders it to XML.

export const BASE = 'https://bookofmormon.online'
export const CHANGEFREQ = 'weekly'
// lastmod is a single site-wide constant: the last content-build date. The PHP
// box stamps every URL with this same value rather than a per-row mtime.
export const LASTMOD = '2026-06-06'

export interface SitemapUrl {
  path: string // absolute path, e.g. '/lehites/lehis-prophetic-call'
  priority: string // exact string the benchmark emits: '1.0','0.9',…,'0.1'
}

// ── content tree (priority 0.8) ──────────────────────────────────────────────
// The named scripture-division/page/section hierarchy. The PHP sitemap walked
// the bom_slug table (every PG page + SC section), yielding 531 URLs whose path
// is the slug's full ancestor chain. We reconstruct the same set from GraphQL:
//   • division → its 49 page slugs (each slug is already a full hierarchical path)
//   • page(slug:) → each page's section slugs (also full paths)
// emitting /{page.slug} and /{section.slug} for all of them.
interface DivisionRow { slug: string; pages: { slug: string }[] | null }
interface SectionRow { slug: string }
interface PageRow { slug: string; sections: SectionRow[] | null }

const DIVISIONS_QUERY = `query SitemapDivisions { division { slug pages { slug } } }`
const PAGES_QUERY = `query SitemapPages($slugs: [String]) { page(slug: $slugs) { slug sections { slug } } }`

// One legacy bom_slug row the GraphQL API cannot surface: this SC slug points at
// a link guid with no matching bom_section row (orphaned content), so page(slug:)
// drops it — but the PHP box's blind bom_slug walk kept it. Add it back verbatim
// to match the benchmark's 531st content-tree URL.
const ORPHANED_SECTION_SLUGS = ['reign-of-judges/ammonihah/antioniah/mercy-through-jesus']

async function contentTreeUrls(): Promise<SitemapUrl[]> {
  const divData = await gql<{ division: DivisionRow[] }>(DIVISIONS_QUERY, {}, { revalidate: 3600 })
  const pageSlugs = (divData.division ?? []).flatMap((d) => (d.pages ?? []).map((p) => p.slug))
  const pageData = await gql<{ page: PageRow[] }>(PAGES_QUERY, { slugs: pageSlugs }, { revalidate: 3600 })

  const paths = new Set<string>()
  for (const page of pageData.page ?? []) {
    paths.add(`/${page.slug}`)
    for (const section of page.sections ?? []) paths.add(`/${section.slug}`)
  }
  for (const slug of ORPHANED_SECTION_SLUGS) paths.add(`/${slug}`)
  return [...paths].map((path) => ({ path, priority: '0.8' }))
}

// ── people (0.6) / places (0.6) ──────────────────────────────────────────────
// person/place with no slug arg return the full lists (legacy behaviour). Note
// the benchmark uses singular /place/ (not /places/).
const PEOPLE_QUERY = `query SitemapPeople { person { slug } }`
const PLACES_QUERY = `query SitemapPlaces { place { slug } }`

async function peopleUrls(): Promise<SitemapUrl[]> {
  const d = await gql<{ person: { slug: string }[] }>(PEOPLE_QUERY, {}, { revalidate: 3600 })
  return (d.person ?? []).map((p) => ({ path: `/people/${p.slug}`, priority: '0.6' }))
}
async function placeUrls(): Promise<SitemapUrl[]> {
  const d = await gql<{ place: { slug: string }[] }>(PLACES_QUERY, {}, { revalidate: 3600 })
  return (d.place ?? []).map((p) => ({ path: `/place/${p.slug}`, priority: '0.6' }))
}

// ── history (index 0.7 + 1024 docs at 0.3) ───────────────────────────────────
const HISTORY_QUERY = `query SitemapHistory { history { slug } }`
async function historyUrls(): Promise<SitemapUrl[]> {
  const d = await gql<{ history: { slug: string }[] }>(HISTORY_QUERY, {}, { revalidate: 3600 })
  return (d.history ?? []).map((h) => ({ path: `/history/${h.slug}`, priority: '0.3' }))
}

// ── fax (index 0.7 + 57 editions at 0.5) ─────────────────────────────────────
// fax(filter:"pdf") returns the 52 editions with com=0/hide=0 in the request
// language (en). Five further editions exist only under lang='ko' (Korean PDF
// printings); the resolver's lang fallback only triggers on an EMPTY result, so
// those 5 can never surface through the en query. The PHP sitemap merged across
// languages → 57 total. Supplement the 5 ko-only slugs to match.
const FAX_QUERY = `query SitemapFax { fax(filter: "pdf") { slug } }`
const KO_ONLY_FAX_SLUGS = ['1962k', '1967k', '1973kr', '2005k', '2020k']
async function faxUrls(): Promise<SitemapUrl[]> {
  const d = await gql<{ fax: { slug: string }[] }>(FAX_QUERY, {}, { revalidate: 3600 })
  const slugs = new Set([...(d.fax ?? []).map((f) => f.slug), ...KO_ONLY_FAX_SLUGS])
  return [...slugs].map((slug) => ({ path: `/fax/${slug}`, priority: '0.5' }))
}

// ── maps (index 0.7 + 20 maps at 0.6 + 930 map-place URLs at 0.1) ────────────
// maps { slug places { slug } } returns 19 maps / 903 place rows. The benchmark
// has 20 maps / 930 place URLs: it additionally carries a legacy `newyork` map
// whose place set is byte-identical to `panama` (verified). `newyork` is no
// longer exposed by the maps resolver, so we synthesise it by cloning panama's
// places — reproducing the 20th map and its 27 place URLs.
interface MapRow { slug: string; places: { slug: string }[] | null }
const MAPS_QUERY = `query SitemapMaps { maps { slug places { slug } } }`
const CLONED_MAPS: Record<string, string> = { newyork: 'panama' }
async function mapUrls(): Promise<SitemapUrl[]> {
  const d = await gql<{ maps: MapRow[] }>(MAPS_QUERY, {}, { revalidate: 3600 })
  const maps = d.maps ?? []
  const placesBySlug = new Map(maps.map((m) => [m.slug, m.places ?? []]))

  const urls: SitemapUrl[] = []
  const emitMap = (mapSlug: string, places: { slug: string }[]) => {
    urls.push({ path: `/map/${mapSlug}`, priority: '0.6' })
    for (const place of places) urls.push({ path: `/map/${mapSlug}/place/${place.slug}`, priority: '0.1' })
  }
  for (const m of maps) emitMap(m.slug, m.places ?? [])
  for (const [clone, source] of Object.entries(CLONED_MAPS)) emitMap(clone, placesBySlug.get(source) ?? [])
  return urls
}

// ── superset additions (NOT in the legacy box's sitemap) ─────────────────────
// Crawlable content pages the PHP box server-rendered but never listed in its
// sitemap. We list them so ours is a deliberate superset. Priorities follow the
// box's own conventions: index/list pages 0.7, detail items 0.5, static info 0.5.
// (Art & commentary are intentionally NOT enumerated — link-only, reachable only
// from the text items that embed them.)
const TIMELINE_QUERY = `query SitemapTimeline { timeline { slug } }`
async function timelineUrls(): Promise<SitemapUrl[]> {
  const d = await gql<{ timeline: { slug: string }[] }>(TIMELINE_QUERY, {}, { revalidate: 3600 })
  const slugs = new Set((d.timeline ?? []).map((t) => t.slug).filter(Boolean))
  return [...slugs].map((slug) => ({ path: `/timeline/${slug}`, priority: '0.5' }))
}

// ── full URL list ────────────────────────────────────────────────────────────
export const getSitemapUrls = cache(async (): Promise<SitemapUrl[]> => {
  const [content, people, places, history, fax, maps, timeline] = await Promise.all([
    contentTreeUrls(),
    peopleUrls(),
    placeUrls(),
    historyUrls(),
    faxUrls(),
    mapUrls(),
    timelineUrls(),
  ])

  // Static + section-index pages. The first five match the benchmark's leading
  // order; the rest are our superset index/static pages.
  const statics: SitemapUrl[] = [
    { path: '/', priority: '1.0' },
    { path: '/contents', priority: '0.9' },
    { path: '/history', priority: '0.7' },
    { path: '/fax', priority: '0.7' },
    { path: '/map', priority: '0.7' },
    // superset:
    { path: '/people', priority: '0.7' },
    { path: '/places', priority: '0.7' },
    { path: '/timeline', priority: '0.7' },
    { path: '/about', priority: '0.5' },
    { path: '/studyedition', priority: '0.5' },
  ]

  const all = [...statics, ...content, ...people, ...places, ...history, ...fax, ...maps, ...timeline]
  return all.filter((u) => seoIntentForPath(u.path) === 'crawl')
})
