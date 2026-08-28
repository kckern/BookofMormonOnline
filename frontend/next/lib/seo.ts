import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { HOST_LANG } from './locales'
import { getLabels } from './labels'

// Constants mirrored from the PHP SSR box head (the parity benchmark).
export const SITE_SUFFIX = 'Book of Mormon Online'
export const DEFAULT_TITLE = 'Book of Mormon Online: A Book of Mormon Study Resource'
// Full default body text (two paragraphs) — the PHP box renders this verbatim and
// derives the meta description from its first 159 chars.
export const DEFAULT_BODY =
  'Book of Mormon Online is an interactive study resource designed to enhance accessibility and comprehension of the Book of Mormon. The text is broken into digestible sections, each supplemented with narrative synopses emphasizing context and connections. The platform is enriched with images, commentary, audio resources, and quick links to a database featuring people, places, facsimiles, maps, and events within the Book of Mormon, supported by historical and analytical resources to facilitate comprehensive research and study. \n\nDesigned for both casual and serious students of the Book of Mormon, Book of Mormon Online provides a systematic, immersive study experience complete with context explanations and multimedia support. Whether the student is seeking a basic overview or detailed study, the website presents narrative expositions, doctrinal commentary, artistic interpretations, study groups, and other multimedia offerings to foster an engaging, interactive experience for gaining a thorough understanding and appreciation for the text, narratives, characters, and teachings of the Book of Mormon.'
// Default body paragraph is NOT in the labels table (verified) — per-language here.
// English = the existing DEFAULT_BODY constant; Korean captured from 몰몬경.kr.
const DEFAULT_BODY_BY_LANG: Record<string, string> = {
  en: DEFAULT_BODY,
  ko: '몰몬경·KR은 몰몬경의 글에 가능한 한 쉽게 접근할 수 있도록 도모하는 학습 자원이다. 문맥과 연결에 초점을 맞춰 정리된 소제목들과 구절 각각에 요약된 해설이 독자 친화적으로 글을 분할하여 이해를 돕는다.\n\n본문은 이미지, 해설, 오디오가 더해져 한층 보완되고 인물, 장소, 스캔 사본, 지도 및 사건들의 데이터베이스가 연결된다. 추가된 역사적이고 분석적인 자원들의 제공 역시 깊이 있는 연구와 학습이 가능하도록 해준다.',
}

// English short-circuits to the existing sync constants (labels are byte-identical);
// other languages compose from labels + the body table.
export async function getSiteChrome(): Promise<{ siteSuffix: string; defaultTitle: string; defaultBody: string }> {
  const lang = (await headers()).get('x-lang') ?? 'en'
  if (lang === 'en') return { siteSuffix: SITE_SUFFIX, defaultTitle: DEFAULT_TITLE, defaultBody: DEFAULT_BODY }
  const labels = await getLabels()
  const homeTitle = labels['home_title'] ?? SITE_SUFFIX
  const homeHeading = labels['home_heading']
  return {
    siteSuffix: homeTitle,
    defaultTitle: homeHeading ? `${homeTitle}: ${homeHeading}` : DEFAULT_TITLE,
    defaultBody: DEFAULT_BODY_BY_LANG[lang] ?? DEFAULT_BODY,
  }
}

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

// x-forwarded-host is client-influenced; only trust our own domain (+ localhost
// for dev/harness). Anything else falls back to the apex, so a crafted request
// can't inject an arbitrary canonical/og:url. Handles a comma-joined forwarded
// list and an optional :port.
function safeHost(candidate: string | null): string {
  const host = (candidate ?? '').split(',')[0].trim()
  const bare = host.split(':')[0].toLowerCase()
  const ok = bare === SITE_DOMAIN || bare.endsWith('.' + SITE_DOMAIN) || bare === 'localhost' || bare in HOST_LANG
  return ok ? host : SITE_DOMAIN
}

// Single source of truth for the head tag-set the PHP box emits, expressed as a
// Next.js Metadata object. Uses title.absolute for exact control so the layout
// template never double-appends the suffix.
export async function buildMetadata(input: SeoInput): Promise<Metadata> {
  const { title, description, path, withSuffix = true, preTruncated = false, ogSub } = input
  const { siteSuffix } = await getSiteChrome()
  const fullTitle = withSuffix ? `${title} • ${siteSuffix}` : title
  const desc = preTruncated ? description : truncateDesc(description)

  // og:image — our next/og route replaces the retired GD preview service.
  // Path-based identity keeps URLs clean and the card content matches the page.
  const ogParams = new URLSearchParams({ title })
  if (ogSub) ogParams.set('sub', ogSub)
  const ogImage = `/og?${ogParams.toString()}`

  const h = await headers()
  const host = safeHost(h.get('x-forwarded-host') ?? h.get('host'))
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const abs = `${proto}://${host}${path}`

  return {
    title: { absolute: fullTitle },
    description: desc,
    keywords: KEYWORDS,
    alternates: { canonical: abs },
    openGraph: {
      title: fullTitle,
      description: desc,
      url: abs,
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
export async function defaultMetadata(path = '/'): Promise<Metadata> {
  const { defaultTitle, defaultBody } = await getSiteChrome()
  return buildMetadata({ title: defaultTitle, description: defaultBody, path, withSuffix: false })
}
