import { cache as reactCache } from 'react'
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { lookupReference, generateReference } from 'scripture-guide'
import { gql } from './graphql'

// react.cache is only available under the React server runtime (Next.js App Router).
// Fall back to identity so pure-function unit tests can import this module without
// a runtime crash (the async functions that use cache are not called in unit tests).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache: <T extends (...args: any[]) => any>(fn: T) => T =
  (typeof reactCache === 'function' ? reactCache : (fn: unknown) => fn) as <T extends (...args: any[]) => any>(fn: T) => T

interface ReadLine { text: string; verse_num: number }
interface ReadUnit { lines: ReadLine[] }
interface ReadSection { heading: string | null; blocks: ReadUnit[] }
export interface ReadBlock {
  ref: string
  sections: ReadSection[]
  next_ref: string | null
  prev_ref: string | null
}

const READ_QUERY = `
  query Read($ref: String!) {
    read(ref: $ref) {
      ref
      next_ref
      prev_ref
      sections {
        heading
        blocks {
          lines {
            text
            verse_num
          }
        }
      }
    }
  }
`

// Ported verbatim from the CRA reader (frontend/webapp/src/utils/scriptureUtils.js:25):
// spaces & colons → '.', runs of hyphens → '~', lowercased. For a chapter ref (no
// colon) this is just lowercase + space→'.', matching the reader's chapter URLs.
export function slugify(ref: string): string {
  return ref.replace(/ /g, '.').replace(/:/g, '.').replace(/-+/g, '~').toLowerCase()
}

// Fetch a chapter. ALWAYS English: read() returns localized ref/prev_ref/next_ref on a
// language endpoint, which would produce non-ASCII prev/next hrefs that 404 and a title
// incoherent with the en-apex canonical. Pinning lang:'en' keeps verse text + nav English
// on every host. Let gql throw (network / GraphQL errors) so a backend outage surfaces as
// a 5xx, not a false 404 — return null ONLY when read is genuinely null.
export const getReadBlock = cache(async (ref: string): Promise<ReadBlock | null> => {
  const data = await gql<{ read: ReadBlock | null }>(READ_QUERY, { ref }, { revalidate: 3600, lang: 'en' })
  return data.read ?? null
})

export interface ChapterResolution {
  chapterSlug: string
  block: ReadBlock
}

// Resolve any /read ref form to its single chapter. Keyed on the joined string (cache()
// keys non-primitives by reference, so an array arg would not dedupe across the two
// separately-awaited params in generateMetadata + the page component).
export const resolveChapter = cache(async (rawRef: string): Promise<ChapterResolution | null> => {
  const { verse_ids } = lookupReference(rawRef)
  if (!verse_ids || verse_ids.length === 0) return null
  // FIRST verse only: a chapter-range ref (e.g. "alma.32~33") yields a colon-less
  // "Alma 32-33" that read() would accept as a distinct self-canonical page. Deriving
  // from verse_ids[0] collapses every verse/range/chapter form to one chapter.
  const chapterRef = generateReference([verse_ids[0]]).split(':')[0]
  const chapterSlug = slugify(chapterRef)
  const block = await getReadBlock(chapterSlug)
  if (!block) return null
  return { chapterSlug, block }
})

// First non-empty body text as a meta/JSON-LD description.
export function scripturePreview(block: ReadBlock, maxWords = 20): string {
  for (const section of block.sections) {
    for (const unit of section.blocks) {
      const words = unit.lines.flatMap((l) => l.text.split(/\s+/)).filter(Boolean)
      if (words.length > 0) return words.slice(0, maxWords).join(' ') + '…'
    }
  }
  return ''
}

// ── BoM chapter enumeration (for the sitemap) ────────────────────────────────
// The canon is immutable: 15 books, 239 chapters. Counts verified against
// scripture-guide (see the plan's Task 1 Step 6 check).
export const BOM_BOOKS: ReadonlyArray<{ name: string; chapters: number }> = [
  { name: '1 Nephi', chapters: 22 },
  { name: '2 Nephi', chapters: 33 },
  { name: 'Jacob', chapters: 7 },
  { name: 'Enos', chapters: 1 },
  { name: 'Jarom', chapters: 1 },
  { name: 'Omni', chapters: 1 },
  { name: 'Words of Mormon', chapters: 1 },
  { name: 'Mosiah', chapters: 29 },
  { name: 'Alma', chapters: 63 },
  { name: 'Helaman', chapters: 16 },
  { name: '3 Nephi', chapters: 30 },
  { name: '4 Nephi', chapters: 1 },
  { name: 'Mormon', chapters: 9 },
  { name: 'Ether', chapters: 15 },
  { name: 'Moroni', chapters: 10 },
]

// Every chapter slug in canonical order: ['1.nephi.1', …, 'moroni.10'] (239 entries).
export function bomChapterSlugs(): string[] {
  const slugs: string[] = []
  for (const book of BOM_BOOKS) {
    for (let n = 1; n <= book.chapters; n++) slugs.push(slugify(`${book.name} ${n}`))
  }
  return slugs
}
