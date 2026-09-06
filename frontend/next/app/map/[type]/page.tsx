import type { Metadata } from 'next'
import { getMaps } from '@/lib/maps'
import { getMapDetail } from '@/lib/mapdetail'
import { absoluteUrl, buildMetadata, currentLang } from '@/lib/seo'
import { label } from '@/lib/labels'
import { breadcrumb, creativeWork, webPage } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'
import { localizedOrFallback, seoPageDescription } from '@/lib/seo-copy'

interface Props {
  params: Promise<{ type: string }>
}

// The maps INDEX list items, rendered as a raw string to reproduce the PHP
// template's <ul> … <ul> (unclosed) quirk. Shared with app/map/page.tsx's layout.
function indexItems(maps: { slug: string; name: string; desc: string | null }[]): string {
  return maps
    .map(
      (m) =>
        `<li><h2><a href="/map/${m.slug}">${m.name}</a></h2>` +
        `<img alt="${m.name}" title="${m.name}" class="thumb" src="https://media.bookofmormon.online/map/${m.slug}/${m.slug}">` +
        `<p>${m.desc ?? ''}</p></li>`,
    )
    .join('')
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params
  const lang = await currentLang()
  const [map, english] = await Promise.all([
    getMapDetail(type, lang),
    lang === 'en' ? Promise.resolve(null) : getMapDetail(type, 'en'),
  ])
  if (!map) {
    // Unknown map type → PHP serves the maps index page BODY, but keeps the
    // canonical/og:url at the requested /map/:type (verified /map/newyork).
    return buildMetadata({
      title: await label('bom_maps', 'Maps and Geography Models'),
      description: seoPageDescription(lang, 'maps'),
      path: `/map/${type}`,
      fallbackKey: 'maps',
      surface: 'collection',
    })
  }

  return buildMetadata({
    title: map.name,
    description: localizedOrFallback(lang, map.desc ?? '', english?.desc ?? '', map.name),
    path: `/map/${type}`,
  })
}

export default async function MapTypePage({ params }: Props) {
  const { type } = await params
  const lang = await currentLang()
  const [map, english] = await Promise.all([
    getMapDetail(type, lang),
    lang === 'en' ? Promise.resolve(null) : getMapDetail(type, 'en'),
  ])

  // Unknown map type (e.g. the legacy `newyork`, or any typo) → the PHP box falls
  // through to the maps INDEX page (HTTP 200), not a 404. Reproduce its layout.
  if (!map) {
    const maps = await getMaps()
    const title = await label('bom_maps', 'Maps and Geography Models')
    const description = seoPageDescription(lang, 'maps')
    return (
      <>
        <JsonLd data={webPage({ type: 'CollectionPage', name: title, description, url: await absoluteUrl(`/map/${type}`), lang })} />
        <h1>Maps and Geography Models • Book of Mormon Online</h1>
        <p>
          <a href="/">❮ Community</a>
        </p>
        <div dangerouslySetInnerHTML={{ __html: `<ul>${indexItems(maps)}<ul>` }} />
      </>
    )
  }

  const url = await absoluteUrl(`/map/${type}`)
  const schemaDescription = localizedOrFallback(lang, map.desc ?? '', english?.desc ?? '', map.name)

  // The detail page hard-codes the suffix into <h1> and renders an EMPTY
  // container — places are NOT listed in the body, only the unclosed-<ul> quirk
  // remains, even for maps with many places (verified neareast/panama). The desc
  // is emitted via dangerouslySetInnerHTML so apostrophes/quotes stay un-escaped
  // (PHP does not HTML-encode them; JSX would turn ' into &#x27;).
  return (
    <>
      <JsonLd data={[
        breadcrumb([{ name: 'Home', url: await absoluteUrl('/') }, { name: 'Maps', url: await absoluteUrl('/map') }, { name: map.name, url }]),
        creativeWork({ type: 'CreativeWork', name: map.name, description: schemaDescription, url, lang, image: `https://media.bookofmormon.online/map/${type}/${type}` }),
      ]} />
      <h1>{map.name} • Book of Mormon Online</h1>
      <p dangerouslySetInnerHTML={{ __html: map.desc ?? '' }} />
      <p>
        <a href="/map">❮ Back</a>
      </p>
      <div dangerouslySetInnerHTML={{ __html: `<ul><ul>` }} />
    </>
  )
}
