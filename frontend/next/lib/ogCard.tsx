import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createElement } from 'react'
import { BomOgCard } from '@/app/og/BomOgCard'

// Shared 1200×630 social-card renderer — the greenfield replacement for the
// legacy PHP GD preview service (render.php). Used by BOTH /og (param-driven,
// referenced from page og:image meta) and /preview (path-driven, the img.*
// legacy-share endpoint). Ported design: blue field, gold corner frame, art
// thumbnail, title/sub/desc, Korean font fallback.

const fontsDir = join(process.cwd(), 'public', 'fonts')
const robotoCondensedBold = readFileSync(join(fontsDir, 'RobotoCondensed-Bold.ttf'))
const robotoCondensedLight = readFileSync(join(fontsDir, 'RobotoCondensed-Light.ttf'))
const ibmPlexSansKR = readFileSync(join(fontsDir, 'IBMPlexSansKR-Regular.ttf'))

const MEDIA = 'https://media.bookofmormon.online'
const MEDIA_PATH: Record<string, (id: string) => string> = {
  art: (id) => `${MEDIA}/art/${id}`,
  people: (id) => `${MEDIA}/people/${id}`,
  places: (id) => `${MEDIA}/places/${id}`,
}

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

export async function renderOgCard(input: OgCardInput): Promise<ImageResponse> {
  const artUrl = await resolveArtUrl(input.img, input.imgType ?? 'art')
  const isKorean = input.lang === 'ko'
  return new ImageResponse(
    createElement(BomOgCard, { title: input.title, sub: input.sub, desc: input.desc, artUrl }),
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
