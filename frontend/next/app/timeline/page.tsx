import type { Metadata } from 'next'
import { getTimeline, timelineIndex } from '@/lib/timeline'
import { buildMetadata, currentLang } from '@/lib/seo'
import { label } from '@/lib/labels'
import { seoPageDescription } from '@/lib/seo-copy'
import { absoluteUrl } from '@/lib/seo'
import { webPage } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'

// The PHP /timeline index draws from the events that have a name (heading),
// in the resolver's y-order, with the last-seen era carried forward. Both the
// meta description and the body list use that same derived collection.
export async function generateMetadata(): Promise<Metadata> {
  const lang = await currentLang()
  return buildMetadata({
    title: await label('timeline_title', 'Timeline'),
    description: seoPageDescription(lang, 'timeline'),
    path: '/timeline',
    fallbackKey: 'timeline',
    surface: 'collection',
  })
}

export default async function TimelinePage() {
  const items = timelineIndex(await getTimeline())
  const lang = await currentLang()
  const title = await label('timeline_title', 'Timeline')
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
      <JsonLd data={webPage({ type: 'CollectionPage', name: title, description: seoPageDescription(lang, 'timeline'), url: await absoluteUrl('/timeline'), lang })} />
      <h1>Timeline</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <div dangerouslySetInnerHTML={{ __html: `<ul>${lis}<ul>` }} />
    </>
  )
}
