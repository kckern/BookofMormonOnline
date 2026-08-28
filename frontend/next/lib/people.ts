import { cache } from 'react'
import { gql } from './graphql'

export interface Person {
  slug: string
  name: string
  title: string | null
  classification: string | null
  description: string | null
}

const PERSON_QUERY = `
  query Person($slug: [String]) {
    person(slug: $slug) {
      slug
      name
      title
      classification
      description
    }
  }
`

export const getPerson = cache(async (slug: string): Promise<Person | null> => {
  const data = await gql<{ person: Person[] }>(PERSON_QUERY, { slug: [slug] }, { revalidate: 86400 })
  return data.person?.[0] ?? null
})
