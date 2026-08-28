import type { Metadata } from 'next'
import { getMaps } from '@/lib/maps'
import { getMapDetail } from '@/lib/mapdetail'
import { buildMetadata } from '@/lib/seo'
import { label } from '@/lib/labels'

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
  const map = await getMapDetail(type)
  if (!map) {
    // Unknown map type → PHP serves the maps index page BODY, but keeps the
    // canonical/og:url at the requested /map/:type (verified /map/newyork).
    const maps = await getMaps()
    return buildMetadata({
      title: await label('bom_maps', 'Maps and Geography Models'),
      description: maps.map((m) => m.name).join(' • '),
      path: `/map/${type}`,
    })
  }
  return buildMetadata({
    title: map.name,
    description: map.desc ?? '',
    path: `/map/${type}`,
  })
}

export default async function MapTypePage({ params }: Props) {
  const { type } = await params
  const map = await getMapDetail(type)

  // Unknown map type (e.g. the legacy `newyork`, or any typo) → the PHP box falls
  // through to the maps INDEX page (HTTP 200), not a 404. Reproduce its layout.
  if (!map) {
    const maps = await getMaps()
    return (
      <>
        <h1>Maps and Geography Models • Book of Mormon Online</h1>
        <p>
          <a href="/">❮ Community</a>
        </p>
        <div dangerouslySetInnerHTML={{ __html: `<ul>${indexItems(maps)}<ul>` }} />
      </>
    )
  }

  // The detail page hard-codes the suffix into <h1> and renders an EMPTY
  // container — places are NOT listed in the body, only the unclosed-<ul> quirk
  // remains, even for maps with many places (verified neareast/panama). The desc
  // is emitted via dangerouslySetInnerHTML so apostrophes/quotes stay un-escaped
  // (PHP does not HTML-encode them; JSX would turn ' into &#x27;).
  return (
    <>
      <h1>{map.name} • Book of Mormon Online</h1>
      <p dangerouslySetInnerHTML={{ __html: map.desc ?? '' }} />
      <p>
        <a href="/map">❮ Back</a>
      </p>
      <div dangerouslySetInnerHTML={{ __html: `<ul><ul>` }} />
    </>
  )
}
