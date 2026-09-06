import type { Metadata } from 'next'
import { DefaultShell } from './_components/DefaultShell'
import { absoluteUrl, currentLang, defaultMetadata, getSiteChrome } from '@/lib/seo'
import { seoPageDescription } from '@/lib/seo-copy'
import { webSite } from '@/lib/jsonld'
import { JsonLd } from './_components/JsonLd'

// Bots get the generic study-resource shell here; humans are proxied to the CRA
// reader by middleware before this ever renders.
export async function generateMetadata(): Promise<Metadata> {
  return defaultMetadata('/')
}

export default async function RootPage() {
  const lang = await currentLang()
  const { defaultTitle } = await getSiteChrome()
  return (
    <>
      <JsonLd data={webSite(defaultTitle, seoPageDescription(lang, 'home'), await absoluteUrl('/'), lang)} />
      <DefaultShell />
    </>
  )
}
