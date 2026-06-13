import type { Metadata } from 'next'
import { getHistory, HISTORY_INTRO } from '@/lib/history'
import { buildMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Historical Sources Relating to the Book of Mormon',
    // Meta description is the intro paragraph, truncated to 159 chars + '…'.
    description: HISTORY_INTRO,
    path: '/history',
  })
}

export default async function HistoryPage() {
  const docs = await getHistory()
  // Built as a raw string to reproduce the PHP template byte-for-byte, including
  // its <ul> … <ul> (unclosed) wrapper inside the container div, the empty
  // <h3>/<p> placeholders, the bare thumbs/ image src, and the unescaped
  // document text (PHP emits the field verbatim, e.g. "Extract, &c").
  const items = docs
    .map(
      (d) =>
        `<li><h2><a href="/history/${d.slug}">${d.year} — ${d.document ?? ''}</a></h2>` +
        `<h3>${d.source ?? ''}</h3>` +
        `<img class="thumb" alt="" src="https://media.bookofmormon.online/history/thumbs/${d.id ?? ''}">` +
        `<p></p></li>`,
    )
    .join('')

  return (
    <>
      <h1>Historical Sources Relating to the Book of Mormon</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <p>{HISTORY_INTRO}</p>
      <div dangerouslySetInnerHTML={{ __html: `<ul>${items}<ul>` }} />
    </>
  )
}
