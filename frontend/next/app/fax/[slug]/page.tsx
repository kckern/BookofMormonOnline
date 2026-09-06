import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFax } from '@/lib/fax'
import { absoluteUrl, buildMetadata, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'
import { seoEntityDescription } from '@/lib/seo-copy'

interface Props { params: Promise<{ slug: string }> }

const SUFFIX = ' (Digital Facsimile)'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const fax = await getFax(slug)
  if (!fax) return {}
  const lang = await currentLang()
  const title = `${fax.title}${SUFFIX}`
  return buildMetadata({
    title,
    description: lang === 'en' || /[\u3131-\uD79D]/u.test(fax.info ?? '') ? (fax.info ?? '') : seoEntityDescription(lang, title),
    path: `/fax/${slug}`,
  })
}

export default async function FaxDetailPage({ params }: Props) {
  const { slug } = await params
  const fax = await getFax(slug)
  if (!fax) notFound()
  const url = await absoluteUrl(`/fax/${slug}`)
  const lang = await currentLang()
  const title = `${fax.title}${SUFFIX}`
  const description = lang === 'en' || /[\u3131-\uD79D]/u.test(fax.info ?? '')
    ? fax.info
    : seoEntityDescription(lang, title)

  // Detail page uses the plain title (no superscript — that quirk is index-only).
  // The <img> renders with a double space (alt="X"  title=) on the PHP box; React
  // emits a single-space self-closing tag, the one ACCEPTED body-diff deviation.
  // The info <p> is injected un-escaped (verbatim) to match the PHP box, which
  // emits raw '&'/UTF-8 rather than HTML entities.
  return (
    <>
      <JsonLd data={[
        breadcrumb([{ name: 'Home', url: await absoluteUrl('/') }, { name: 'Facsimiles', url: await absoluteUrl('/fax') }, { name: title, url }]),
        creativeWork({ type: 'CreativeWork', name: title, description, url, lang, image: `https://media.bookofmormon.online/fax/covers/${slug}` }),
      ]} />
      <h1>{`${fax.title}${SUFFIX}`}</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <img
        className="thumb"
        alt={fax.title}
        title={fax.title}
        src={`https://media.bookofmormon.online/fax/covers/${slug}`}
      />
      <p dangerouslySetInnerHTML={{ __html: fax.info ?? '' }} />
      <p>
        <a href="/fax">❮ Back</a>
      </p>
    </>
  )
}
