import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { getPlace } from '@/lib/places'
import { getPlacesList } from '@/lib/peopleplaces'
import { resolveSlug } from '@/lib/slug-variants'
import { SlugChooser, chooserMetadata, type ChooserCandidate } from '../_components/SlugChooser'
import { buildMetadata, stripMarkup, absoluteUrl, currentLang } from '@/lib/seo'
import { superscript, wikiToHtml, wikiToText } from '@/lib/entity'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'
import { localizedOrFallback } from '@/lib/seo-copy'

// Shared by placeMetadata and PlaceView so both agree on the outcome.
// getPlacesList is cached, so the second call within a request is free.
async function resolvePlaceSlug(slug: string) {
  const places = await getPlacesList()
  const resolution = resolveSlug(slug, places.map((p) => p.slug))
  const candidates: ChooserCandidate[] =
    resolution.kind === 'chooser'
      ? resolution.candidates.map((s) => {
          const row = places.find((p) => p.slug === s)
          return { slug: s, name: row?.name ?? s, sub: row?.info ?? null }
        })
      : []
  return { resolution, candidates }
}

// Shared by /place/:slug and /places/:slug (both 200 on the PHP box). The base
// is passed so canonical/og:url match the request path the visitor used.
export async function placeMetadata(slug: string, base: string): Promise<Metadata> {
  const lang = await currentLang()
  const [place, english] = await Promise.all([
    getPlace(slug, lang),
    lang === 'en' ? Promise.resolve(null) : getPlace(slug, 'en'),
  ])
  if (!place) {
    const { resolution, candidates } = await resolvePlaceSlug(slug)
    if (resolution.kind === 'chooser') {
      return chooserMetadata({ requested: slug, count: candidates.length, base })
    }
    return {}
  }
  const name = superscript(place.name)
  const localDescription = stripMarkup(wikiToText(place.description ?? ''))
  const englishDescription = stripMarkup(wikiToText(english?.description ?? ''))
  return buildMetadata({
    title: name,
    description: localizedOrFallback(lang, localDescription, englishDescription, name),
    path: `${base}/${slug}`,
    ogSub: place.info ?? '',
    ogImg: slug,
    ogImgType: 'places',
  })
}

export async function PlaceView({ slug, base }: { slug: string; base: string }) {
  const lang = await currentLang()
  const [place, english] = await Promise.all([
    getPlace(slug, lang),
    lang === 'en' ? Promise.resolve(null) : getPlace(slug, 'en'),
  ])
  if (!place) {
    const { resolution, candidates } = await resolvePlaceSlug(slug)
    // See the people route: 'exact' after a miss is a non-canonical spelling.
    if (resolution.kind === 'exact' || resolution.kind === 'redirect') {
      permanentRedirect(`${base}/${resolution.slug}`)
    }
    if (resolution.kind === 'chooser') {
      return <SlugChooser requested={slug} candidates={candidates} base={base} mediaType="places" />
    }
    notFound()
  }

  const name = superscript(place.name)
  const url = await absoluteUrl(`${base}/${slug}`)
  const localDescription = stripMarkup(wikiToText(place.description ?? ''))
  const schemaDescription = localizedOrFallback(
    lang,
    localDescription,
    stripMarkup(wikiToText(english?.description ?? '')),
    name,
  )
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: 'Places', url: await absoluteUrl('/places') },
      { name, url },
    ]),
    creativeWork({
      type: 'Place',
      name,
      description: schemaDescription,
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
