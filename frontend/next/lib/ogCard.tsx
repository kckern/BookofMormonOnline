import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createElement } from 'react'
import * as opentype from 'opentype.js'
import { BomOgCard } from '@/app/og/BomOgCard'

// Shared 1200×630 social-card renderer — the greenfield replacement for the
// legacy PHP GD preview service (render.php). Used by BOTH /og (param-driven,
// referenced from page og:image meta) and /preview (path-driven, the img.*
// legacy-share endpoint). Layout matches the PHP card: gold plates logo +
// wordmark header, light content card with centered title/subtitle/gold-rule/
// description, and a gold-framed thumbnail.

const fontsDir = join(process.cwd(), 'public', 'fonts')
const robotoCondensedBold = readFileSync(join(fontsDir, 'RobotoCondensed-Bold.ttf'))
const robotoCondensedLight = readFileSync(join(fontsDir, 'RobotoCondensed-Light.ttf'))
const ibmPlexSansKRBold = readFileSync(join(fontsDir, 'IBMPlexSansKR-Bold.ttf'))
const ibmPlexSansKRRegular = readFileSync(join(fontsDir, 'IBMPlexSansKR-Regular.ttf'))
const ibmPlexSansKRLight = readFileSync(join(fontsDir, 'IBMPlexSansKR-Light.ttf'))

// The gold stacked-plates mark, embedded as a data URI (satori <img> needs a
// data URI or absolute URL; a data URI is deterministic and offline-safe).
const platesDataUri =
  'data:image/png;base64,' +
  readFileSync(join(process.cwd(), 'public', 'og', 'plates.png')).toString('base64')

// Parse the BOLD title fonts for text measurement (satori can't shrink-to-fit).
function toArrayBuffer(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}
const robotoBoldOtf = opentype.parse(toArrayBuffer(robotoCondensedBold))
const krBoldOtf = opentype.parse(toArrayBuffer(ibmPlexSansKRBold))

function textWidth(font: opentype.Font, text: string, size: number): number {
  try {
    return font.getAdvanceWidth(text, size)
  } catch {
    return text.length * size * 0.6 // conservative fallback if a glyph is missing
  }
}

// Balanced 2-line split: prefer breaking on spaces, else any character; pick the
// break that minimizes the WIDER line — avoids a lone trailing word/char (widow).
function balancedSplit(font: opentype.Font, text: string, size: number): [string, string] {
  const spaceBreaks: number[] = []
  for (let i = 1; i < text.length; i++) if (text[i - 1] === ' ') spaceBreaks.push(i)
  const breaks = spaceBreaks.length ? spaceBreaks : Array.from({ length: text.length - 1 }, (_, i) => i + 1)
  let best: [string, string] = [text, '']
  let bestMax = Infinity
  for (const p of breaks) {
    const a = text.slice(0, p).trim()
    const b = text.slice(p).trim()
    if (!a || !b) continue
    const m = Math.max(textWidth(font, a, size), textWidth(font, b, size))
    if (m < bestMax) {
      bestMax = m
      best = [a, b]
    }
  }
  return best
}

// Shrink the title to fit ONE line down to minSize; if it still overflows at
// minSize, wrap to two balanced lines and size back up to the largest that fits.
function fitTitle(
  font: opentype.Font,
  text: string,
  maxWidth: number,
  minSize = 30,
  maxSize = 54,
): { size: number; lines: string[] } {
  let lo = minSize
  let hi = maxSize
  let oneLine = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (textWidth(font, text, mid) <= maxWidth) {
      oneLine = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  if (oneLine >= minSize) return { size: oneLine, lines: [text] }

  lo = minSize
  hi = maxSize
  let size = minSize
  let lines = balancedSplit(font, text, minSize)
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const [a, b] = balancedSplit(font, text, mid)
    if (Math.max(textWidth(font, a, mid), textWidth(font, b, mid)) <= maxWidth) {
      size = mid
      lines = [a, b]
      lo = mid + 1
    } else hi = mid - 1
  }
  return { size, lines }
}

