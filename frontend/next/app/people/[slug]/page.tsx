import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPerson } from '@/lib/people'
import { buildMetadata, stripMarkup, absoluteUrl, currentLang } from '@/lib/seo'
import { superscript, wikiToHtml, wikiToText } from '@/lib/entity'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const person = await getPerson(slug)
  if (!person) return {}

  const name = superscript(person.name)
  return buildMetadata({
    title: name,
    description: stripMarkup(wikiToText(person.description ?? '')),
    path: `/people/${slug}`,
    ogSub: superscript(person.title ?? ''),
    ogImg: slug,
    ogImgType: 'people',
  })
}

export default async function PeoplePage({ params }: Props) {
  const { slug } = await params
  const person = await getPerson(slug)
  if (!person) notFound()

  const name = superscript(person.name)
  const url = await absoluteUrl(`/people/${slug}`)
  const lang = await currentLang()
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: 'People', url: await absoluteUrl('/people') },
      { name, url },
    ]),
    creativeWork({
      type: 'Person',
      name,
      description: stripMarkup(wikiToText(person.description ?? '')),
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
