import type { Metadata } from 'next'
import { getMaps } from '@/lib/maps'
import { buildMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const maps = await getMaps()
  return buildMetadata({
    title: 'Maps and Geography Models',
    description: maps.map((m) => m.name).join(' • '),
    path: '/map',
  })
}

export default async function MapIndexPage() {
  const maps = await getMaps()
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
      <h1>Maps and Geography Models • Book of Mormon Online</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <div dangerouslySetInnerHTML={{ __html: `<ul>${items}<ul>` }} />
    </>
  )
}
