import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPerson } from '@/lib/people'
import { buildMetadata, stripMarkup } from '@/lib/seo'
import { superscript, wikiToHtml, wikiToText } from '@/lib/entity'

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
  })
}

export default async function PeoplePage({ params }: Props) {
  const { slug } = await params
  const person = await getPerson(slug)
  if (!person) notFound()

  const name = superscript(person.name)

  return (
    <>
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
