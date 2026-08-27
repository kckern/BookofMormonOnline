import type { Metadata } from 'next'

// Constants mirrored from the PHP SSR box head (the parity benchmark).
export const SITE_SUFFIX = 'Book of Mormon Online'
export const DEFAULT_TITLE = 'Book of Mormon Online: A Book of Mormon Study Resource'
// Full default body text (two paragraphs) — the PHP box renders this verbatim and
// derives the meta description from its first 159 chars.
export const DEFAULT_BODY =
  'Book of Mormon Online is an interactive study resource designed to enhance accessibility and comprehension of the Book of Mormon. The text is broken into digestible sections, each supplemented with narrative synopses emphasizing context and connections. The platform is enriched with images, commentary, audio resources, and quick links to a database featuring people, places, facsimiles, maps, and events within the Book of Mormon, supported by historical and analytical resources to facilitate comprehensive research and study. \n\nDesigned for both casual and serious students of the Book of Mormon, Book of Mormon Online provides a systematic, immersive study experience complete with context explanations and multimedia support. Whether the student is seeking a basic overview or detailed study, the website presents narrative expositions, doctrinal commentary, artistic interpretations, study groups, and other multimedia offerings to foster an engaging, interactive experience for gaining a thorough understanding and appreciation for the text, narratives, characters, and teachings of the Book of Mormon.'
// Fixed nav list rendered in the default shell, in PHP-box order.
export const DEFAULT_NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/contents', label: 'Table of Contents' },
  { href: '/timeline', label: 'Timeline' },
  { href: '/map', label: 'Map' },
  { href: '/people', label: 'People' },
  { href: '/places', label: 'Places' },
  { href: '/fax', label: 'Facsimiles' },
  { href: '/about', label: 'About' },
]
const KEYWORDS = 'Mormon, Book of Mormon, Book of Mormon Study, Read the Book of Mormon'
const TWITTER_SITE = '@BkMormonOnline'
const FB_APP_ID = '806253479718989'
const SITE_DOMAIN = 'bookofmormon.online'

// The PHP box truncates every description to a hard 159 chars + '…' (no word
// boundary). Verified across root/page/textblock/people/place/about: len == 160.
// The PHP box collapses horizontal whitespace (spaces/tabs) but PRESERVES
// newlines, then hard-truncates to 159 chars + '…'. Newlines count toward the
// limit (visible on /about, whose description keeps a '\n\n' paragraph break).
export function truncateDesc(text: string, max = 159): string {
  const t = (text ?? '').replace(/[ \t]+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

// Strip [c]id[/c] citation markers and HTML tags from text-block content,
// decode the handful of entities the data contains, collapse whitespace.
export function stripMarkup(html: string): string {
  return (html ?? '')
    .replace(/\[c\][^\[]*\[\/c\]/g, ' ') // citation markers: [c]1012904101[/c]
    .replace(/<[^>]+>/g, '') // html tags — PHP strip_tags removes with no space
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ') // collapse spaces/tabs but keep newlines (see truncateDesc)
    .trim()
}

interface SeoInput {
  /** Page-specific title, e.g. "1 Nephi 5:17–19 | Lehi's Family Reunion". */
  title: string
  /** Raw description text; truncated to the PHP-box rule unless preTruncated. */
  description: string
  /** Route path used for canonical, og:url, and the og image. */
  path: string
  /** Append " • Book of Mormon Online" (default true; false for the literal default title). */
  withSuffix?: boolean
  /** Skip truncation when the caller already produced the final string. */
  preTruncated?: boolean
  /** Subtitle line drawn on the OG card (e.g. section name). */
  ogSub?: string
}

// Single source of truth for the head tag-set the PHP box emits, expressed as a
// Next.js Metadata object. Uses title.absolute for exact control so the layout
// template never double-appends the suffix.
export function buildMetadata(input: SeoInput): Metadata {
  const { title, description, path, withSuffix = true, preTruncated = false, ogSub } = input
  const fullTitle = withSuffix ? `${title} • ${SITE_SUFFIX}` : title
  const desc = preTruncated ? description : truncateDesc(description)

  // og:image — our next/og route replaces the retired GD preview service.
  // Path-based identity keeps URLs clean and the card content matches the page.
  const ogParams = new URLSearchParams({ title })
  if (ogSub) ogParams.set('sub', ogSub)
  const ogImage = `/og?${ogParams.toString()}`

  return {
    title: { absolute: fullTitle },
    description: desc,
    keywords: KEYWORDS,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description: desc,
      url: path,
      type: 'article',
      images: [{ url: ogImage, secureUrl: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      site: TWITTER_SITE,
      creator: TWITTER_SITE,
      title: fullTitle,
      description: desc,
      images: [ogImage],
    },
    other: {
      'fb:app_id': FB_APP_ID,
      'twitter:domain': SITE_DOMAIN,
    },
  }
}

// The generic fallback metadata the PHP box serves for any route it has no
// specific handler for (e.g. /search, /user, /objects, and the homepage).
export function defaultMetadata(path = '/'): Metadata {
  return buildMetadata({
    title: DEFAULT_TITLE,
    description: DEFAULT_BODY, // truncated to 159 by buildMetadata
    path,
    withSuffix: false,
  })
}
