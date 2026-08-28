import type { Metadata } from 'next'
import { ABOUT_HTML } from '@/lib/about'
import { buildMetadata, stripMarkup } from '@/lib/seo'
import { label } from '@/lib/labels'

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: await label('about_bookofmormononline', 'About Book of Mormon Online'),
    description: stripMarkup(ABOUT_HTML),
    path: '/about',
  })
}

export default function AboutPage() {
  return (
    <>
      <h1>About Book of Mormon Online</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <div dangerouslySetInnerHTML={{ __html: ABOUT_HTML }} />
    </>
  )
}
