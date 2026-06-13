import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getReadBlock, scripturePreview } from '@/lib/scripture'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ slug: string; blockno: string }>
}

// Convert URL slug + block number to a ref the backend understands.
// e.g. slug="1-nephi", blockno="1" → ref="1-nephi-1"
// The backend's lookupReference accepts all-dash format (1-nephi-1) but not slash (1-nephi/1).
function toRef(slug: string, blockno: string) {
  return `${slug}-${blockno}`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, blockno } = await params
  const h = await headers()
  const lang = h.get('x-lang') ?? 'en'
  const ref = toRef(slug, blockno)
  const block = await getReadBlock(ref, lang)
  if (!block) return {}

  const heading = block.sections[0]?.heading ?? ref
  const desc = scripturePreview(block)
  const host = h.get('host') ?? 'bookofmormon.online'
  const ogUrl = `https://${host}/og?${new URLSearchParams({ title: heading, desc, lang })}`

  return {
    title: heading,
    description: desc,
    openGraph: {
      title: heading,
      description: desc,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: heading,
      description: desc,
      images: [ogUrl],
    },
  }
}

export default async function ScripturePage({ params }: Props) {
  const { slug, blockno } = await params
  const h = await headers()
  const lang = h.get('x-lang') ?? 'en'
  const ref = toRef(slug, blockno)
  const block = await getReadBlock(ref, lang)
  if (!block) notFound()

  const heading = block.sections[0]?.heading ?? ref

  return (
    <main>
      <h1>{heading}</h1>
      {block.sections.map((section, si) => (
        <section key={si}>
          {section.heading && si > 0 && <h2>{section.heading}</h2>}
          {section.blocks.map((unit, ui) => (
            <p key={ui}>
              {unit.lines.map((line, li) => (
                <span key={li} data-verse={line.verse_num}>
                  <sup>{line.verse_num}</sup>
                  {line.text}{' '}
                </span>
              ))}
            </p>
          ))}
        </section>
      ))}
      {/* TODO Phase 2: wire prev/next once backend returns URL-safe refs */}
      {(block.prev_ref || block.next_ref) && (
        <nav aria-label="Chapter navigation">
          {block.prev_ref && <span>← {block.prev_ref}</span>}
          {block.next_ref && <span>{block.next_ref} →</span>}
        </nav>
      )}
    </main>
  )
}
