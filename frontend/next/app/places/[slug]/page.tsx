import type { Metadata } from 'next'
import { PlaceView, placeMetadata } from '../../place/PlaceView'

interface Props { params: Promise<{ slug: string }> }

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return params.then(({ slug }) => placeMetadata(slug, '/places'))
}

export default async function PlacesRoute({ params }: Props) {
  const { slug } = await params
  return <PlaceView slug={slug} />
}
