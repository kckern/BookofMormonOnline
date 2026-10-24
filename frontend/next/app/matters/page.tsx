import type { Metadata } from 'next'
import { getMattersList, groupOf, MATTER_GROUPS } from '@/lib/matters'
import { buildMetadata, currentLang, absoluteUrl } from '@/lib/seo'
import { webPage } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'

const DESCRIPTION =
  'Things, practices and ideas in the Book of Mormon, each with the verses that mention it: objects and places in the story, the material world, and the concepts the text teaches.'

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Matters of the Book of Mormon',
    description: DESCRIPTION,
    path: '/matters',
    surface: 'collection',
  })
}

export default async function MattersIndex() {
  const lang = await currentLang()
  const all = await getMattersList(lang)
  return (
    <>
      <JsonLd
        data={webPage({
          type: 'CollectionPage',
          name: 'Matters of the Book of Mormon',
          description: DESCRIPTION,
          url: await absoluteUrl('/matters'),
          lang,
        })}
      />
      <h1>Matters of the Book of Mormon</h1>
      <p>{DESCRIPTION}</p>
      {MATTER_GROUPS.map((g) => {
        const items = all.filter((m) => groupOf(m) === g.key)
        return (
          <section key={g.key}>
            <h2>
              <a href={`/matters/${g.key}`}>{g.title}</a>
            </h2>
            <p>{g.blurb}</p>
            <ul>
              {items.map((m) => (
                <li key={m.slug}>
                  <a href={`/matters/${m.slug}`}>{m.name}</a>
                  {m.subtitle ? <> — {m.subtitle}</> : null}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
