import { Fragment } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveChapter, slugify, scripturePreview } from '@/lib/scripture'
import { buildMetadata } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'

const APEX = 'https://bookofmormon.online'

interface Props {
  params: Promise<{ ref: string[] }>
}

// Rebuild the all-dots ref read() accepts: decode each segment (hosts may percent-encode),
// join with '.'. ['alma.32','21'] → 'alma.32.21'; a single-segment range stays intact.
function rawRefOf(segments: string[]): string {
  return segments.map(decodeURIComponent).join('.')
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ref } = await params
  const res = await resolveChapter(rawRefOf(ref))
  if (!res) return {}
  const { chapterSlug, block } = res
  return buildMetadata({
    title: block.ref,
    description: scripturePreview(block),
    path: `/read/${chapterSlug}`,
    canonicalUrl: `${APEX}/read/${chapterSlug}`,
    lang: 'en',
    hreflang: false,
  })
}

export default async function ReadPage({ params }: Props) {
  const { ref } = await params
  const res = await resolveChapter(rawRefOf(ref))
  if (!res) notFound()
  const { chapterSlug, block } = res

  const canonical = `${APEX}/read/${chapterSlug}`
  const ld = [
    creativeWork({
      type: 'Article',
      name: block.ref,
      description: scripturePreview(block),
      url: canonical,
      lang: 'en',
    }),
    breadcrumb([
      { name: 'Home', url: `${APEX}/` },
      { name: block.ref, url: canonical },
    ]),
  ]

  return (
    <>
      <JsonLd data={ld} />
      <h1>{block.ref}</h1>
      {block.sections.map((section, si) => (
        <Fragment key={si}>
          {section.heading && <h2>{section.heading}</h2>}
          {section.blocks.map((unit, ui) => (
            <p key={ui}>
              {unit.lines.map((line) => (
                <Fragment key={line.verse_num}>
                  <sup>{line.verse_num}</sup> {line.text}{' '}
                </Fragment>
              ))}
            </p>
          ))}
        </Fragment>
      ))}
      <nav className="prevnext">
        {block.prev_ref && <a href={`/read/${slugify(block.prev_ref)}`}>❮ {block.prev_ref}</a>}
        {block.next_ref && <a href={`/read/${slugify(block.next_ref)}`}>{block.next_ref} ❯</a>}
      </nav>
    </>
  )
}
