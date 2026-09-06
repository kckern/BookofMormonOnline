import type { Metadata } from 'next'
import { getPlacesList } from '@/lib/peopleplaces'
import { superscript } from '@/lib/entity'
import { buildMetadata, currentLang } from '@/lib/seo'
import { label } from '@/lib/labels'
import { seoPageDescription } from '@/lib/seo-copy'
import { absoluteUrl } from '@/lib/seo'
import { webPage } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await currentLang()
  return buildMetadata({
    title: await label('title_places', 'Places in the Book of Mormon'),
    description: seoPageDescription(lang, 'places'),
    path: '/places',
    fallbackKey: 'places',
    surface: 'collection',
  })
}

export default async function PlacesPage() {
  const places = await getPlacesList()
  const lang = await currentLang()
  const title = await label('title_places', 'Places in the Book of Mormon')
  // Built as a raw string to reproduce the PHP template byte-for-byte, including
  // its <ul> … <ul> (unclosed) wrapper and the <img class="thumb" alt="X"  title="X">
  // markup (double space, no self-close). Places use the place's `info` for the <p>.
  const items = places
    .map((p) => {
      const name = superscript(p.name)
      return (
        `<li><h2><a href="/places/${p.slug}">${name}</a></h2>` +
        `<img class="thumb" alt="${name}"  title="${name}" src="https://media.bookofmormon.online/places/${p.slug}">` +
        `<p>${p.info ?? ''}</p></li>`
      )
    })
    .join('')

  return (
    <>
      <JsonLd data={webPage({ type: 'CollectionPage', name: title, description: seoPageDescription(lang, 'places'), url: await absoluteUrl('/places'), lang })} />
      <h1>Places in the Book of Mormon</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <div dangerouslySetInnerHTML={{ __html: `<ul>${items}<ul>` }} />
      <p>
        <a href="/">❮ Community</a>
      </p>
    </>
  )
}
