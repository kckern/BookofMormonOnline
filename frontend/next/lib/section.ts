import { cache } from 'react'
import type { Metadata } from 'next'
import { gql } from './graphql'
import { wikiToText } from './entity'
import { buildMetadata } from './seo'
import { getPageContent } from './pages'

// Section pages (/:pageSlug/:section…, the named content-tree nodes — NOT the
// numbered text blocks). The PHP box renders the parent crumb (h2 → the section's
// containing page/section), the section title (h1), then one <section> per
// narration block: ref heading link, narration synopsis (<summary>), verse body
// (<p>), and the block's art images (<ul class="art">).

export interface SectionArt {
  id: string
  title: string
}
export interface SectionBlock {
  /** Full content-tree slug, e.g. "lehites/1" — its URL is `/${slug}`. */
  slug: string
  heading: string
  /** Narration synopsis, wiki-links resolved to plain text. */
  description: string
  /** Verse body HTML (citation/image markers stripped), ready for raw render. */
  body: string
  art: SectionArt[]
}
export interface SectionData {
  slug: string
  title: string
  /** The containing page/section: the h2 crumb target (slug + title). */
  parentSlug: string
  parentTitle: string
  blocks: SectionBlock[]
  /**
   * One entry PER ROW in source order — the narration synopsis (wiki-links
   * resolved) for N rows, empty string for connection/capsule spacer rows. The
   * meta description joins these with a single space, so leading/empty rows emit
   * exactly the PHP box's leading/double spaces (counted toward the 159 cap).
   */
  descParts: string[]
}

// We resolve a section through its PARENT page's sections rather than the
// top-level section(slug:) query for two reasons:
//   1. section(slug:) matches by leaf slug only, so it can't distinguish two
//      sections that share a leaf (e.g. the two `the-day-of-salvation`s); the
//      parent page disambiguates by full path.
//   2. the section.rows.narration.text.heading resolver throws on a few blocks
//      (e.g. the Title-Page blocks under /moroni/finishing-touches). Pulling only
//      slug/link here and fetching heading/content/imgs/quotes via a top-level
//      text(slug:) batch (below) avoids that path entirely.
const PAGE_SECTIONS_QUERY = `
  query SectionParent($slug: [String]) {
    page(slug: $slug) {
      slug
      title
      sections {
        slug
        title
        rows {
          type
          narration {
            description
            text { slug link }
          }
        }
      }
    }
  }
`

// Block detail batch — heading + verse content + art images + quote sub-blocks,
// keyed by the block's full slug.
const BLOCKS_QUERY = `
  query SectionBlocks($slugs: [String]) {
    text(slug: $slugs) {
      slug
      heading
      content
      imgs { id title }
      quotes { slug heading parent }
    }
  }
`

interface RawImg { id: string; title: string }
interface RawQuote { slug: string; heading: string; parent: string }
interface RawBlockText {
  slug: string
  heading: string
  content: string | null
  imgs: RawImg[] | null
  quotes: RawQuote[] | null
}
interface RawRowText { slug: string; link: number }

// Tolerant GraphQL fetch for the block batch. The backend's text.heading resolver
// throws on a few blocks (the Title-Page blocks under /moroni/finishing-touches),
// returning partial data alongside a GraphQL error. The shared gql() rejects on
// any error, which would drop the whole section; here we keep the partial rows
// (heading falls back to '') so those sections still render.
const GRAPHQL_URL = process.env.GRAPHQL_URL ?? 'http://localhost:5006/graphql'
async function gqlTolerant<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`GraphQL fetch failed: ${res.status}`)
  const json = await res.json()
  return json.data as T // ignore json.errors — partial data is acceptable here
}
interface RawRow {
  type: string
  narration: { description: string | null; text: RawRowText | null } | null
}
interface RawParentSection {
  slug: string
  title: string
  rows: RawRow[] | null
}
interface RawParentPage {
  slug: string
  title: string
  sections: RawParentSection[] | null
}

