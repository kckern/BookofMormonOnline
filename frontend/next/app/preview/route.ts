import { headers } from 'next/headers'
import { renderOgCard } from '@/lib/ogCard'
import { gatherPreview } from '@/lib/preview'

export const runtime = 'nodejs'
export const revalidate = 86400

// Path-based social card — the greenfield replacement for the legacy PHP GD
// preview service at img.bookofmormon.online/<slug>. The middleware rewrites any
// img.* request to this route, passing the slug as `x-preview-q` and the host's
// language as `x-lang` (headers survive a rewrite; query params do not). Direct
// `?q=&lang=` access is also supported for testing.
export async function GET(request: Request) {
  const h = await headers()
  const sp = new URL(request.url).searchParams
  const q = h.get('x-preview-q') ?? sp.get('q') ?? ''
  const lang = h.get('x-lang') ?? sp.get('lang') ?? 'en'
  const input = await gatherPreview(q, lang)
  return renderOgCard(input)
}
