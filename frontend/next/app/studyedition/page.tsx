import type { Metadata } from 'next'
import { StudyEditionView } from './_view'
import { STUDYEDITION_TITLE, STUDYEDITION_DESCRIPTION } from '@/lib/studyedition'
import { buildMetadata } from '@/lib/seo'
import { LANG_HOST } from '@/lib/locales'

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: STUDYEDITION_TITLE,
    description: STUDYEDITION_DESCRIPTION,
    path: '/studyedition',
    canonicalUrl: `https://${LANG_HOST.ko}/%ED%8A%B9%EB%B3%84%EB%B0%98`,
    lang: 'ko',
    hreflang: false,
  })
}

export default function StudyEditionPage() {
  return <StudyEditionView />
}
