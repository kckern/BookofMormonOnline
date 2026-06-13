import type { Metadata } from 'next'
import { getPlacesList } from '@/lib/peopleplaces'
import { superscript } from '@/lib/entity'
import { buildMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const places = await getPlacesList()
  // PHP box derives the description from the raw (non-superscripted) names,
  // bullet-joined, then hard-truncates to 159 chars + '…'.
  return buildMetadata({
    title: 'Places in the Book of Mormon',
    description: places.map((p) => p.name).join(' • '),
    path: '/places',
  })
}

export default async function PlacesPage() {
  const places = await getPlacesList()
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
