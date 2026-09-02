import { renderOgCard } from '@/lib/ogCard'

export const runtime = 'nodejs'
export const revalidate = 86400

// Param-driven social card, referenced from each page's og:image meta.
// The path-driven legacy endpoint (img.* shares) lives at /preview and reuses
// the same renderer (lib/ogCard).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  return renderOgCard({
    title: searchParams.get('title') ?? 'Book of Mormon',
    sub: searchParams.get('sub') ?? undefined,
    desc: searchParams.get('desc') ?? undefined,
    img: searchParams.get('img') ?? undefined,
    imgType: (searchParams.get('imgtype') as 'art' | 'people' | 'places' | null) ?? 'art',
    lang: searchParams.get('lang') ?? 'en',
  })
}
