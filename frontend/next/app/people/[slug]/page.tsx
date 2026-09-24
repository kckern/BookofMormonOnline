import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { getPerson } from '@/lib/people'
import { getPeopleList } from '@/lib/peopleplaces'
import { resolveSlug } from '@/lib/slug-variants'
import { SlugChooser, chooserMetadata, type ChooserCandidate } from '../../_components/SlugChooser'
import { buildMetadata, stripMarkup, absoluteUrl, currentLang } from '@/lib/seo'
import { superscript, wikiToHtml, wikiToText } from '@/lib/entity'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'
import { localizedOrFallback } from '@/lib/seo-copy'

interface Props { params: Promise<{ slug: string }> }

// Shared by generateMetadata and the page so both agree on the outcome.
// getPeopleList is cached, so the second call within a request is free.
async function resolvePeopleSlug(slug: string) {
  const people = await getPeopleList()
  const resolution = resolveSlug(slug, people.map((p) => p.slug))
  const candidates: ChooserCandidate[] =
    resolution.kind === 'chooser'
      ? resolution.candidates.map((s) => {
          const row = people.find((p) => p.slug === s)
          return { slug: s, name: row?.name ?? s, sub: row?.title ?? null }
        })
      : []
  return { resolution, candidates }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const lang = await currentLang()
  const [person, english] = await Promise.all([
    getPerson(slug, lang),
    lang === 'en' ? Promise.resolve(null) : getPerson(slug, 'en'),
  ])
  if (!person) {
    const { resolution, candidates } = await resolvePeopleSlug(slug)
    if (resolution.kind === 'chooser') {
      return chooserMetadata({ requested: slug, count: candidates.length, base: '/people' })
    }
    // 'redirect' never renders metadata (the page redirects first); 'none' 404s.
    return {}
  }

  const name = superscript(person.name)
  const localDescription = stripMarkup(wikiToText(person.description ?? ''))
  const englishDescription = stripMarkup(wikiToText(english?.description ?? ''))
  return buildMetadata({
    title: name,
    description: localizedOrFallback(lang, localDescription, englishDescription, name),
    path: `/people/${slug}`,
    ogSub: superscript(person.title ?? ''),
    ogImg: slug,
    ogImgType: 'people',
    surface: 'profile',
  })
}

export default async function PeoplePage({ params }: Props) {
  const { slug } = await params
  const lang = await currentLang()
  const [person, english] = await Promise.all([
    getPerson(slug, lang),
    lang === 'en' ? Promise.resolve(null) : getPerson(slug, 'en'),
  ])
  if (!person) {
    const { resolution, candidates } = await resolvePeopleSlug(slug)
    // 'exact' here means the lookup missed but the NORMALIZED slug exists — the
    // request used a non-canonical spelling (padding; the backend collation
    // already handles case). Send it to the canonical URL rather than 404ing,
    // so all four resolver outcomes are handled.
    if (resolution.kind === 'exact' || resolution.kind === 'redirect') {
      permanentRedirect(`/people/${resolution.slug}`)
    }
    if (resolution.kind === 'chooser') {
      return <SlugChooser requested={slug} candidates={candidates} base="/people" mediaType="people" />
    }
    notFound()
  }

  const name = superscript(person.name)
  const url = await absoluteUrl(`/people/${slug}`)
  const localDescription = stripMarkup(wikiToText(person.description ?? ''))
  const schemaDescription = localizedOrFallback(
    lang,
    localDescription,
    stripMarkup(wikiToText(english?.description ?? '')),
    name,
  )
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: 'People', url: await absoluteUrl('/people') },
      { name, url },
    ]),
    creativeWork({
      type: 'Person',
      name,
      description: schemaDescription,
      url,
      lang,
      image: `https://media.bookofmormon.online/people/${slug}`,
    }),
  ]

  return (
    <>
      <JsonLd data={ld} />
      <h1>{name}</h1>
      <h2>{superscript(person.title ?? '')}</h2>
      <p>
        <a href="/people">❮ Back</a>
      </p>
      <img
        className="thumb"
        alt={name}
        title={name}
        src={`https://media.bookofmormon.online/people/${slug}`}
      />
      <p dangerouslySetInnerHTML={{ __html: wikiToHtml(person.description ?? '') }} />
      <p>
        <a href="/people">❮ Back</a>
      </p>
    </>
  )
}