// A [quote]…[/quote] marker expands to a <ul> of the block's sub-block links
// (the TextBlock.quotes), each labeled by its heading with the leading
// "[reference] " prefix stripped (kept verbatim when there is no such prefix).
// Narration synopsis → display text: resolve wiki-links and flatten the CR/LF the
// source data carries (a few descriptions embed multi-line HTML tables) to single
// spaces, the way the PHP box renders them inline in the <summary>. Trimmed —
// the PHP box left-/right-trims each block's summary.
function narrationText(description: string): string {
  return wikiToText(description ?? '')
    .replace(/\r\n?|\n/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

// A [quote]{markerId}[/quote] expands to a <ul> of just the sub-blocks whose
// `parent` equals that marker id — a single block can carry multiple quote groups
// (e.g. /lehites/104 has two), and the full quotes list is flat, so we filter.
function quoteList(quotes: RawQuote[], markerId: string): string {
  const items = quotes
    .filter((q) => q.parent === markerId)
    .map((q) => {
      const label = q.heading.replace(/^\[[^\]]*\]\s*/, '')
      return `<li><a href="/${q.slug}">${label}</a></li>`
    })
    .join(' ')
  return `<ul> ${items} </ul>`
}

// Verse-body transform mirroring the PHP box: expand the block's [quote] sub-list,
// drop [c]citation[/c] / [i]image[/i] / [v]/[a]… markers (any [x]…[/x] data
// marker), convert the legacy `_` soft-space token, then collapse the runs of
// whitespace those removals leave behind. Deliberately does NOT trim — the PHP box
// keeps the trailing space before each closing </p>.
function blockBody(content: string, quotes: RawQuote[]): string {
  return (content ?? '')
    .replace(/\[quote\]([^\[]*?)\[\/quote\]/g, (_m, id: string) => quoteList(quotes, id))
    // [c]citation[/c], [i]image[/i], [v]verse[/v], [a]audio[/a] — any other marker.
    .replace(/\[([a-z]+)\][^\]]*?\[\/\1\]/g, '')
    .replace(/_/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
}

// A few orphaned bom_slug rows are aliases: the URL slug has no matching
// bom_section, but the legacy box serves another section's content at it. Resolve
// content from the target while keeping the requested URL (path/canonical).
const SECTION_ALIASES: Record<string, string> = {
  'reign-of-judges/ammonihah/antioniah/mercy-through-jesus':
    'reign-of-judges/ammonihah/antioniah/repentence-is-granted',
}

export const getSection = cache(async (slug: string): Promise<SectionData | null> => {
  const realSlug = SECTION_ALIASES[slug] ?? slug
  // Parent = the slug's ancestor chain minus the leaf; its page query lists this
  // section (disambiguated by full path) and the section's rows in weight order.
  const parentSlug = realSlug.split('/').slice(0, -1).join('/')
  if (!parentSlug) return null

  let parent: RawParentPage | undefined
  try {
    const data = await gql<{ page: RawParentPage[] }>(
      PAGE_SECTIONS_QUERY,
      { slug: [parentSlug] },
      { revalidate: 3600 },
    )
    parent = data.page?.[0]
  } catch {
    return null
  }
  const section = parent?.sections?.find((sec) => sec.slug === realSlug)
  if (!parent || !section) return null

  const rows = section.rows ?? []
  const nRows = rows.filter((r) => r.type === 'N' && r.narration?.text)
  const blockSlugs = nRows.map((r) => r.narration!.text!.slug)

  // One batched text() call for every block's heading/content/imgs/quotes.
  let bySlug = new Map<string, RawBlockText>()
  if (blockSlugs.length) {
    try {
      const data = await gqlTolerant<{ text: RawBlockText[] }>(BLOCKS_QUERY, { slugs: blockSlugs })
      bySlug = new Map((data.text ?? []).filter(Boolean).map((t) => [t.slug, t]))
    } catch {
      return null
    }
  }

  const blocks: SectionBlock[] = nRows.map((r) => {
    const blockSlug = r.narration!.text!.slug
    const t = bySlug.get(blockSlug)
    return {
      slug: blockSlug,
      // A normal block's heading is a scripture ref; an empty one means the
      // text.heading resolver threw on a textParent-less Title-Page block (the
      // BoM title page under /moroni/finishing-touches), which the PHP box labels
      // "Title Page".
      heading: t?.heading || 'Title Page',
      description: narrationText(r.narration!.description ?? ''),
      body: blockBody(t?.content ?? '', t?.quotes ?? []),
      art: (t?.imgs ?? []).map((i) => ({ id: i.id, title: i.title })),
    }
  })

  // Per-row description parts in source order: the (trimmed) narration text for N
  // rows, '' for connection/capsule spacer rows (which still occupy a join slot,
  // so a leading C row or a mid O row emits the PHP box's leading/double space).
  const descParts = rows.map((r) =>
    r.type === 'N' && r.narration ? narrationText(r.narration.description ?? '') : '',
  )

  return {
    slug,
    title: section.title,
    parentSlug: parent.slug,
    parentTitle: parent.title,
    blocks,
    descParts,
  }
})

// The PHP box's hard 159-char + '…' truncation — WITHOUT collapsing or trimming
// whitespace (the section description's leading/double spaces are significant and
// count toward the cap), unlike seo.truncateDesc which normalizes first.
function truncateRaw(text: string, max = 159): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

export async function sectionMetadata(slug: string): Promise<Metadata> {
  // Page-first: capsulated *page* slugs (e.g. /lehites/nephis-vision,
  // /reign-of-judges/ammonihah) — including those that are also a section — get
  // page-style head tags, the same rule the top-level /:pageSlug branch uses.
  const page = await getPageContent(slug)
  if (page && page.sections.length > 0) {
    // PHP box: each section title followed by ". " (so the description ends with a
    // period that buildMetadata's trim keeps once the trailing space is dropped).
    const description = page.sections.map((s) => `${s.title}. `).join('')
    return buildMetadata({ title: page.title, description, path: `/${slug}` })
  }

  const data = await getSection(slug)
  if (!data) return {}
  // Description = every row's narration synopsis joined with a single space (the
  // PHP box concatenates all blocks; empty connection/capsule rows contribute the
  // leading / double spaces). Truncated raw (no whitespace normalization) so the
  // 159-char cap lands byte-identically, then passed pre-truncated.
  const description = truncateRaw(data.descParts.join(' '))
  return buildMetadata({
    title: data.title,
    description,
    path: `/${data.slug}`,
    preTruncated: true,
    ogSub: data.parentTitle,
  })
}
