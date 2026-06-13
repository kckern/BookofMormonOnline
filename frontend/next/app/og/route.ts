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

  // Art image: numeric art ID → media CDN URL
  const artId = searchParams.get('img')
  const artUrl = artId
    ? `https://media.bookofmormon.online/art/square/${artId}.jpg`
    : undefined

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
