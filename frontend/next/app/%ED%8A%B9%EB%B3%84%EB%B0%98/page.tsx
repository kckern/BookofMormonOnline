import type { Metadata } from 'next'
import { StudyEditionView } from '../studyedition/_view'
import { STUDYEDITION_TITLE, STUDYEDITION_DESCRIPTION } from '@/lib/studyedition'
import { buildMetadata } from '@/lib/seo'
import { LANG_HOST } from '@/lib/locales'
import { creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'

// Korean-path alias of /studyedition. Same body, but the PHP box gives this
// route its OWN canonical/og:url (/특별반, percent-encoded), so the metadata
// path differs from /studyedition.
export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: STUDYEDITION_TITLE,
    description: STUDYEDITION_DESCRIPTION,
    path: '/특별반',
    canonicalUrl: `https://${LANG_HOST.ko}/%ED%8A%B9%EB%B3%84%EB%B0%98`,
    lang: 'ko',
    hreflang: false,
  })
}

export default async function StudyEditionAliasPage() {
  const url = `https://${LANG_HOST.ko}/%ED%8A%B9%EB%B3%84%EB%B0%98`
  return (
    <>
      <JsonLd data={creativeWork({ type: 'CreativeWork', name: STUDYEDITION_TITLE, description: STUDYEDITION_DESCRIPTION, url, lang: 'ko', image: `https://${LANG_HOST.ko}/og?title=%EB%AA%B0%EB%AA%AC%EA%B2%BD%E2%80%94%ED%8A%B9%EB%B3%84%EB%B0%98&lang=ko` })} />
      <StudyEditionView />
    </>
  )
}
