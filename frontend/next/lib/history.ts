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
  try {
    const d = await gql<{ history: HistoryDoc[] }>(HISTORY_QUERY, {}, { revalidate: 3600 })
    return d.history ?? []
  } catch {
    return []
  }
})

// Intro paragraph rendered verbatim by the PHP template. Its text is also the
// source for the meta description (truncated to 159 chars + '…' by buildMetadata).
export const HISTORY_INTRO =
  'This collection of documents is based in part on on the *[19th-Century Publications about the Book of Mormon](https://lib.byu.edu/collections/19th-century-publications-about-the-book-of-mormon/about/)* archive published by the Maxwell Institute and housed in Digital Collections at the BYU Library.'
