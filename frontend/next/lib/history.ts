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

// ── Collections (the five archives shown in the app's History hub) ────────────
// Blurbs mirror webapp/src/views/History/sections.js.
export interface HistoryCollection {
  key: string
  path: string
  archive: string
  title: string
  blurb: string
  unit: string
}

export const HISTORY_COLLECTIONS: HistoryCollection[] = [
  { key: 'joseph-smith', path: '/history/joseph-smith', archive: 'joseph-smith-statements', title: 'Joseph Smith', blurb: 'Statements by Joseph Smith about the Book of Mormon.', unit: 'statements' },
  { key: 'witnesses', path: '/history/witnesses', archive: 'witnesses', title: 'The Witnesses', blurb: 'Those who testified they saw and handled the plates.', unit: 'accounts' },
  { key: 'translation', path: '/history/translation', archive: 'translation', title: 'Translation Process', blurb: 'How the Book of Mormon was brought forth and rendered into English.', unit: 'documents' },
  { key: 'reception', path: '/history/reception', archive: 'reception', title: 'Reception History', blurb: 'How the book was reviewed, attacked, and defended in its own day.', unit: 'documents' },
  { key: 'lost-116-pages', path: '/history/lost-116-pages', archive: 'lost-116-pages', title: 'The Lost 116 Pages', blurb: 'Primary sources on what the lost manuscript contained.', unit: 'sources' },
]

export function collectionByKey(key: string): HistoryCollection | undefined {
  return HISTORY_COLLECTIONS.find((c) => c.key === key)
}

export interface ArchiveDoc {
  slug: string
  document: string | null
  year: number | null
  event_year: number | null
  source: string | null
  author: string | null
  seq: number | null
  mini_quote: string | null
}

const ARCHIVE_QUERY = `
  query HistoryArchive($archive: String) {
    history(archive: $archive) { slug document year event_year source author seq mini_quote }
  }
`

// Chronological (undated last), ties by seq. Witness/statement rows are dated by
// the year of the event when the publication year is absent.
export const getArchive = cache(async (archive: string, lang?: string): Promise<ArchiveDoc[]> => {
  const d = await gql<{ history: (ArchiveDoc | null)[] }>(ARCHIVE_QUERY, { archive }, { revalidate: 3600, ...(lang ? { lang } : {}) })
  const rows = (d.history ?? []).filter((r): r is ArchiveDoc => !!r && !!r.slug)
  const yr = (r: ArchiveDoc) => r.event_year || r.year || null
  return rows.sort((a, b) => {
    const ya = yr(a), yb = yr(b)
    if (ya === null && yb === null) return (a.seq ?? 0) - (b.seq ?? 0)
    if (ya === null) return 1
    if (yb === null) return -1
    return ya - yb || (a.seq ?? 0) - (b.seq ?? 0)
  })
})

export const docYear = (r: ArchiveDoc): number | null => r.event_year || r.year || null
