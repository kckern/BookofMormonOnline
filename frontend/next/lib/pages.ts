import { cache } from 'react'
import { gql } from './graphql'
import { wikiToText } from './entity'

export interface PageRow {
  heading: string
  link: number
  description: string
}
export interface PageSection {
  title: string
  slug: string
  rows: PageRow[]
}
export interface PageContent {
  slug: string
  title: string
  sections: PageSection[]
}

const PAGE_QUERY = `
  query Page($slug: [String]) {
    page(slug: $slug) {
      slug
      title
      sections {
        title
        slug
        rows {
          type
          narration {
            description
            text { heading link }
          }
        }
      }
    }
  }
`

interface RawRow {
  type: string
  narration: { description: string | null; text: { heading: string; link: number } | null } | null
}
interface RawSection { title: string; slug: string; rows: RawRow[] | null }
interface RawPage { slug: string; title: string; sections: RawSection[] | null }

// Narration descriptions embed wiki-style entity links; the page index renders
// them as plain display text (see entity.wikiToText).
const stripWikiLinks = wikiToText

export const getPageContent = cache(async (slug: string): Promise<PageContent | null> => {
  let p: RawPage | undefined
  try {
    const data = await gql<{ page: RawPage[] }>(PAGE_QUERY, { slug: [slug] }, { revalidate: 3600 })
    p = data.page?.[0]
  } catch {
    return null
  }
  if (!p) return null

  return {
    slug: p.slug,
    title: p.title,
    sections: (p.sections ?? []).map((s) => ({
      title: s.title,
      slug: s.slug,
      rows: (s.rows ?? [])
        .filter((r) => r.narration?.text?.heading)
        .map((r) => ({
          heading: r.narration!.text!.heading,
          link: r.narration!.text!.link,
          description: stripWikiLinks(r.narration!.description ?? ''),
        })),
    })),
  }
})
