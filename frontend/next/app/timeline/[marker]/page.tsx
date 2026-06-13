import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTimelineEvent } from '@/lib/timeline'
import { buildMetadata } from '@/lib/seo'

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
// reproduce that and pass preTruncated so buildMetadata's own collapse/truncate
// is skipped — collapsing would shift the byte cut. Raw entities (&ldquo; &nbsp;
// &rsquo;) and a literal '"' are left as-is to match PHP's byte count; Next
// escapes the leading '&'/'"' in the emitted attribute — an accepted framework
// serialization deviation (same class as the history/text pages).
function phpDescription(html: string | null): string {
  const stripped = (html ?? '').replace(/<[^>]+>/g, '')
  return stripped.length > 159 ? stripped.slice(0, 159) + '…' : stripped
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { marker } = await params
  const e = await getTimelineEvent(marker)
  if (!e) return {}
  return buildMetadata({
    title: titleText(e),
    description: phpDescription(e.html),
    preTruncated: true,
    path: `/timeline/${marker}`,
  })
}

export default async function TimelineMarkerPage({ params }: Props) {
  const { marker } = await params
  const e = await getTimelineEvent(marker)
  if (!e) notFound()

  // heading carries raw &/"/curly-quote bytes and html is raw markup already
  // wrapped in its own <p>…</p> (giving PHP's <p><p>…</p></p>) — both go through
  // dangerouslySetInnerHTML to pass through byte-for-byte. React self-closes the
  // <img …/> (accepted deviation vs PHP's <img …>).
  return (
    <>
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
