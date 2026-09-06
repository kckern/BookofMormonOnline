import type { Metadata } from 'next'
import { getPeopleList } from '@/lib/peopleplaces'
import { superscript } from '@/lib/entity'
import { buildMetadata, currentLang } from '@/lib/seo'
import { label } from '@/lib/labels'
import { seoPageDescription } from '@/lib/seo-copy'
import { absoluteUrl } from '@/lib/seo'
import { webPage } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
}

// People titles superscript disambiguator digits even when a space separates the
// name from the number (PHP renders "Mighty Man 1" → "Mighty Man ¹"), which the
// shared `superscript` (letter-then-digit only) does not catch. Match a digit
// run that follows a letter with optional whitespace between.
function supTitle(s: string): string {
  return (s ?? '').replace(/(\p{L})(\s*)(\d+)/gu, (_m, l, ws, d: string) =>
    l + ws + d.replace(/\d/g, (x) => SUP[x]),
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await currentLang()
  return buildMetadata({
    title: await label('title_people', 'People in the Book of Mormon'),
    description: seoPageDescription(lang, 'people'),
    path: '/people',
    fallbackKey: 'people',
    surface: 'collection',
  })
}

export default async function PeoplePage() {
  const people = await getPeopleList()
  const lang = await currentLang()
  const title = await label('title_people', 'People in the Book of Mormon')
  // Built as a raw string to reproduce the PHP template byte-for-byte, including
  // its <ul> … <ul> (unclosed) wrapper and the <img class="thumb" alt="X"  title="X">
  // markup (double space, no self-close).
  const items = people
    .map((p) => {
      const name = superscript(p.name)
      return (
        `<li><h2><a href="/people/${p.slug}">${name}</a></h2>` +
        `<img class="thumb" alt="${name}"  title="${name}" src="https://media.bookofmormon.online/people/${p.slug}">` +
        `<p>${supTitle(p.title ?? '')}</p></li>`
      )
    })
    .join('')

  return (
    <>
      <JsonLd data={webPage({ type: 'CollectionPage', name: title, description: seoPageDescription(lang, 'people'), url: await absoluteUrl('/people'), lang })} />
      <h1>People in the Book of Mormon</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <div dangerouslySetInnerHTML={{ __html: `<ul>${items}<ul>` }} />
    </>
  )
}
