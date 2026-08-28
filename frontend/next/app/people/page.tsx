import type { Metadata } from 'next'
import { getPeopleList } from '@/lib/peopleplaces'
import { superscript } from '@/lib/entity'
import { buildMetadata } from '@/lib/seo'

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
  const people = await getPeopleList()
  // PHP box derives the description from the raw (non-superscripted) names,
  // bullet-joined, then hard-truncates to 159 chars + '…'.
  return buildMetadata({
    title: 'People in the Book of Mormon',
    description: people.map((p) => p.name).join(' • '),
    path: '/people',
  })
}

export default async function PeoplePage() {
  const people = await getPeopleList()
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
      <h1>People in the Book of Mormon</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <div dangerouslySetInnerHTML={{ __html: `<ul>${items}<ul>` }} />
    </>
  )
}
