import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createElement } from 'react'
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
const ibmPlexSansKR = readFileSync(join(fontsDir, 'IBMPlexSansKR-Regular.ttf'))

// The gold stacked-plates mark, embedded as a data URI (satori <img> needs a
// data URI or absolute URL; a data URI is deterministic and offline-safe).
const platesDataUri =
  'data:image/png;base64,' +
  readFileSync(join(process.cwd(), 'public', 'og', 'plates.png')).toString('base64')

const MEDIA = 'https://media.bookofmormon.online'
const MEDIA_PATH: Record<string, (id: string) => string> = {
  art: (id) => `${MEDIA}/art/${id}`,
  people: (id) => `${MEDIA}/people/${id}`,
  places: (id) => `${MEDIA}/places/${id}`,
}

// Localized wordmark (PHP used the home_title label). English default; Korean
// site name for ko. Other languages fall back to English until wired.
const SITE_TITLE: Record<string, string> = { en: 'Book of Mormon Online', ko: '몰몬경' }

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
  return new ImageResponse(
    createElement(BomOgCard, {
      title: input.title,
      sub: input.sub,
      desc: clampDesc(input.desc),
      artUrl,
      logoUrl: platesDataUri,
      siteTitle: SITE_TITLE[lang] ?? SITE_TITLE.en,
    }),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'RobotoCondensed', data: robotoCondensedBold, weight: 700, style: 'normal' },
        { name: 'RobotoCondensed', data: robotoCondensedLight, weight: 300, style: 'normal' },
        ...(isKorean
          ? [{ name: 'RobotoCondensed', data: ibmPlexSansKR, weight: 400 as const, style: 'normal' as const }]
          : []),
      ],
    },
  )
}
