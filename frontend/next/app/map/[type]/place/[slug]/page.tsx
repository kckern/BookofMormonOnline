import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { getPlace } from '@/lib/places'
import { getPlacesList } from '@/lib/peopleplaces'
import { resolveSlug } from '@/lib/slug-variants'
import { getMapDetail } from '@/lib/mapdetail'
import { absoluteUrl, buildMetadata, currentLang, stripMarkup } from '@/lib/seo'
import { superscript, wikiToHtml, wikiToText } from '@/lib/entity'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../../../_components/JsonLd'
import { localizedOrFallback } from '@/lib/seo-copy'

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
  const lang = await currentLang()
  const [place, map, english] = await Promise.all([
    getPlace(slug, lang),
    getMapDetail(type, lang),
    lang === 'en' ? Promise.resolve(null) : getPlace(slug, 'en'),
  ])
  if (!place) return {}
  const title = contextName(place.name, map?.name ?? '')
  return buildMetadata({
    title,
    description: localizedOrFallback(
      lang,
      stripMarkup(wikiToText(place.description ?? '')),
      stripMarkup(wikiToText(english?.description ?? '')),
      title,
    ),
    path: `/map/${type}/place/${slug}`,
    ogSub: place.info ?? '',
  })
}

export default async function MapPlacePage({ params }: Props) {
  const { type, slug } = await params
  const lang = await currentLang()
  const [place, map, english] = await Promise.all([
    getPlace(slug, lang),
    getMapDetail(type, lang),
    lang === 'en' ? Promise.resolve(null) : getPlace(slug, 'en'),
  ])
  if (!place) {
    // Redirect-only: a chooser inside a map context would strand the visitor
    // with no map. Multi-variant bare names keep their 404.
    const resolution = resolveSlug(slug, (await getPlacesList()).map((pl) => pl.slug))
    if (resolution.kind === 'exact' || resolution.kind === 'redirect') {
      permanentRedirect(`/map/${type}/place/${resolution.slug}`)
    }
    notFound()
  }

  const name = contextName(place.name, map?.name ?? '')
  const url = await absoluteUrl(`/map/${type}/place/${slug}`)
  const schemaDescription = localizedOrFallback(
    lang,
    stripMarkup(wikiToText(place.description ?? '')),
    stripMarkup(wikiToText(english?.description ?? '')),
    name,
  )

  return (
    <>
      <JsonLd data={[
        breadcrumb([{ name: 'Home', url: await absoluteUrl('/') }, { name: 'Maps', url: await absoluteUrl('/map') }, { name, url }]),
        creativeWork({ type: 'Place', name, description: schemaDescription, url, lang, image: `https://media.bookofmormon.online/places/${slug}` }),
      ]} />
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
