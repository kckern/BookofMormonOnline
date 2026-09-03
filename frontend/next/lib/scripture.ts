import { cache } from 'react'
import { lookupReference, generateReference } from 'scripture-guide'
import { gql } from './graphql'
import { slugify, type ReadBlock } from './scripture-ref'
import { getLabels } from './labels'

export interface ReadCard {
  /** Display reference: "1 Nephi 1" (chapter) or "1 Nephi 1:2" / "1 Nephi 1:2-5" (verses). */
  ref: string
  /** True when the ref addresses specific verses rather than a whole chapter. */
  isVerseLevel: boolean
  /** Running scripture text, filled to the card's capacity (verses only when verse-level). */
  text: string
  /** Primary speaker for the passage, if any — drives the reader-style portrait + label. */
  speaker?: { slug: string; voice: string }
}

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
          person_slug
          voice
          lines {
            text
            verse_num
            format
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

// A line is prose scripture (not a chapter heading/summary preface). The reader marks
// summaries with 'i' (italic) and section headings with '§'; skip both so the card fills
// with verse text, not front-matter.
function isBodyLine(fmt?: string | null): boolean {
  return !(fmt && /[i§]/.test(fmt))
}

// The reader shows label(voice); voice is a dictionary key ("vox_nephi1" → "Nephi"),
// present in labels even for English. Fall back to a de-slugged key if the lookup misses.
function prettyVoice(key: string): string {
  return key
    .replace(/^vox_/i, '')
    .replace(/\d+/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Resolve a /read ref to a display-ready card: the reference, whether it is verse-level,
// the running scripture text (filtered to the requested verses when verse-level, else the
// whole chapter body), and the primary speaker (first unit with a person) for the reader's
// portrait + voice label. Supports chapter (1.nephi.1), verse (1.nephi.1.2), and verse
// ranges (1.nephi.1.2-5). ~90 words is enough to fill the card at the scripture size.
export const resolveReadCard = cache(async (rawRef: string, maxWords = 90): Promise<ReadCard | null> => {
  const { verse_ids } = lookupReference(rawRef)
  if (verse_ids.length === 0) return null
  const fullRef = generateReference(verse_ids)
  const isVerseLevel = fullRef.includes(':')
  const chapterRef = generateReference([verse_ids[0]]).split(':')[0]
  const block = await getReadBlock(slugify(chapterRef))
  if (!block) return null

  // Which chapter verse numbers to include (null = whole chapter).
  const verseNums = isVerseLevel
    ? new Set(verse_ids.map((id) => Number(generateReference([id]).split(':')[1])))
    : null
  const wants = (n: number) => verseNums === null || verseNums.has(n)

  const words: string[] = []
  let speaker: { slug: string; voice: string } | undefined
  outer: for (const section of block.sections) {
    for (const unit of section.blocks) {
      const unitHasWanted = unit.lines.some((l) => wants(l.verse_num))
      if (unitHasWanted && !speaker && unit.person_slug && unit.voice) {
        speaker = { slug: unit.person_slug, voice: unit.voice }
      }
      for (const line of unit.lines) {
        if (!wants(line.verse_num) || !isBodyLine(line.format)) continue
        for (const w of line.text.split(/\s+/)) if (w) words.push(w)
        if (words.length >= maxWords) break outer
      }
    }
  }
  const truncated = words.length >= maxWords
  const text = words.slice(0, maxWords).join(' ') + (truncated ? '…' : '')

  if (speaker) {
    const labels = await getLabels().catch(() => ({} as Record<string, string>))
    speaker = { slug: speaker.slug, voice: labels[speaker.voice.toLowerCase()] ?? prettyVoice(speaker.voice) }
  }
  return { ref: fullRef, isVerseLevel, text, speaker }
})
