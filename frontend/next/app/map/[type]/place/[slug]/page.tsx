import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPlace } from '@/lib/places'
import { getMapDetail } from '@/lib/mapdetail'
import { buildMetadata, stripMarkup } from '@/lib/seo'
import { superscript, wikiToHtml, wikiToText } from '@/lib/entity'

interface Props {
  params: Promise<{ type: string; slug: string }>
}

// Map-context place title: "Jerusalem¹ (Near East geography model)". The map
// name is drawn from the {type} map context, the place name (with superscript
// disambiguator) from the place record. For map types with no resolver record
// (the legacy `newyork`), the map name is empty, giving "… ( geography model)"
// verbatim as the PHP box emits (verified /map/newyork/place/ammonihah).
function contextName(placeName: string, mapName: string): string {
  return `${superscript(placeName)} (${mapName} geography model)`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, slug } = await params
  const [place, map] = await Promise.all([getPlace(slug), getMapDetail(type)])
  if (!place) return {}
  return buildMetadata({
    title: contextName(place.name, map?.name ?? ''),
    description: stripMarkup(wikiToText(place.description ?? '')),
    path: `/map/${type}/place/${slug}`,
    ogSub: place.info ?? '',
  })
}

export default async function MapPlacePage({ params }: Props) {
  const { type, slug } = await params
  const [place, map] = await Promise.all([getPlace(slug), getMapDetail(type)])
  if (!place) notFound()

  const name = contextName(place.name, map?.name ?? '')

  return (
    <>
      <h1>{name}</h1>
      {place.info && (
        <h2
          dangerouslySetInnerHTML={{
            // Raw so apostrophes/quotes in the info line (e.g. 'Desolation of
            // Nehors') stay un-escaped, matching the PHP box (JSX would emit &#x27;).
            __html: `<a href="/places/${slug}">${place.info}</a>`,
          }}
        />
      )}
      <img
        className="thumb"
        alt={name}
        title={name}
        src={`https://media.bookofmormon.online/places/${slug}`}
      />
      <p dangerouslySetInnerHTML={{ __html: wikiToHtml(place.description ?? '') }} />
      <p>
        <a href="/places">❮ Back</a>
      </p>
    </>
  )
}
