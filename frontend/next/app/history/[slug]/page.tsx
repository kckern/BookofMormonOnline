import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getHistoryDoc } from '@/lib/history'
import { buildMetadata, absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'

interface Props { params: Promise<{ slug: string }> }

// Meta description: the PHP box concatenates "{date}: {source} • {transcript}"
// then runs *only* strip_tags (no entity decode, no whitespace collapse) and
// hard-truncates to 159 chars + '…'. We reproduce that exactly here and pass
// preTruncated so buildMetadata's own collapse/truncate is skipped — collapsing
// would drop PHP's double-space after the empty source and shift the 159-char
// cut by a byte. Entities (&ldquo; &amp; &c) are left raw to match PHP's byte
// count; Next escapes the leading '&' to '&amp;' in the emitted attribute — an
// accepted framework serialization deviation (see notes below).
function phpDescription(doc: {
  date: string | null
  source: string | null
  transcript: string | null
}): string {
  const raw = `${doc.date ?? ''}: ${doc.source ?? ''} • ${doc.transcript ?? ''}`
  const stripped = raw.replace(/<[^>]+>/g, '') // PHP strip_tags: tags out, entities/spaces kept
  return stripped.length > 159 ? stripped.slice(0, 159) + '…' : stripped
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const doc = await getHistoryDoc(slug)
  if (!doc) return {}

  return buildMetadata({
    // Title is the document text, verbatim.
    title: doc.document ?? '',
    description: phpDescription(doc),
    preTruncated: true,
    path: `/history/${slug}`,
  })
}

export default async function HistoryDocPage({ params }: Props) {
  const { slug } = await params
  const doc = await getHistoryDoc(slug)
  if (!doc) notFound()

  const url = await absoluteUrl(`/history/${slug}`)
  const lang = await currentLang()
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: 'History', url: await absoluteUrl('/history') },
      { name: doc.document ?? '', url },
    ]),
    creativeWork({ type: 'Article', name: doc.document ?? '', description: phpDescription(doc), url, lang }),
  ]

  // The PHP box emits document/date/source/author/transcript VERBATIM — these
  // fields carry raw '&' (e.g. "Extract, &c"), raw '"'/apostrophes, and the
  // transcript is raw HTML (<p>, <del>, <i>, &amp;, &mdash; …). React would
  // entity-escape '&' in text children, so each goes through
  // dangerouslySetInnerHTML to pass through byte-for-byte.
  // h3 is always "{source} {author}" (a literal space between them): author-only
  // → " {author}", source-only → "{source} ", neither → " ".
  // img: bare "thumbs/" when id is null; React self-closes <img …/> (accepted
  // deviation vs PHP's <img …>). transcript wraps in <p><p>…</p></p> like PHP.
  return (
    <>
      <JsonLd data={ld} />
      <h1 dangerouslySetInnerHTML={{ __html: doc.document ?? '' }} />
      <h2 dangerouslySetInnerHTML={{ __html: doc.date ?? '' }} />
      <h3 dangerouslySetInnerHTML={{ __html: `${doc.source ?? ''} ${doc.author ?? ''}` }} />
      <p>
        <a href="/">❮ Community</a>
      </p>
      <img className="thumb" alt="" src={`https://media.bookofmormon.online/history/thumbs/${doc.id ?? ''}`} />
      <p dangerouslySetInnerHTML={{ __html: doc.transcript ?? '' }} />
      <p>
        <a href="/history">❮ Back</a>
      </p>
    </>
  )
}
