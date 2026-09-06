import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPerson } from '@/lib/people'
import { buildMetadata, stripMarkup, absoluteUrl, currentLang } from '@/lib/seo'
import { superscript, wikiToHtml, wikiToText } from '@/lib/entity'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'
import { localizedOrFallback } from '@/lib/seo-copy'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const lang = await currentLang()
  const [person, english] = await Promise.all([
    getPerson(slug, lang),
    lang === 'en' ? Promise.resolve(null) : getPerson(slug, 'en'),
  ])
  if (!person) return {}

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
  if (!person) notFound()

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
