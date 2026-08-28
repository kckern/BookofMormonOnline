import { cache } from 'react'
import { gql } from './graphql'

export interface PlaceMap { slug: string; name: string }
export interface Place {
  slug: string
  name: string
  info: string | null
  description: string | null
  type: string | null
  location: string | null
  maps: PlaceMap[]
}

const PLACE_QUERY = `
  query Place($slug: [String]) {
    place(slug: $slug) {
      slug
      name
      info
      description
      type
      location
      maps { slug name }
    }
  }
`

export const getPlace = cache(async (slug: string): Promise<Place | null> => {
  const data = await gql<{ place: Place[] }>(PLACE_QUERY, { slug: [slug] }, { revalidate: 86400 })
  const place = data.place?.[0]
  if (!place) return null
  // `maps` is null for places not on any map — coalesce so render is safe.
  return { ...place, maps: place.maps ?? [] }
})
