import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getArt } from '@/lib/art'
import { buildMetadata, absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const art = await getArt(id)
  if (!art) return {}
  const ref = art.refs[0]?.heading ?? ''
  return buildMetadata({
    title: `${art.title} | Illustration of ${ref}`,
    // PHP box: "{artist} • {verse text}", hard-truncated to 159 + '…'.
    description: `${art.artist} • ${art.descText}`,
    path: `/art/${id}`,
    ogSub: ref,
    ogImg: id,
    ogImgType: 'art',
  })
}

export default async function ArtPage({ params }: Props) {
  const { id } = await params
  const art = await getArt(id)
  if (!art) notFound()

  const url = await absoluteUrl(`/art/${id}`)
  const lang = await currentLang()
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: art.title, url },
    ]),
    creativeWork({
      type: 'CreativeWork',
      name: art.title,
      description: `${art.artist} • ${art.descText}`,
      url,
      lang,
      image: `https://media.bookofmormon.online/art/${id}`,
    }),
  ]

  // Each element is a direct child of <body> (no wrapper div), matching the PHP
  // box. The title- and credit-bearing elements carry raw HTML via
  // dangerouslySetInnerHTML because PHP does no entity-escaping — an apostrophe
  // like "Jerusalem's" must stay literal (React text children would escape it to
  // &#x27;). The references <ul> is raw so each verse <p> is a direct child of
  // its <li> (the body already opens with its own <p>…</p>). The <img>'s
  // alt/title attributes are the documented accepted deviation (React escapes
  // attribute values; invisible to parsers after entity-decode).
  const refsHtml = art.refs
    .map(
      (ref) =>
        `<li><h2><a href="/${ref.slug}">${ref.heading}</a></h2>${ref.body}</li>`,
    )
    .join('')

  return (
    <>
      <JsonLd data={ld} />
      <h1 dangerouslySetInnerHTML={{ __html: art.title }} />
      <img className="img" alt={art.title} title={art.title} src={`/art/${id}`} />
      <a href={art.link} dangerouslySetInnerHTML={{ __html: `© ${art.artist}` }} />
      <h4>References</h4>
      <ul dangerouslySetInnerHTML={{ __html: refsHtml }} />
    </>
  )
}
