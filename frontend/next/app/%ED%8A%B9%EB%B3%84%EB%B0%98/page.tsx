import type { Metadata } from 'next'
import { StudyEditionView } from '../studyedition/_view'
import { STUDYEDITION_TITLE, STUDYEDITION_DESCRIPTION } from '@/lib/studyedition'
import { buildMetadata } from '@/lib/seo'

// Korean-path alias of /studyedition. Same body, but the PHP box gives this
// route its OWN canonical/og:url (/특별반, percent-encoded), so the metadata
// path differs from /studyedition.
export const metadata: Metadata = buildMetadata({
  title: STUDYEDITION_TITLE,
  description: STUDYEDITION_DESCRIPTION,
  path: '/특별반',
})

export default function StudyEditionAliasPage() {
  return <StudyEditionView />
}
