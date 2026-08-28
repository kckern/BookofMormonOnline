import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPlace } from '@/lib/places'
import { buildMetadata, stripMarkup, absoluteUrl, currentLang } from '@/lib/seo'
import { superscript, wikiToHtml, wikiToText } from '@/lib/entity'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'

// Shared by /place/:slug and /places/:slug (both 200 on the PHP box). The base
// is passed so canonical/og:url match the request path the visitor used.
export async function placeMetadata(slug: string, base: string): Promise<Metadata> {
  const place = await getPlace(slug)
  if (!place) return {}
  return buildMetadata({
    title: superscript(place.name),
    description: stripMarkup(wikiToText(place.description ?? '')),
    path: `${base}/${slug}`,
    ogSub: place.info ?? '',
    ogImg: slug,
    ogImgType: 'places',
  })
}

export async function PlaceView({ slug }: { slug: string }) {
  const place = await getPlace(slug)
  if (!place) notFound()

  const name = superscript(place.name)
  const url = await absoluteUrl(`/places/${slug}`)
  const lang = await currentLang()
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: 'Places', url: await absoluteUrl('/places') },
      { name, url },
    ]),
    creativeWork({
      type: 'Place',
      name,
      description: stripMarkup(wikiToText(place.description ?? '')),
      url,
      lang,
      image: `https://media.bookofmormon.online/places/${slug}`,
    }),
  ]

  return (
    <>
      <JsonLd data={ld} />
      <h1>{name}</h1>
      {place.info && (
        <h2>
          <a href={`/places/${slug}`}>{place.info}</a>
        </h2>
      )}
      <img
        className="thumb"
        alt={name}
        title={name}
        src={`https://media.bookofmormon.online/places/${slug}`}
      />
      <p dangerouslySetInnerHTML={{ __html: wikiToHtml(place.description ?? '') }} />
      {place.maps.length > 0 && (
        <>
          <h3>Map</h3>
          <ul>
            {place.maps.map((m) => (
              <li key={m.slug}>
                <a href={`/map/${m.slug}/place/${slug}`}>{m.name}</a>
              </li>
            ))}
          </ul>
        </>
      )}
      <p>
        <a href="/places">❮ Back</a>
      </p>
    </>
  )
}
