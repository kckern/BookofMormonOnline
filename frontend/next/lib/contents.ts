import { cache } from 'react'
import { gql } from './graphql'

// The Table of Contents is a recursive division → page → section tree. The PHP
// box renders each division's TITLEPAGE (the page whose slug equals the division
// slug) and recurses into sub-pages through "capsulation" rows: a section can
// carry one or more `O` (capsule) rows whose linked page is rendered nested
// INSIDE that section's <li>. Sub-pages have their own sections, which may carry
// their own capsules — hence the recursion.

export interface ContentsSection {
  slug: string
  title: string
  /** Capsulated sub-pages embedded in this section, in row order. */
  capsules: ContentsPage[]
}
export interface ContentsPage {
  slug: string
  title: string
  sections: ContentsSection[]
}
export interface ContentsDivision {
  slug: string
  title: string
  description: string
  /** The division's titlepage, fully expanded into its section/capsule tree. */
  titlepage: ContentsPage
}

// Two queries: division metadata (slug/title/description + the flat page-slug
// set) and the page root for every page's sections. We deliberately read
// sections via `page(slug:)` rather than `division.pages.sections` because the
// division tree resolves sections in "textlink" order (textless sections lead),
// whereas the TOC — like the page query — wants plain weight order.
const DIVISIONS_QUERY = `
  query ContentsDivisions {
    division {
      slug
      title
      description
      pages { slug }
    }
  }
`
const PAGES_QUERY = `
  query ContentsPages($slugs: [String]) {
    page(slug: $slugs) {
      slug
      title
      sections {
        slug
        title
        rows {
          type
          capsulation { slug }
        }
      }
    }
  }
`

interface RawRow { type: string; capsulation: { slug: string } | null }
interface RawSection { slug: string; title: string; rows: RawRow[] | null }
interface RawPage { slug: string; title: string; sections: RawSection[] | null }
interface RawDivision { slug: string; title: string; description: string | null; pages: { slug: string }[] | null }

// Resolve a page's section tree from the by-slug index, recursing into the
// capsulated sub-pages each section's `O` rows point at.
function buildPage(page: RawPage, bySlug: Map<string, RawPage>): ContentsPage {
  return {
    slug: page.slug,
    title: page.title,
    sections: (page.sections ?? []).map((s) => {
      const capsules = (s.rows ?? [])
        .filter((r) => r.type === 'O' && r.capsulation?.slug)
        .map((r) => bySlug.get(r.capsulation!.slug))
        .filter((p): p is RawPage => Boolean(p))
        .map((p) => buildPage(p, bySlug))
      return { slug: s.slug, title: s.title, capsules }
    }),
  }
}

export const getContents = cache(async (): Promise<ContentsDivision[]> => {
  const divData = await gql<{ division: RawDivision[] }>(DIVISIONS_QUERY, {}, { revalidate: 3600 })
  const divisions = divData.division ?? []
  // Every page (titlepages + capsulated sub-pages) is listed under some
  // division; gather their slugs and pull sections in one batched page query.
  const slugs = divisions.flatMap((d) => (d.pages ?? []).map((p) => p.slug))
  const pageData = await gql<{ page: RawPage[] }>(PAGES_QUERY, { slugs }, { revalidate: 3600 })
  const pages = pageData.page ?? []

  const bySlug = new Map(pages.map((p) => [p.slug, p]))
  return divisions
    .map((d) => {
      const titlepage = bySlug.get(d.slug)
      if (!titlepage) return null
      return {
        slug: d.slug,
        title: d.title,
        description: d.description ?? '',
        titlepage: buildPage(titlepage, bySlug),
      }
    })
    .filter((d): d is ContentsDivision => d !== null)
})
