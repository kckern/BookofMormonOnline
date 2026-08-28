import { Fragment } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTextBlock, contentBody } from '@/lib/text'
import { getPageContent } from '@/lib/pages'
import { sectionMetadata, getSection } from '@/lib/section'
import { SectionView } from '../_components/SectionView'
import { DefaultShell } from '../_components/DefaultShell'
import { buildMetadata, stripMarkup, defaultMetadata, absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'
import { seoIntentForPath } from '@/lib/features'

interface Props {
  params: Promise<{ path: string[] }>
}

// Catch-all for the legacy `/:pageSlug+/:textId?` surface (everything not claimed
// by a more-specific route: people/place/history/fax/map/about/contents/maps).
// Dispatch by path shape:
//   [a]                       → page index (division) or default shell
//   […, N]  (numeric tail)    → text block  (pageSlug = leading segments)
//   […, name] (non-numeric)   → section page (named content-tree node)
type Kind = 'textblock' | 'page' | 'section'
function classify(path: string[]): Kind {
  const last = path[path.length - 1]
  if (path.length >= 2 && /^\d+$/.test(last)) return 'textblock'
  if (path.length === 1) return 'page'
  return 'section'
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params
  if (seoIntentForPath('/' + path.join('/')) === 'remove') notFound()
  const kind = classify(path)

  if (kind === 'textblock') {
    const id = Number(path[path.length - 1])
    const pageSlug = path.slice(0, -1).join('/')
    const block = await getTextBlock(pageSlug, id)
    if (!block) return {}
    return buildMetadata({
      // block.slug is the FULL canonical path even when the request used a bare-leaf
      // alias (e.g. /zoramites/1 → reign-of-judges/zoramites/1), so the alias
      // canonicals to the full path and Google consolidates.
      title: `${block.heading} | ${block.sectionTitle}`,
      description: stripMarkup(block.content),
      path: `/${block.slug}`,
      ogSub: block.sectionTitle,
    })
  }

  if (kind === 'page') {
    const page = await getPageContent(path[0])
    if (!page) return defaultMetadata(`/${path[0]}`)
    const description = page.sections.map((s) => s.title).join('. ')
    return buildMetadata({ title: page.title, description, path: `/${path[0]}` })
  }

  return sectionMetadata(path.join('/'))
}

export default async function CatchAllPage({ params }: Props) {
  const { path } = await params
  if (seoIntentForPath('/' + path.join('/')) === 'remove') notFound()
  const kind = classify(path)

  if (kind === 'textblock') {
    const id = Number(path[path.length - 1])
    const pageSlug = path.slice(0, -1).join('/')
    const block = await getTextBlock(pageSlug, id)
    if (!block) notFound()
    // Full canonical path (resolves bare-leaf aliases to their hierarchical slug).
    const here = `/${block.slug}`
    const url = await absoluteUrl(here)
    const lang = await currentLang()
    const ld = [
      breadcrumb([
        { name: 'Home', url: await absoluteUrl('/') },
        ...(block.sectionTitle ? [{ name: block.sectionTitle, url: await absoluteUrl(`/${block.sectionSlug}`) }] : []),
        { name: block.heading, url },
      ]),
      creativeWork({ type: 'Article', name: block.heading, description: stripMarkup(block.content), url, lang }),
    ]
    return (
      <>
        <JsonLd data={ld} />
        <h1>
          <a href={here}>{block.heading}</a>
        </h1>
        <section dangerouslySetInnerHTML={{ __html: contentBody(block.content) }} />
        {block.sectionTitle && (
          <h2>
            From section: <a href={`/${block.sectionSlug}`}>{block.sectionTitle}</a>
          </h2>
        )}
        {block.pageTitle && (
          <h3>
            From page: <a href={`/${block.pageSlug}`}>{block.pageTitle}</a>
          </h3>
        )}
        {block.coms.length > 0 && (
          <>
            <h4>Commentary</h4>
            <ul>
              {block.coms.map((c) => (
                <li key={c.id}>
                  <a href={`/commentary/${c.id}`}>{c.title}</a>
                </li>
              ))}
            </ul>
          </>
        )}
        {(block.prev || block.next) && (
          <>
            <hr />
            <ul className="prevnext">
              {block.prev && (
                <li>
                  Previous: <a href={`/${block.prev.slug}`}>{block.prev.heading}</a>
                </li>
              )}
              {block.next && (
                <li>
                  Next: <a href={`/${block.next.slug}`}>{block.next.heading}</a>
                </li>
              )}
            </ul>
          </>
        )}
      </>
    )
  }

  if (kind === 'page') {
    const page = await getPageContent(path[0])
    if (!page) return <DefaultShell />
    const pageLd = breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: page.title, url: await absoluteUrl(`/${page.slug}`) },
    ])
    return (
      <>
        <JsonLd data={pageLd} />
        <h1>{page.title}</h1>
        {page.sections.map((section) => (
          <Fragment key={section.slug}>
            <h2>
              <a href={`/${section.slug}`}>{section.title}</a>
            </h2>
            <dl>
              {section.rows.map((row) => (
                <Fragment key={row.link}>
                  <dt>
                    <a href={`/${page.slug}/${row.link}`}>{row.heading}</a>
                  </dt>
                  <dd>{`${row.description} `}</dd>
                </Fragment>
              ))}
            </dl>
          </Fragment>
        ))}
      </>
    )
  }

  // section: the named content-tree node
  void getSection // (impl in lib/section + SectionView)
  return <SectionView slug={path.join('/')} />
}
