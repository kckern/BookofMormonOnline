import type { Metadata } from 'next'
import { ABOUT_HTML } from '@/lib/about'
import { buildMetadata, currentLang } from '@/lib/seo'
import { label } from '@/lib/labels'
import { seoPageDescription } from '@/lib/seo-copy'
import { absoluteUrl } from '@/lib/seo'
import { webPage } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await currentLang()
  return buildMetadata({
    title: await label('about_bookofmormononline', 'About Book of Mormon Online'),
    description: seoPageDescription(lang, 'about'),
    path: '/about',
    fallbackKey: 'about',
    surface: 'website',
  })
}

export default async function AboutPage() {
  const lang = await currentLang()
  const title = await label('about_bookofmormononline', 'About Book of Mormon Online')
  return (
    <>
      <JsonLd data={webPage({ type: 'AboutPage', name: title, description: seoPageDescription(lang, 'about'), url: await absoluteUrl('/about'), lang })} />
      <h1>About Book of Mormon Online</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <div dangerouslySetInnerHTML={{ __html: ABOUT_HTML }} />
    </>
  )
}
