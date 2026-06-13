import { cache } from 'react'
import { gql } from './graphql'

export interface MapItem {
  slug: string
  name: string
  desc: string | null
}

const MAPS_QUERY = `query Maps { maps { slug name desc } }`

export const getMaps = cache(async (): Promise<MapItem[]> => {
  try {
    const d = await gql<{ maps: MapItem[] }>(MAPS_QUERY, {}, { revalidate: 3600 })
    return d.maps ?? []
  } catch {
    return []
  }
})
