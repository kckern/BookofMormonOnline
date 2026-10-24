import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMatter, getMattersList, groupOf, isMatterGroup, MATTER_GROUPS, xrelHref } from '@/lib/matters'
import { buildMetadata, stripMarkup, absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork, webPage } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'

interface Props { params: Promise<{ slug: string }> }

const MEDIA = 'https://media.bookofmormon.online/matters'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const lang = await currentLang()
  if (isMatterGroup(slug)) {
    const g = MATTER_GROUPS.find((x) => x.key === slug)!
    return buildMetadata({
      title: `${g.title} matters in the Book of Mormon`,
      description: g.blurb,
      path: `/matters/${slug}`,
      surface: 'collection',
    })
  }
  const m = await getMatter(slug, lang)
  if (!m) return {}
  return buildMetadata({
    title: m.name,
    description: stripMarkup(m.description ?? '') || m.subtitle || m.name,
    path: `/matters/${slug}`,
    ogSub: m.subtitle ?? undefined,
    surface: 'article',
  })
}

export default async function MatterPage({ params }: Props) {
  const { slug } = await params
  const lang = await currentLang()

  if (isMatterGroup(slug)) {
    const g = MATTER_GROUPS.find((x) => x.key === slug)!
    const items = (await getMattersList(lang)).filter((m) => groupOf(m) === slug)
    return (
      <>
        <JsonLd
          data={webPage({
            type: 'CollectionPage',
            name: `${g.title} matters`,
            description: g.blurb,
            url: await absoluteUrl(`/matters/${slug}`),
            lang,
          })}
        />
        <h1>{`${g.title} matters`}</h1>
        <p>{g.blurb}</p>
        <p><a href="/matters">❮ All matters</a></p>
        <ul>
          {items.map((m) => (
            <li key={m.slug}>
              <a href={`/matters/${m.slug}`}>{m.name}</a>
              {m.subtitle ? <> — {m.subtitle}</> : null}
            </li>
          ))}
        </ul>
      </>
    )
  }

  const m = await getMatter(slug, lang)
  if (!m) notFound()
  const url = await absoluteUrl(`/matters/${slug}`)
  const refs = (m.index ?? []).filter((r) => r && r.ref)
  const related = (m.xrels ?? []).filter((x) => x.dst_name && xrelHref(x))
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: 'Matters', url: await absoluteUrl('/matters') },
      { name: m.name, url },
    ]),
    creativeWork({
      type: 'Article',
      name: m.name,
      description: stripMarkup(m.description ?? '') || m.subtitle || m.name,
      url,
      lang,
      image: `${MEDIA}/${slug}`,
    }),
  ]

  return (
    <>
      <JsonLd data={ld} />
      <h1>{m.name}</h1>
      {m.subtitle ? <h2>{m.subtitle}</h2> : null}
      <p><a href="/matters">❮ All matters</a></p>
      <img className="thumb" alt={m.name} title={m.name} src={`${MEDIA}/${slug}`} />
      <div dangerouslySetInnerHTML={{ __html: m.description ?? '' }} />
      {refs.length > 0 && (
        <>
          <h2>In the text</h2>
          <ul>
            {refs.map((r, i) => (
              <li key={`${r.slug}-${i}`}>
                <a href={`/${r.slug}`}>{r.ref}</a>
                {r.text ? <> — {r.text}</> : null}
              </li>
            ))}
          </ul>
        </>
      )}
      {related.length > 0 && (
        <>
          <h2>Related</h2>
          <ul>
            {related.map((x, i) => (
              <li key={`${x.dst_slug}-${i}`}>
                <a href={xrelHref(x)!}>{x.dst_name}</a>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
