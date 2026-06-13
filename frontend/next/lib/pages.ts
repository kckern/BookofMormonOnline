import { cache } from 'react'
import { gql } from './graphql'

export interface PageData {
  slug: string
  title: string
  description: string | null
  ref: string | null
}

const PAGE_QUERY = `
  query Page($slug: [String]) {
    page(slug: $slug) {
      slug
      title
      description
      ref
    }
  }
`

export const getPage = cache(async (slug: string): Promise<PageData | null> => {
  try {
    const data = await gql<{ page: PageData[] }>(PAGE_QUERY, { slug: [slug] }, { revalidate: 3600 })
    return data.page?.[0] ?? null
  } catch {
    return null
  }
})
