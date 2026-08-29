import { cache } from 'react'
import { gql } from './graphql'

export interface HistoryDoc {
  id: number | null
  slug: string
  year: number | null
  date: string | null
  document: string | null
  source: string | null
}

// The PHP box renders the full collection ordered by `date` (MySQL filesort:
// NULL dates first in physical order, then date ASC). The `history` resolver
// returns rows already in that order, so we render them as-received.
const HISTORY_QUERY = `query History { history { id slug year date document source } }`

export const getHistory = cache(async (): Promise<HistoryDoc[]> => {
  const d = await gql<{ history: HistoryDoc[] }>(HISTORY_QUERY, {}, { revalidate: 3600 })
  return d.history ?? []
})

// Per-document detail page (the /history/:slug view). The PHP box renders the
// document text, date, author, a thumbnail keyed by id, and the raw transcript
// HTML; the meta description is "{date}: {source} • {transcript}" stripped.
export interface HistoryDocDetail {
  slug: string
  document: string | null
  date: string | null
  author: string | null
  id: number | null
  transcript: string | null
  citation: string | null
  source: string | null
}

const HISTORY_DOC_QUERY = `
  query HistoryDoc($slug: [String]) {
    history(slug: $slug) {
      slug
      document
      date
      author
      id
      transcript
      citation
      source
    }
  }
`

export const getHistoryDoc = cache(async (slug: string): Promise<HistoryDocDetail | null> => {
  // One DB slug carries a trailing tab ("…-ancient-ruins\t") that the sitemap
  // <loc> strips; pass the tab-suffixed variant too so the dirty record resolves.
  const d = await gql<{ history: HistoryDocDetail[] }>(
    HISTORY_DOC_QUERY,
    { slug: [slug, slug + '\t'] },
    { revalidate: 86400 },
  )
  return d.history?.[0] ?? null
})

// Intro paragraph rendered verbatim by the PHP template. Its text is also the
// source for the meta description (truncated to 159 chars + '…' by buildMetadata).
export const HISTORY_INTRO =
  'This collection of documents is based in part on on the *[19th-Century Publications about the Book of Mormon](https://lib.byu.edu/collections/19th-century-publications-about-the-book-of-mormon/about/)* archive published by the Maxwell Institute and housed in Digital Collections at the BYU Library.'
