import { cache } from 'react'
import { gql } from './graphql'

export interface CommentarySource {
  source_id: string
  source_title: string
  source_name: string
  source_url: string
}

export interface Commentary {
  id: string
  title: string
  text: string
  /** Verse reference shown in the title and References link, e.g. "1 Nephi 5:17–19".
   *  Comes from the parent TextBlock heading (NOT commentary.reference, which can
   *  span a wider range than the text block it is attached to). */
  ref: string
  /** Text-block slug the commentary hangs off, e.g. "lehites/64". */
  locationSlug: string
  publication: CommentarySource
}

const COMMENTARY_QUERY = `
  query Commentary($id: [String]) {
    commentary(id: $id) {
      id
      title
      text
      location { slug heading }
      publication {
        source_id
        source_title
        source_name
        source_url
      }
    }
  }
`

interface RawCommentary {
  id: string
  title: string | null
  text: string | null
  location: { slug: string | null; heading: string | null } | null
  publication: {
    source_id: string | null
    source_title: string | null
    source_name: string | null
    source_url: string | null
  } | null
}

export const getCommentary = cache(async (id: string): Promise<Commentary | null> => {
  const data = await gql<{ commentary: RawCommentary[] }>(
    COMMENTARY_QUERY,
    { id: [id] },
    { revalidate: 3600 },
  )
  const c = data.commentary?.[0]
  if (!c) return null
  const p = c.publication ?? {}
  return {
    id: c.id,
    title: c.title ?? '',
    text: c.text ?? '',
    ref: c.location?.heading ?? '',
    locationSlug: c.location?.slug ?? '',
    publication: {
      source_id: (p as RawCommentary['publication'])?.source_id ?? '',
      source_title: (p as RawCommentary['publication'])?.source_title ?? '',
      source_name: (p as RawCommentary['publication'])?.source_name ?? '',
      source_url: (p as RawCommentary['publication'])?.source_url ?? '',
    },
  }
})

// Cover image id: the source_id zero-padded to 3 digits, e.g. 41 → "041", 111 → "111".
export function coverId(sourceId: string): string {
  return String(sourceId).padStart(3, '0')
}

// The PHP box assembles "{title} | Commentary on {ref} by {author}", appends the
// site suffix, then truncates the WHOLE string (suffix included) to 159 chars + '…'
// — a long commentary title gets cut mid-suffix ("…Book of Mormon O…"). buildMetadata
// only truncates descriptions, so we pre-truncate the full title here and pass it
// through with withSuffix:false.
export function commentaryTitle(c: Commentary): string {
  const full = `${c.title} | Commentary on ${c.ref} by ${c.publication.source_name} • Book of Mormon Online`
  return full.length > 159 ? full.slice(0, 159) + '…' : full
}
