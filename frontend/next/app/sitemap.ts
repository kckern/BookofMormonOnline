import type { MetadataRoute } from 'next'
import { gql } from '@/lib/graphql'

const BASE = 'https://bookofmormon.online'

interface DivisionRow { slug: string; pages: { slug: string }[] }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static high-priority pages
  const static_entries: MetadataRoute.Sitemap = [
    { url: BASE, priority: 1.0, changeFrequency: 'daily' },
    { url: `${BASE}/about`, priority: 0.5, changeFrequency: 'yearly' },
    { url: `${BASE}/people`, priority: 0.7, changeFrequency: 'monthly' },
    { url: `${BASE}/places`, priority: 0.7, changeFrequency: 'monthly' },
    { url: `${BASE}/timeline`, priority: 0.6, changeFrequency: 'monthly' },
    { url: `${BASE}/contents`, priority: 0.8, changeFrequency: 'monthly' },
  ]

  // Scripture chapters from the division tree
  let scripture_entries: MetadataRoute.Sitemap = []
  try {
    const data = await gql<{ division: DivisionRow[] }>(
      `query { division(slug: null) { slug pages { slug } } }`,
      {},
      { revalidate: 86400 }
    )
    for (const div of data.division ?? []) {
      for (const page of div.pages ?? []) {
        scripture_entries.push({
          url: `${BASE}/${div.slug}/${page.slug}`,
          priority: 0.9,
          changeFrequency: 'yearly',
        })
      }
    }
  } catch {
    // If backend is unreachable at build time, return static entries only
  }

  return [...static_entries, ...scripture_entries]
}
