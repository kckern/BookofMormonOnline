import { getPageContent } from '@/lib/pages'
import { getTextBlock } from '@/lib/text'
import { getSection } from '@/lib/section'
import { getPerson } from '@/lib/people'
import { getPlace } from '@/lib/places'
import { getArt } from '@/lib/art'
import { getCommentary } from '@/lib/commentary'
import { resolveReadCard } from '@/lib/scripture'
import { stripMarkup } from '@/lib/seo'
import { wikiToText, superscript } from '@/lib/entity'
import { LOCALE_SEGS } from '@/lib/locales'
import type { OgCardInput } from '@/lib/ogCard'

// Gather layer for the path-based preview card — the greenfield port of the PHP
// `preview/index.php` router + `gather/*.php` data scripts. Maps a content slug
// to the card fields {title, sub, desc, img} by reusing the SAME data functions
// the SSR pages already use (getPageContent / getTextBlock / getSection), so the
// preview stays in lock-step with the pages. render.php → lib/ogCard.

const SITE_TITLE = 'Book of Mormon Online'
const SITE_DESC =
  'An interactive Book of Mormon study resource — narrative synopses, commentary, ' +
  'people, places, maps, facsimiles, and events, with historical and analytical study tools.'

// PHP rotated a default art id when a page had no image; the renderer preflights
// the thumbnail and degrades to a text card if it 404s, so a stable per-slug pick
// is safe and cache-friendly.
function fallbackArt(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return String((h % 27) + 1)
}

function stripLocale(raw: string): string {
  const segs = raw.replace(/^\/+/, '').replace(/\/+$/, '').split('/').filter(Boolean)
  if (segs.length && LOCALE_SEGS.has(segs[0])) segs.shift()
  return segs.join('/')
}

function titleFromSlug(slug: string): string {
  const leaf = slug.split('/').pop() ?? ''
  const pretty = leaf.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
  return pretty || SITE_TITLE
}

export async function gatherPreview(rawSlug: string, lang: string): Promise<OgCardInput> {
  const slug = stripLocale(rawSlug ?? '')

  // home  (empty | home | home/<group>[/<post>])
  if (slug === '' || slug === 'home' || slug.startsWith('home/')) {
    return { title: SITE_TITLE, desc: SITE_DESC, img: fallbackArt('home'), lang }
  }
  // table of contents
  if (slug === 'contents' || slug.startsWith('contents/')) {
    return { title: 'Table of Contents', sub: SITE_TITLE, img: fallbackArt('contents'), lang }
  }

  // --- Entity routes (prefix-based, like the PHP router). leaf = last segment. ---
  const segs0 = slug.split('/')
  const first = segs0[0]
  const leaf = segs0[segs0.length - 1]

  // Scripture reader (a greenfield route not in the PHP box). The ref uses dots
  // (read/1.nephi.1, read/1.nephi.1.2, read/1.nephi.1.2-5) but may arrive path-split
  // (read/alma.32/21) — rejoin with '.'. The card renders scripture text in the reader's
  // Scripture face with the speaker's portrait + voice label (see lib/ogCard).
  if (first === 'read') {
    const ref = segs0.slice(1).join('.')
    const card = await resolveReadCard(ref).catch(() => null)
    if (card) {
      return {
        title: card.ref,
        desc: card.text,
        descFont: 'scripture',
        speaker: card.speaker,
        img: fallbackArt(slug),
        lang,
      }
    }
  }

  if (first === 'people' || first === 'person') {
    const person = await getPerson(leaf).catch(() => null)
    if (person) {
      return { title: superscript(person.name), sub: superscript(person.title ?? '') || undefined, desc: stripMarkup(wikiToText(person.description ?? '')), img: person.slug, imgType: 'people', lang }
    }
    return { title: 'People', sub: SITE_TITLE, img: fallbackArt('people'), lang }
  }
  if (first === 'place' || first === 'map') {
    const place = await getPlace(leaf).catch(() => null)
    if (place) {
      return { title: superscript(place.name), sub: place.info ?? undefined, desc: stripMarkup(wikiToText(place.description ?? '')), img: place.slug, imgType: 'places', lang }
    }
    return { title: 'Places', sub: SITE_TITLE, img: fallbackArt('places'), lang }
  }
  if (first === 'art') {
    const art = await getArt(leaf).catch(() => null)
    if (art) {
      const desc = [art.artist, art.descText].filter(Boolean).join(' • ')
      return { title: art.title, sub: art.artist || undefined, desc, img: art.id, imgType: 'art', lang }
    }
  }
  if (first === 'commentary') {
    const c = await getCommentary(leaf).catch(() => null)
    if (c) {
      return { title: c.title, sub: `Commentary on ${c.ref}`, desc: `${c.publication.source_name}: ${stripMarkup(c.text)}`, img: fallbackArt(slug), lang }
    }
  }

  // text block: "<pageSlug>/<n>"  (numeric segment, optionally trailed by /fax)
  const textMatch = slug.match(/^(.+?)\/(\d+)(?:\/fax.*)?$/)
  if (textMatch) {
    const [, pageSlug, num] = textMatch
    const block = await getTextBlock(pageSlug, Number(num)).catch(() => null)
    if (block) {
      return {
        title: block.heading,
        sub: block.sectionTitle,
        desc: stripMarkup(block.content),
        img: fallbackArt(slug),
        lang,
      }
    }
  }

  const segs = slug.split('/')

  // section: multi-segment, non-numeric leaf (a named content-tree node)
  if (segs.length >= 2) {
    const section = await getSection(slug).catch(() => null)
    if (section) {
      const desc = (section.descParts.join(' ').trim() || section.blocks.map((b) => b.description).join(' ')).trim()
      const art = section.blocks.flatMap((b) => b.art).find((a) => a?.id)?.id
      return { title: section.title, sub: section.parentTitle || SITE_TITLE, desc, img: art ?? fallbackArt(slug), lang }
    }
  }

  // page: single segment (a division/page index)
  const page = await getPageContent(segs[0]).catch(() => null)
  if (page) {
    const desc = page.sections.map((s) => s.title).filter(Boolean).join(' • ')
    return { title: page.title, desc, img: fallbackArt(slug), lang }
  }

  // Unrecognized route (history/timeline/tgc/ig/invite/studyedition/about/… —
  // niche types not individually ported): a clean title card keyed off the slug
  // leaf, so the endpoint always returns a valid image and never 500s.
  return { title: titleFromSlug(slug), sub: SITE_TITLE, img: fallbackArt(slug), lang }
}
