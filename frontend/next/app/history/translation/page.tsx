import type { Metadata } from 'next'
import { collectionByKey } from '@/lib/history'
import { CollectionPage, collectionMetadata } from '../_collection'

const C = collectionByKey('translation')!

// Static segment: wins over app/history/[slug].
export const generateMetadata = (): Promise<Metadata> => collectionMetadata(C)
export default function Page() {
  return <CollectionPage c={C} />
}
