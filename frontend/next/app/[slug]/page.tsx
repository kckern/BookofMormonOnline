import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getPage } from '@/lib/pages'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) return {}

  const h = await headers()
  const lang = h.get('x-lang') ?? 'en'
  const host = h.get('host') ?? 'bookofmormon.online'
  const desc = `${page.title} — Book of Mormon`
  const ogUrl = `https://${host}/og?${new URLSearchParams({ title: page.title, desc, lang })}`

  return {
    title: page.title,
    description: desc,
    openGraph: {
      title: page.title,
      description: desc,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: page.title, description: desc, images: [ogUrl] },
  }
}

export default async function PageRoute({ params }: Props) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) notFound()

  return (
    <main>
      <h1>{page.title}</h1>
    </main>
  )
}
