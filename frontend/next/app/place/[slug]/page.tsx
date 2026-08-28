import type { Metadata } from 'next'
import { PlaceView, placeMetadata } from '../PlaceView'

interface Props { params: Promise<{ slug: string }> }

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return params.then(({ slug }) => placeMetadata(slug, '/place'))
}

export default async function PlaceRoute({ params }: Props) {
  const { slug } = await params
  return <PlaceView slug={slug} base="/place" />
}
