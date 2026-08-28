import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createElement } from 'react'
import { BomOgCard } from './BomOgCard'

export const runtime = 'nodejs'
export const revalidate = 86400

// Load fonts once at module init (cached for the lifetime of the process)
const fontsDir = join(process.cwd(), 'public', 'fonts')
const robotoCondensedBold = readFileSync(join(fontsDir, 'RobotoCondensed-Bold.ttf'))
const robotoCondensedLight = readFileSync(join(fontsDir, 'RobotoCondensed-Light.ttf'))
const ibmPlexSansKR = readFileSync(join(fontsDir, 'IBMPlexSansKR-Regular.ttf'))

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const title = searchParams.get('title') ?? 'Book of Mormon'
  const sub   = searchParams.get('sub')   ?? undefined
  const desc  = searchParams.get('desc')  ?? undefined
  const lang  = searchParams.get('lang')  ?? 'en'

  // Thumbnail: id/slug + whitelisted type → media path. Sanitize (fetch normalizes
  // '../', so an unsanitized img could traverse to another media path). Preflight so a
  // missing image (404, common) degrades to a text card instead of crashing Satori.
  const MEDIA = 'https://media.bookofmormon.online'
  const imgId = searchParams.get('img')
  const imgType = searchParams.get('imgtype') ?? 'art'
  const MEDIA_PATH: Record<string, string> = {
    art: `${MEDIA}/art/${imgId}`,
    people: `${MEDIA}/people/${imgId}`,
    places: `${MEDIA}/places/${imgId}`,
  }
  let artUrl: string | undefined
  if (imgId && /^[A-Za-z0-9_-]+$/.test(imgId) && MEDIA_PATH[imgType]) {
    const candidate = MEDIA_PATH[imgType]
    try {
      const head = await fetch(candidate, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
      if (head.ok) artUrl = candidate
    } catch {
      /* unreachable/timeout → leave artUrl undefined (text card) */
    }
  }

  const isKorean = lang === 'ko'

  return new ImageResponse(
    createElement(BomOgCard, { title, sub, desc, artUrl }),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'RobotoCondensed', data: robotoCondensedBold,  weight: 700, style: 'normal' },
        { name: 'RobotoCondensed', data: robotoCondensedLight, weight: 300, style: 'normal' },
        ...(isKorean
          ? [{ name: 'RobotoCondensed', data: ibmPlexSansKR, weight: 400 as const, style: 'normal' as const }]
          : []),
      ],
    }
  )
}
