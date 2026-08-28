import { Fragment } from 'react'
import { notFound } from 'next/navigation'
import { getSection, type SectionBlock } from '@/lib/section'
import { getPageContent, type PageContent } from '@/lib/pages'
import { absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from './JsonLd'

// Content-tree section page. The PHP box emits the parent crumb (h2), the section
// title (h1), then one <section> per narration block. Each block's inner markup
// (<h3> ref link, <details>/<summary> synopsis, <p> verse body, and the
// <ul class="art"> image list) is built as a raw HTML string so the legacy
// whitespace, raw entities, and verse <p>/<blockquote> structure pass through
// byte-for-byte via dangerouslySetInnerHTML — the verse body already carries its
// own <p> wrapper, so we never re-wrap it.

// Art list — PHP renders an (always-present) <ul class="art">, empty when the
// block has no images. Images emit verbatim: alt/title/src with a self-closing
// `/>`, matching the PHP byte-for-byte (it does not HTML-escape the titles).
function artList(block: SectionBlock): string {
  const items = block.art
    .map(
      (a) =>
        `<li><a href="/art/${a.id}"><img alt="${a.title}" title="${a.title}" src="/art/${a.id}"/></a></li>`,
    )
    .join('\n\t\t\t\t\t')
  return items ? `<ul class="art">${items}\n\t\t\t\t\t</ul>` : `<ul class="art"></ul>`
}

// Inner HTML of one <section> (everything between <section> and </section>).
function blockInner(block: SectionBlock): string {
  return (
    `<h3><a href="/${block.slug}">${block.heading}</a></h3>\n` +
    `             <details>\n` +
    `             \t <summary>${block.description} </summary>\n` +
    `            ${block.body}</details>\n` +
    `            ${artList(block)}\n` +
    `            `
  )
}

// Page-index layout (<h1> + per-section <h2> link + <dl> of block links). Some
// content-tree slugs are capsulated *pages* — either pure pages (e.g.
// /lehites/nephis-vision) or slugs that are BOTH a page and a section, in which
// case the PHP box renders the page index. The <dd> narration may carry raw HTML
// (e.g. <em>…</em>), so it is emitted via dangerouslySetInnerHTML, not JSX-escaped.
function PageIndex({ page }: { page: PageContent }) {
  return (
    <>
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
                <dd dangerouslySetInnerHTML={{ __html: `${row.description.trim()} ` }} />
              </Fragment>
            ))}
          </dl>
        </Fragment>
      ))}
    </>
  )
}

export async function SectionView({ slug }: { slug: string }) {
  // Page-first: a slug that resolves to a page WITH sections is rendered as a page
  // index even when it is also a section (the PHP box prefers the page view).
  const page = await getPageContent(slug)
  if (page && page.sections.length > 0) {
    const pageLd = breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: page.title, url: await absoluteUrl(`/${page.slug}`) },
    ])
    return (
      <>
        <JsonLd data={pageLd} />
        <PageIndex page={page} />
      </>
    )
  }

  const data = await getSection(slug)
  if (!data) notFound()

  const url = await absoluteUrl(`/${slug}`)
  const lang = await currentLang()
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: data.parentTitle, url: await absoluteUrl(`/${data.parentSlug}`) },
      { name: data.title, url },
    ]),
    creativeWork({ type: 'Article', name: data.title, description: data.descParts.join(' '), url, lang }),
  ]

  return (
    <>
      <JsonLd data={ld} />
      <h2>
        <a href={`/${data.parentSlug}`}>{data.parentTitle}</a>
      </h2>
      <h1>{data.title}</h1>
      {data.blocks.map((block) => (
        <Fragment key={block.slug}>
          <section dangerouslySetInnerHTML={{ __html: blockInner(block) }} />
        </Fragment>
      ))}
    </>
  )
}
