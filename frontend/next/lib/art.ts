import { cache } from 'react'
import { gql } from './graphql'

// An art reference: the scripture block the illustration is anchored to. The PHP
// box renders one <li> per reference (Image.location is 1:1, so there is exactly
// one), linking to the block and showing its verse body.
export interface ArtRef {
  /** Full content-tree slug, e.g. "lehites/1" — its URL is `/${slug}`. */
  slug: string
  /** Scripture reference heading, e.g. "1 Nephi 1:4". */
  heading: string
  /** Verse body HTML (citation/image markers stripped), keeps its own <p>. */
  body: string
}
export interface Art {
  id: string
  title: string
  /** Artist/credit name; the PHP box prefixes it with "© ". */
  artist: string
  /** Credit URL; empty string when the source has no link. */
  link: string
  refs: ArtRef[]
  /** Verse text of the first reference, tags+markers stripped, for the meta description. */
  descText: string
}

const ART_QUERY = `
  query Art($id: [String]) {
    image(id: $id) {
      id
      title
      artist
      link
      location {
        slug
        heading
        content
      }
    }
  }
`

interface RawLocation {
  slug: string | null
  heading: string | null
  content: string | null
}
interface RawImage {
  id: string
  title: string | null
  artist: string | null
  link: string | null
  location: RawLocation | null
}

// Verse body for the <p> render: drop every [x]…[/x] data marker
// ([c]citation, [i]image, [v]verse, [a]audio…), convert the legacy `_`
// soft-space token, collapse the double spaces those removals leave behind, and
// tighten spaces before punctuation. Keeps the content's own <p> wrapper and the
// trailing space before </p> — matching the PHP box byte-for-byte.
function contentBody(content: string): string {
  return content
    .replace(/\[([a-z]+)\][^\]]*?\[\/\1\]/g, '')
    .replace(/_/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;—])/g, '$1')
    .trim()
}

// Verse text for the meta description: drop the markers, then PHP strip_tags (no
// replacement space), then collapse spaces. buildMetadata truncates to 159 + '…'.
function contentText(content: string): string {
  return content
    .replace(/\[([a-z]+)\][^\]]*?\[\/\1\]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export const getArt = cache(async (id: string): Promise<Art | null> => {
  const data = await gql<{ image: RawImage[] }>(ART_QUERY, { id: [id] }, { revalidate: 86400 })
  const img = data.image?.[0]
  if (!img) return null

  const loc = img.location
  const refs: ArtRef[] =
    loc && loc.slug
      ? [
          {
            slug: loc.slug,
            heading: loc.heading ?? '',
            body: contentBody(loc.content ?? ''),
          },
        ]
      : []

  return {
    id: String(img.id),
    title: img.title ?? '',
    artist: img.artist ?? '',
    link: img.link ?? '',
    refs,
    descText: loc?.content ? contentText(loc.content) : '',
  }
})
