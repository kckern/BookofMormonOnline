import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTextBlock, contentBody } from '@/lib/text'
import { buildMetadata, stripMarkup } from '@/lib/seo'

interface Props {
  params: Promise<{ slug: string; blockno: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, blockno } = await params
  const id = Number(blockno)
  if (!Number.isInteger(id)) return {}
  const block = await getTextBlock(slug, id)
  if (!block) return {}

  return buildMetadata({
    title: `${block.heading} | ${block.sectionTitle}`,
    description: stripMarkup(block.content),
    path: `/${slug}/${blockno}`,
    ogSub: block.sectionTitle,
  })
}

export default async function TextBlockPage({ params }: Props) {
  const { slug, blockno } = await params
  const id = Number(blockno)
  if (!Number.isInteger(id)) notFound()
  const block = await getTextBlock(slug, id)
  if (!block) notFound()

  const here = `/${slug}/${blockno}`

  return (
    <>
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
