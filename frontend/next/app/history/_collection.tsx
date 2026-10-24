import type { Metadata } from 'next'
import { getArchive, docYear, type HistoryCollection, type ArchiveDoc } from '@/lib/history'
import { buildMetadata, currentLang, absoluteUrl } from '@/lib/seo'
import { breadcrumb, webPage } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'

async function describe(c: HistoryCollection, lang: string): Promise<string> {
  const docs = await getArchive(c.archive, lang)
  const years = docs.map(docYear).filter((y): y is number => y !== null)
  const range = years.length ? ` from ${years[0]} to ${years[years.length - 1]}` : ''
  return `${c.blurb} ${docs.length} ${c.unit}${range}.`
}

export async function collectionMetadata(c: HistoryCollection): Promise<Metadata> {
  const lang = await currentLang()
  return buildMetadata({
    title: `${c.title}: historical sources on the Book of Mormon`,
    description: await describe(c, lang),
    path: c.path,
    surface: 'collection',
  })
}

function decadeLabel(y: number | null): string {
  return y === null ? 'Undated' : `${Math.floor(y / 10) * 10}s`
}

export async function CollectionPage({ c }: { c: HistoryCollection }) {
  const lang = await currentLang()
  const docs = await getArchive(c.archive, lang)
  const intro = await describe(c, lang)

  const groups: { label: string; items: ArchiveDoc[] }[] = []
  for (const d of docs) {
    const label = decadeLabel(docYear(d))
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(d)
    else groups.push({ label, items: [d] })
  }

  const url = await absoluteUrl(c.path)
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: 'History', url: await absoluteUrl('/history') },
      { name: c.title, url },
    ]),
    webPage({ type: 'CollectionPage', name: c.title, description: intro, url, lang }),
  ]

  return (
    <>
      <JsonLd data={ld} />
      <h1>{c.title}</h1>
      <p>{intro}</p>
      <p><a href="/history">❮ All historical sources</a></p>
      {groups.map((g) => (
        <section key={g.label}>
          <h2>{g.label}</h2>
          <ul>
            {g.items.map((d) => {
              const y = docYear(d)
              // Witness accounts: event_year is when it happened, year is when it was recorded.
              const when = d.event_year && d.year && d.event_year !== d.year ? `${d.event_year}, recorded ${d.year}` : y ? String(y) : ''
              const by = [d.author, d.source].filter(Boolean).join(', ')
              return (
                <li key={d.slug}>
                  <a href={`/history/${d.slug}`} dangerouslySetInnerHTML={{ __html: d.document ?? d.slug }} />
                  {when ? ` (${when})` : ''}
                  {by ? ` — ${by}` : ''}
                  {d.mini_quote ? ` — “${d.mini_quote}”` : ''}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}
