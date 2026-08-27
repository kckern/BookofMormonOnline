import type { Metadata } from 'next'
import { StudyEditionView } from './_view'
import { STUDYEDITION_TITLE, STUDYEDITION_DESCRIPTION } from '@/lib/studyedition'
import { buildMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: STUDYEDITION_TITLE,
    description: STUDYEDITION_DESCRIPTION,
    path: '/studyedition',
  })
}

export default function StudyEditionPage() {
  return <StudyEditionView />
}
