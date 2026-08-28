import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCommentary, coverId, commentaryTitle } from '@/lib/commentary'
import { buildMetadata, stripMarkup, absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const c = await getCommentary(id)
  if (!c) return {}

  // The full title (with suffix) is pre-truncated to 159 + '…' by commentaryTitle,
  // so it is passed through verbatim (withSuffix:false). The description is the
  // commentary body text, stripped to plain text and truncated the standard way.
  return buildMetadata({
    title: commentaryTitle(c),
    withSuffix: false,
    description: stripMarkup(c.text),
    path: `/commentary/${id}`,
  })
}

export default async function CommentaryPage({ params }: Props) {
  const { id } = await params
  const c = await getCommentary(id)
  if (!c) notFound()

  const { source_id, source_title, source_name, source_url } = c.publication
  const url = await absoluteUrl(`/commentary/${id}`)
  const lang = await currentLang()
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: c.title, url },
    ]),
    creativeWork({ type: 'Article', name: c.title, description: stripMarkup(c.text), url, lang }),
  ]

  // Match the PHP box body byte-for-byte. The box renders <h1>, a <div class="source">
  // (external/archive <a target="_blank"> around the cover <img/>, then the caption
  // author link), the commentary <section> (raw HTML), the source-title <h3>, and the
  // References list — with no wrapping container. So this returns a Fragment whose
  // top-level element is the <h1>, exactly like the box.
  //
  // The source markup carries PHP quirks React text-children would mangle (the double
  // space before href, the self-closed <img/>) and the commentary `text` is raw HTML,
  // so those parts go through dangerouslySetInnerHTML. Title/source_name/source_title
  // also pass through raw because they carry '&'/'"'/curly quotes the box emits verbatim.
  const sourceDiv =
    `<a target="_blank"  href="${source_url}">\n` +
    `\t\t\t<img class="thumb" src="/source/cover/${coverId(source_id)}"/>\n` +
    `\t\t\t</a>\n` +
    `\t\t\t<div class="caption">\n` +
    `\t\t\t<a id="imglink" target="_blank"  href="${source_url}">${source_name}</a>\n` +
    `\t\t\t</div>`

  return (
    <>
      <JsonLd data={ld} />
      <h1 dangerouslySetInnerHTML={{ __html: c.title }} />
      <div className="source" dangerouslySetInnerHTML={{ __html: sourceDiv }} />
      <section dangerouslySetInnerHTML={{ __html: c.text }} />
      <h3
        dangerouslySetInnerHTML={{
          __html: `<a target="_blank" id="imglink"  href="${source_url}">${source_title}</a>`,
        }}
      />
      <h4>References</h4>
      <ul>
        <li>
          <a href={`/${c.locationSlug}`} dangerouslySetInnerHTML={{ __html: c.ref }} />
        </li>
      </ul>
    </>
  )
}
