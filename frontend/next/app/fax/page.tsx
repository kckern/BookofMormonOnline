import type { Metadata } from 'next'
import { getFaxList, faxSuperscript } from '@/lib/fax'
import { buildMetadata, currentLang } from '@/lib/seo'
import { label } from '@/lib/labels'
import { seoPageDescription } from '@/lib/seo-copy'
import { absoluteUrl } from '@/lib/seo'
import { webPage } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'

const TITLE = 'Facsimiles of Historical Book of Mormon Editions'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await currentLang()
  return buildMetadata({
    title: await label('title_facsimilies', TITLE),
    description: seoPageDescription(lang, 'facsimiles'),
    path: '/fax',
    fallbackKey: 'facsimiles',
    surface: 'collection',
  })
}

export default async function FaxIndexPage() {
  const list = await getFaxList()
  const lang = await currentLang()
  const title = await label('title_facsimilies', TITLE)

  // Built as a raw string to reproduce the PHP template byte-for-byte: the data
  // (titles with apostrophes/ampersands, info text) is injected un-escaped, the
  // <img> alt/title carries the superscripted title, and the wrapper is the PHP
  // box's <div><ul> … <ul></div> (the trailing <ul> is unclosed, verbatim). Each
  // <li> keeps the exact tab/newline indentation of the legacy output.
  const items = list
    .map((f) => {
      const sup = faxSuperscript(f.title)
      return (
        `\t\t\t<li><h2><a href="/fax/${f.slug}">${f.title}</a></h2>\n` +
        `\t\t\t<img class="thumb" alt="${sup}" title="${sup}" src="https://media.bookofmormon.online/fax/covers/${f.slug}">\n` +
        `\t\t\t\t<p>${f.info}</p>\n` +
        `\t\t\t</li>\n` +
        `\t\t\t`
      )
    })
    .join('')

  return (
    <>
      <JsonLd data={webPage({ type: 'CollectionPage', name: title, description: seoPageDescription(lang, 'facsimiles'), url: await absoluteUrl('/fax'), lang })} />
      <h1>{TITLE}</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <div dangerouslySetInnerHTML={{ __html: `<ul>${items}<ul>` }} />
    </>
  )
}
