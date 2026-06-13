import type { Metadata } from 'next'
import { getTimeline, timelineIndex } from '@/lib/timeline'
import { buildMetadata } from '@/lib/seo'

// The PHP /timeline index draws from the events that have a name (heading),
// in the resolver's y-order, with the last-seen era carried forward. Both the
// meta description and the body list use that same derived collection.
export async function generateMetadata(): Promise<Metadata> {
  const items = timelineIndex(await getTimeline())
  return buildMetadata({
    title: 'Timeline',
    description: items.map((i) => i.heading).join(' • '),
    path: '/timeline',
  })
}

export default async function TimelinePage() {
  const items = timelineIndex(await getTimeline())
  // Built as a raw string to reproduce the PHP template byte-for-byte: the name
  // carries a literal double space before "(date)", the description is the row's
  // own <p>…</p> html (yielding PHP's <p><p>…</p></p>), and the wrapper is the
  // PHP box's unclosed <ul> … <ul> inside the container div. heading/html are
  // passed through verbatim because they carry raw &/"/curly-quote bytes React
  // text-children would escape.
  const lis = items
    .map(
      (i) =>
        `<li><h2><a href="/timeline/${i.slug}">${i.heading}${i.date ? `  (${i.date})` : ''}</a></h2>` +
        `<img class="thumb" alt="" src="https://media.bookofmormon.online/timeline/art/${i.slug}">` +
        `<p>${i.html}</p></li>`,
    )
    .join('')

  return (
    <>
      <h1>Timeline</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <div dangerouslySetInnerHTML={{ __html: `<ul>${lis}<ul>` }} />
    </>
  )
}
