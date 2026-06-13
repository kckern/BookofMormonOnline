import { Fragment } from 'react'
import type { Metadata } from 'next'
import { getPageContent } from '@/lib/pages'
import { buildMetadata, defaultMetadata } from '@/lib/seo'
import { DefaultShell } from '../_components/DefaultShell'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getPageContent(slug)
  // Unknown single-segment slug → generic shell metadata (PHP-box behavior).
  if (!page) return defaultMetadata(`/${slug}`)

  // PHP box: description = section titles joined by '. '.
  const description = page.sections.map((s) => s.title).join('. ')
  return buildMetadata({ title: page.title, description, path: `/${slug}` })
}

export default async function PageRoute({ params }: Props) {
  const { slug } = await params
  const page = await getPageContent(slug)
  if (!page) return <DefaultShell />

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
                <dd>{`${row.description} `}</dd>
              </Fragment>
            ))}
          </dl>
        </Fragment>
      ))}
    </>
  )
}