const MEDIA = 'https://media.bookofmormon.online'
const MEDIA_PATH: Record<string, (id: string) => string> = {
  art: (id) => `${MEDIA}/art/${id}`,
  people: (id) => `${MEDIA}/people/${id}`,
  places: (id) => `${MEDIA}/places/${id}`,
}

// Localized wordmark (PHP used the home_title label). English default; Korean
// site name + edition tag for ko. Other languages fall back to English.
const SITE_TITLE: Record<string, string> = { en: 'Book of Mormon Online', ko: '몰몬경·KR' }

export interface OgCardInput {
  title: string
  sub?: string
  desc?: string
  /** Thumbnail id/slug. */
  img?: string
  /** Which media collection `img` addresses. */
  imgType?: 'art' | 'people' | 'places'
  lang?: string
}

// Preflight the thumbnail so a missing image (404, common) degrades to a text
// card instead of crashing Satori. Sanitize the id (fetch normalizes '../', so
// an unsanitized value could traverse to another media path).
async function resolveArtUrl(img: string | undefined, imgType: string): Promise<string | undefined> {
  const build = MEDIA_PATH[imgType]
  if (!img || !/^[A-Za-z0-9_-]+$/.test(img) || !build) return undefined
  const url = build(img)
  try {
    const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
    return head.ok ? url : undefined
  } catch {
    return undefined
  }
}

// PHP wrapped the description to a fixed line count; satori clamps lines, but a
// hard char cap first avoids feeding satori a huge string (and keeps the cut on
// a word boundary rather than shearing a glyph at the box edge).
function clampDesc(desc: string | undefined): string | undefined {
  if (!desc) return undefined
  const clean = desc.replace(/\s+/g, ' ').trim()
  if (clean.length <= 500) return clean
  const cut = clean.slice(0, 500)
  return cut.slice(0, cut.lastIndexOf(' ')) + '…'
}

export async function renderOgCard(input: OgCardInput): Promise<ImageResponse> {
  const artUrl = await resolveArtUrl(input.img, input.imgType ?? 'art')
  const lang = input.lang ?? 'en'
  const isKorean = lang === 'ko'
  // Fit the title: shrink to one line, else two balanced lines (no widow).
  // The content column is 720px (art) / 1000px (no art) minus padding.
  const titleFit = fitTitle(
    isKorean ? krBoldOtf : robotoBoldOtf,
    input.title,
    artUrl ? 640 : 900,
  )
  return new ImageResponse(
    createElement(BomOgCard, {
      titleLines: titleFit.lines,
      titleFontSize: titleFit.size,
      sub: input.sub,
      desc: clampDesc(input.desc),
      artUrl,
      logoUrl: platesDataUri,
      siteTitle: SITE_TITLE[lang] ?? SITE_TITLE.en,
      // Korean cards render entirely in IBM Plex Sans KR (it carries Latin too,
      // for "KR"/numerals); Latin cards use RobotoCondensed. Registering the KR
      // font under the SAME name as RobotoCondensed did NOT work — satori keeps
      // the first font at a given weight (the Latin Bold, which lacks Korean
      // glyphs) and then falls back to a default face. A distinct family + a
      // fontFamily switch is what actually applies the right face.
      fontFamily: isKorean ? 'IBMPlexSansKR' : 'RobotoCondensed',
    }),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'RobotoCondensed', data: robotoCondensedBold, weight: 700, style: 'normal' },
        { name: 'RobotoCondensed', data: robotoCondensedLight, weight: 300, style: 'normal' },
        ...(isKorean
          ? [
              { name: 'IBMPlexSansKR', data: ibmPlexSansKRBold, weight: 700 as const, style: 'normal' as const },
              { name: 'IBMPlexSansKR', data: ibmPlexSansKRRegular, weight: 400 as const, style: 'normal' as const },
              { name: 'IBMPlexSansKR', data: ibmPlexSansKRLight, weight: 300 as const, style: 'normal' as const },
            ]
          : []),
      ],
    },
  )
}
