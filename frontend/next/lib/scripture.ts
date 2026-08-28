import { cache } from 'react'
import { lookupReference, generateReference } from 'scripture-guide'
import { gql } from './graphql'
import { slugify, type ReadBlock } from './scripture-ref'

// Re-export the pure ref utilities so existing consumers keep importing from '@/lib/scripture'.
export { slugify, scripturePreview, BOM_BOOKS, bomChapterSlugs } from './scripture-ref'
export type { ReadBlock } from './scripture-ref'

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
  if (verse_ids.length === 0) return null
  // FIRST verse only: a chapter-range ref (e.g. "alma.32~33") yields a colon-less
  // "Alma 32-33" that read() would accept as a distinct self-canonical page. Deriving
  // from verse_ids[0] collapses every verse/range/chapter form to one chapter.
  const chapterRef = generateReference([verse_ids[0]]).split(':')[0]
  const chapterSlug = slugify(chapterRef)
  const block = await getReadBlock(chapterSlug)
  if (!block) return null
  return { chapterSlug, block }
})
