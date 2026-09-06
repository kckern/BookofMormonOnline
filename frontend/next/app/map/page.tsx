import type { Metadata } from 'next'
import { getMaps } from '@/lib/maps'
import { buildMetadata, currentLang } from '@/lib/seo'
import { label } from '@/lib/labels'
import { seoPageDescription } from '@/lib/seo-copy'
import { absoluteUrl } from '@/lib/seo'
import { webPage } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await currentLang()
  return buildMetadata({
    title: await label('bom_maps', 'Maps and Geography Models'),
    description: seoPageDescription(lang, 'maps'),
    path: '/map',
    fallbackKey: 'maps',
    surface: 'collection',
  })
}

export default async function MapIndexPage() {
  const maps = await getMaps()
  const lang = await currentLang()
  const title = await label('bom_maps', 'Maps and Geography Models')
  // Built as a raw string to reproduce the PHP template byte-for-byte, including
  // its <ul> … <ul> (unclosed) wrapper inside the container div.
  const items = maps
    .map(
      (m) =>
        `<li><h2><a href="/map/${m.slug}">${m.name}</a></h2>` +
        `<img alt="${m.name}" title="${m.name}" class="thumb" src="https://media.bookofmormon.online/map/${m.slug}/${m.slug}">` +
        `<p>${m.desc ?? ''}</p></li>`,
    )
    .join('')

  return (
    <>
      <JsonLd data={webPage({ type: 'CollectionPage', name: title, description: seoPageDescription(lang, 'maps'), url: await absoluteUrl('/map'), lang })} />
      <h1>Maps and Geography Models • Book of Mormon Online</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <div dangerouslySetInnerHTML={{ __html: `<ul>${items}<ul>` }} />
    </>
  )
}
