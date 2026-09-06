import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTimelineEvent } from '@/lib/timeline'
import { absoluteUrl, buildMetadata, currentLang, sanitizeMetadataText } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'
import { localizedOrFallback } from '@/lib/seo-copy'

interface Props { params: Promise<{ marker: string }> }

// h1/title text: "{heading} ({date})" with a SINGLE space before the paren when
// the row has its own date, else just "{heading}". (The index list uses a
// double space and carries dates forward; the detail page does neither.) An
// empty heading yields a leading space (" (date)") or an empty string, matching
// the PHP box's " (590 BC)" / "" markers.
function titleText(e: { heading: string | null; date: string | null }): string {
  const heading = e.heading ?? ''
  const date = (e.date ?? '').trim()
  return date ? `${heading} (${date})` : heading
}

// Meta description: the PHP box runs *only* strip_tags over the html (no entity
// decode, no whitespace collapse) and hard-truncates to 159 chars + '…'. We
// The source still arrives as legacy HTML; buildMetadata applies the shared
// metadata sanitizer and final length cap.
function phpDescription(html: string | null): string {
  const stripped = (html ?? '').replace(/<[^>]+>/g, '')
  return stripped.length > 159 ? stripped.slice(0, 159) + '…' : stripped
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { marker } = await params
  const lang = await currentLang()
  const [e, english] = await Promise.all([
    getTimelineEvent(marker, lang),
    lang === 'en' ? Promise.resolve(null) : getTimelineEvent(marker, 'en'),
  ])
  if (!e) return {}
  const title = titleText(e)
  return buildMetadata({
    title,
    description: localizedOrFallback(lang, phpDescription(e.html), phpDescription(english?.html ?? ''), title),
    path: `/timeline/${marker}`,
  })
}

export default async function TimelineMarkerPage({ params }: Props) {
  const { marker } = await params
  const lang = await currentLang()
  const [e, english] = await Promise.all([
    getTimelineEvent(marker, lang),
    lang === 'en' ? Promise.resolve(null) : getTimelineEvent(marker, 'en'),
  ])
  if (!e) notFound()
  const title = titleText(e)
  const url = await absoluteUrl(`/timeline/${marker}`)
  const schemaDescription = localizedOrFallback(lang, phpDescription(e.html), phpDescription(english?.html ?? ''), title)

  // heading carries raw &/"/curly-quote bytes and html is raw markup already
  // wrapped in its own <p>…</p> (giving PHP's <p><p>…</p></p>) — both go through
  // dangerouslySetInnerHTML to pass through byte-for-byte. React self-closes the
  // <img …/> (accepted deviation vs PHP's <img …>).
  return (
    <>
      <JsonLd data={[
        breadcrumb([{ name: 'Home', url: await absoluteUrl('/') }, { name: 'Timeline', url: await absoluteUrl('/timeline') }, { name: title, url }]),
        creativeWork({ type: 'Article', name: title, description: sanitizeMetadataText(schemaDescription), url, lang, image: `https://media.bookofmormon.online/timeline/art/${marker}` }),
      ]} />
      <h1 dangerouslySetInnerHTML={{ __html: titleText(e) }} />
      <p>
        <a href="/">❮ Community</a>
      </p>
      <img
        className="thumb"
        alt=""
        src={`https://media.bookofmormon.online/timeline/art/${marker}`}
      />
      <p dangerouslySetInnerHTML={{ __html: e.html ?? '' }} />
      <p>
        <a href="/timeline">❮ Back</a>
      </p>
    </>
  )
}
