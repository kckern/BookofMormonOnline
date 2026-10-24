import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFax } from '@/lib/fax'
import { refFromSlug } from '@/lib/faxref'
import { buildMetadata, absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb } from '@/lib/jsonld'
import { JsonLd } from '../../../_components/JsonLd'

interface Props { params: Promise<{ slug: string; page: string }> }

// /fax/:edition/:page — a page number, a roman-numeral front-matter page, or a
// scripture-ref slug ("alma.32.21", "1.nephi.3.7") that opens that verse's hotspot.
// These are share targets: they get their own title + preview text, but they are
// noindex (hundreds of near-identical scan pages per edition).
const PAGE_SLUG = /^[a-z0-9.~]+$/i

function describe(editionTitle: string, page: string): { heading: string; description: string } {
  const isRoman = /^[ivxlcdm]+$/i.test(page)
  const ref = !/^\d+$/.test(page) && !isRoman ? refFromSlug(page) : null
  if (ref) {
    return {
      heading: `${ref} in the ${editionTitle}`,
      description: `${ref} as it appears in the ${editionTitle} of the Book of Mormon, shown on the original printed page.`,
    }
  }
  const label = isRoman ? `page ${page.toLowerCase()}` : `page ${page}`
  return {
    heading: `${editionTitle}, ${label}`,
    description: `A scan of ${label} of the ${editionTitle} of the Book of Mormon, with the verses on the page linked to the text.`,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page } = await params
  const fax = await getFax(slug)
  if (!fax || !PAGE_SLUG.test(page)) return {}
  const { heading, description } = describe(fax.title, page)
  return buildMetadata({
    title: heading,
    description,
    path: `/fax/${slug}/${page}`,
    ogSub: 'Digital Facsimile',
    noindex: true,
  })
}

export default async function FaxPageRoute({ params }: Props) {
  const { slug, page } = await params
  const fax = await getFax(slug)
  if (!fax || !PAGE_SLUG.test(page)) notFound()
  const { heading, description } = describe(fax.title, page)
  const url = await absoluteUrl(`/fax/${slug}/${page}`)
  void (await currentLang())
  return (
    <>
      <JsonLd data={breadcrumb([
        { name: 'Home', url: await absoluteUrl('/') },
        { name: 'Facsimiles', url: await absoluteUrl('/fax') },
        { name: fax.title, url: await absoluteUrl(`/fax/${slug}`) },
        { name: heading, url },
      ])} />
      <h1>{heading}</h1>
      <p>{description}</p>
      <p><a href={`/fax/${slug}`}>❮ {fax.title}</a></p>
    </>
  )
}
