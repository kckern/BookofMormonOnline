import type { Metadata } from 'next'
import { HISTORY_COLLECTIONS, getArchive } from '@/lib/history'
import { buildMetadata, currentLang, absoluteUrl } from '@/lib/seo'
import { label } from '@/lib/labels'
import { breadcrumb, webPage } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'

const DESCRIPTION =
  'Primary sources about the coming forth and early reception of the Book of Mormon: statements by Joseph Smith, the witnesses, accounts of the translation, reviews from its own day, and the lost 116 pages.'

export async function historyMetadata(path: string): Promise<Metadata> {
  return buildMetadata({
    title: await label('title_history', 'Historical Sources Relating to the Book of Mormon'),
    description: DESCRIPTION,
    path,
    surface: 'collection',
  })
}

// The hub: one entry per collection with its count. Individual documents are
// reached from the collection pages and stay noindex.
export async function HistoryIndex() {
  const lang = await currentLang()
  const counts = await Promise.all(HISTORY_COLLECTIONS.map(async (c) => (await getArchive(c.archive, lang)).length))
  const url = await absoluteUrl('/history')
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: 'History', url },
    ]),
    webPage({ type: 'CollectionPage', name: 'Historical Sources Relating to the Book of Mormon', description: DESCRIPTION, url, lang }),
  ]
  return (
    <>
      <JsonLd data={ld} />
      <h1>Historical Sources Relating to the Book of Mormon</h1>
      <p>{DESCRIPTION}</p>
      <ul>
        {HISTORY_COLLECTIONS.map((c, i) => (
          <li key={c.key}>
            <h2><a href={c.path}>{c.title}</a></h2>
            <p>{`${c.blurb} ${counts[i]} ${c.unit}.`}</p>
          </li>
        ))}
      </ul>
      <p>
        Part of this collection draws on the{' '}
        <a href="https://lib.byu.edu/collections/19th-century-publications-about-the-book-of-mormon/about/">
          19th-Century Publications about the Book of Mormon
        </a>{' '}
        archive published by the Maxwell Institute and housed in Digital Collections at the BYU Library.
      </p>
    </>
  )
}
