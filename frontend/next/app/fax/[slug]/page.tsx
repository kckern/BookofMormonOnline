import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFax } from '@/lib/fax'
import { buildMetadata } from '@/lib/seo'

interface Props { params: Promise<{ slug: string }> }

const SUFFIX = ' (Digital Facsimile)'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const fax = await getFax(slug)
  if (!fax) return {}
  return buildMetadata({
    title: `${fax.title}${SUFFIX}`,
    description: fax.info ?? '',
    path: `/fax/${slug}`,
  })
}

export default async function FaxDetailPage({ params }: Props) {
  const { slug } = await params
  const fax = await getFax(slug)
  if (!fax) notFound()

  // Detail page uses the plain title (no superscript — that quirk is index-only).
  // The <img> renders with a double space (alt="X"  title=) on the PHP box; React
  // emits a single-space self-closing tag, the one ACCEPTED body-diff deviation.
  // The info <p> is injected un-escaped (verbatim) to match the PHP box, which
  // emits raw '&'/UTF-8 rather than HTML entities.
  return (
    <>
      <h1>{`${fax.title}${SUFFIX}`}</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <img
        className="thumb"
        alt={fax.title}
        title={fax.title}
        src={`https://media.bookofmormon.online/fax/covers/${slug}`}
      />
      <p dangerouslySetInnerHTML={{ __html: fax.info ?? '' }} />
      <p>
        <a href="/fax">❮ Back</a>
      </p>
    </>
  )
}
