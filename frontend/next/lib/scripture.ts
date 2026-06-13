import { cache } from 'react'
import { gql } from './graphql'

interface ReadLine { text: string; verse_num: number }
interface ReadUnit { lines: ReadLine[] }
interface ReadSection { heading: string | null; blocks: ReadUnit[] }
interface ReadBlock { ref: string; sections: ReadSection[]; next_ref: string | null; prev_ref: string | null }

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

export const getReadBlock = cache(async (ref: string, lang = 'en'): Promise<ReadBlock | null> => {
  try {
    const data = await gql<{ read: ReadBlock }>( READ_QUERY, { ref }, { revalidate: 3600 })
    return data.read ?? null
  } catch {
    return null
  }
})

// Extract the first few words of body text as a preview description
export function scripturePreview(block: ReadBlock, maxWords = 20): string {
  for (const section of block.sections) {
    for (const unit of section.blocks) {
      const words = unit.lines.flatMap((l) => l.text.split(/\s+/)).filter(Boolean)
      if (words.length > 0) return words.slice(0, maxWords).join(' ') + '…'
    }
  }
  return ''
}
