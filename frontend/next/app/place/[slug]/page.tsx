import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getPlace } from '@/lib/places'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const place = await getPlace(slug)
  if (!place) return {}

  const h = await headers()
  const lang = h.get('x-lang') ?? 'en'
  const host = h.get('host') ?? 'bookofmormon.online'
  const desc = place.description ?? place.info ?? `${place.name} — a place in the Book of Mormon`
  const ogUrl = `https://${host}/og?${new URLSearchParams({ title: place.name, sub: 'Place', desc, lang })}`

  return {
    title: place.name,
    description: desc,
    openGraph: {
      title: place.name,
      description: desc,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: place.name, description: desc, images: [ogUrl] },
  }
}

export default async function PlacePage({ params }: Props) {
  const { slug } = await params
  const place = await getPlace(slug)
  if (!place) notFound()

  return (
    <main>
      <h1>{place.name}</h1>
      {place.type && <p>Type: {place.type}</p>}
      {place.location && <p>Location: {place.location}</p>}
      {(place.description ?? place.info) && <p>{place.description ?? place.info}</p>}
    </main>
  )
}
