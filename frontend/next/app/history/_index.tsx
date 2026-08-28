import type { Metadata } from 'next'
import { getHistory, HISTORY_INTRO } from '@/lib/history'
import { buildMetadata } from '@/lib/seo'
import { label } from '@/lib/labels'

// Shared render + metadata for the History index. The PHP box serves byte-
// identical output for /history and for the static sub-paths /history/joseph-smith
// and /history/witnesses (no distinct SSR for the latter two), differing only in
// canonical/og:url. This module is the single source so all three stay in sync;
// each page passes its OWN path.
export async function historyMetadata(path: string): Promise<Metadata> {
  return buildMetadata({
    title: await label('title_history', 'Historical Sources Relating to the Book of Mormon'),
    // Meta description is the intro paragraph, truncated to 159 chars + '…'.
    description: HISTORY_INTRO,
    path,
  })
}

export async function HistoryIndex() {
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
