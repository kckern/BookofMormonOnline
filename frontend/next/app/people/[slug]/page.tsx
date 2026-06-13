import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getPerson } from '@/lib/people'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const person = await getPerson(slug)
  if (!person) return {}

  const h = await headers()
  const lang = h.get('x-lang') ?? 'en'
  const host = h.get('host') ?? 'bookofmormon.online'
  const title = person.title ? `${person.name} — ${person.title}` : person.name
  const desc = person.description ?? `${person.name} in the Book of Mormon`
  const ogUrl = `https://${host}/og?${new URLSearchParams({ title: person.name, sub: 'People', desc, lang })}`

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description: desc, images: [ogUrl] },
  }
}

export default async function PeoplePage({ params }: Props) {
  const { slug } = await params
  const person = await getPerson(slug)
  if (!person) notFound()

  return (
    <main>
      <h1>{person.name}</h1>
      {person.title && <p><em>{person.title}</em></p>}
      {person.classification && <p>Classification: {person.classification}</p>}
      {person.description && <p>{person.description}</p>}
    </main>
  )
}
