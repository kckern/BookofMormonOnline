import { cache } from 'react'
import { gql } from './graphql'

export interface Commentary { id: string; title: string }
export interface SiblingRef { slug: string; heading: string }
export interface TextBlockData {
  slug: string
  heading: string
  content: string // raw, still contains [c]id[/c] citation markers
  link: number
  pageSlug: string
  pageTitle: string
  sectionSlug: string
  sectionTitle: string
  coms: Commentary[]
  prev: SiblingRef | null
  next: SiblingRef | null
}

const TEXT_QUERY = `
  query Text($slugs: [String]) {
    text(slug: $slugs) {
      slug
      heading
      content
      link
      parent_section { title slug }
      parent_page { title slug }
      coms { id title }
    }
  }
`

interface RawText {
  slug: string
  heading: string
  content: string
  link: number
  parent_section: { title: string; slug: string } | null
  parent_page: { title: string; slug: string } | null
  coms: Commentary[] | null
}

// /:pageSlug/:id — the numeric URL segment equals the TextBlock `link`, and
// prev/next are link±1, so all three resolve in one batched query.
export const getTextBlock = cache(
  async (pageSlug: string, id: number): Promise<TextBlockData | null> => {
    const cur = `${pageSlug}/${id}`
    const prevSlug = `${pageSlug}/${id - 1}`
    const nextSlug = `${pageSlug}/${id + 1}`
    const data = await gql<{ text: RawText[] }>(
      TEXT_QUERY,
      { slugs: [cur, prevSlug, nextSlug] },
      { revalidate: 3600 },
    )
    const rows = data.text ?? []

    // Match by the numeric `link`, not the requested slug string: the backend
    // resolves a bare-leaf alias (e.g. "zoramites/1") to the FULL canonical slug
    // ("reign-of-judges/zoramites/1"), so a slug-string lookup on the short form
    // would miss. `link` equals the URL's block number and is unique among the
    // three requested rows (id-1, id, id+1).
    const byLink = new Map(rows.filter(Boolean).map((r) => [r.link, r]))
    const block = byLink.get(id)
    if (!block) return null

    const sibling = (lnk: number): SiblingRef | null => {
      const r = byLink.get(lnk)
      return r ? { slug: r.slug, heading: r.heading } : null
    }

    return {
      slug: block.slug,
      heading: block.heading,
      content: block.content ?? '',
      link: block.link,
      pageSlug: block.parent_page?.slug ?? pageSlug,
      pageTitle: block.parent_page?.title ?? '',
      sectionSlug: block.parent_section?.slug ?? '',
      sectionTitle: block.parent_section?.title ?? '',
      coms: block.coms ?? [],
      prev: sibling(id - 1),
      next: sibling(id + 1),
    }
  },
)

// Body HTML: drop citation markers but keep the verse's <p> structure, then
// collapse the double spaces the markers leave behind.
export function contentBody(content: string): string {
  return content
    .replace(/\[c\][^\]]*?\[\/c\]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;—])/g, '$1')
    .trim()
}
