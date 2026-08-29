import { cache } from 'react'
import { gql } from './graphql'

// List rows for the /people and /places index pages. The PHP box renders the
// full people/place lists in bom_people/bom_places weight order — the greenfield
// backend exposes that exact ordered list via the no-arg `person`/`place`
// queries (the schema's top-level `people`/`places` fields have no resolver).

export interface PersonListItem {
  slug: string
  name: string
  title: string | null
}

export interface PlaceListItem {
  slug: string
  name: string
  info: string | null
}

const PEOPLE_LIST_QUERY = `query PeopleList { person { slug name title } }`
const PLACES_LIST_QUERY = `query PlacesList { place { slug name info } }`

export const getPeopleList = cache(async (): Promise<PersonListItem[]> => {
  const d = await gql<{ person: PersonListItem[] }>(PEOPLE_LIST_QUERY, {}, { revalidate: 3600 })
  return d.person ?? []
})

export const getPlacesList = cache(async (): Promise<PlaceListItem[]> => {
  const d = await gql<{ place: PlaceListItem[] }>(PLACES_LIST_QUERY, {}, { revalidate: 3600 })
  return d.place ?? []
})
