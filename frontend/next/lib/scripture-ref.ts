// Pure scripture ref/slug utilities + the immutable BoM canon table. No React/GraphQL
// deps, so this module is safe to import from plain-Node unit tests.

interface ReadLine { text: string; verse_num: number }
interface ReadUnit { lines: ReadLine[] }
interface ReadSection { heading: string | null; blocks: ReadUnit[] }
export interface ReadBlock {
  ref: string
  sections: ReadSection[]
  next_ref: string | null
  prev_ref: string | null
}

// Ported verbatim from the CRA reader (frontend/webapp/src/utils/scriptureUtils.js:25):
// spaces & colons → '.', runs of hyphens → '~', lowercased. For a chapter ref (no
// colon) this is just lowercase + space→'.', matching the reader's chapter URLs.
export function slugify(ref: string): string {
  return ref.replace(/ /g, '.').replace(/:/g, '.').replace(/-+/g, '~').toLowerCase()
}

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
// The canon is immutable: 15 books, 239 chapters. Counts verified against scripture-guide.
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
