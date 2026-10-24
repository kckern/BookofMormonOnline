import { cache } from 'react'
import { gql } from './graphql'

export interface MatterListItem {
  slug: string
  name: string
  subtitle: string | null
  branch: string | null
  specificity: string | null
  weight: number | null
}

export interface MatterXrel {
  rel: string | null
  dst_type: string | null
  dst_slug: string | null
  dst_name: string | null
}

export interface Matter extends MatterListItem {
  description: string | null
  index: { ref: string | null; slug: string | null; text: string | null }[] | null
  xrels: MatterXrel[] | null
}

// The canonical three-group split (branch × specificity), same rule as the app's
// /matters/<group> routes (webapp mattersFilterData.js).
export type MatterGroup = 'narrative' | 'material' | 'concepts'

export const MATTER_GROUPS: { key: MatterGroup; title: string; blurb: string }[] = [
  { key: 'narrative', title: 'Narrative', blurb: 'The particular things the story names: the Liahona, the sword of Laban, the brass plates.' },
  { key: 'material', title: 'Material', blurb: 'Kinds of things in the Book of Mormon world: tents, swords, coins, crops, buildings.' },
  { key: 'concepts', title: 'Concepts', blurb: 'Ideas and practices the text teaches or argues over: covenant, faith, apostasy.' },
]

export function groupOf(m: Pick<MatterListItem, 'branch' | 'specificity'>): MatterGroup {
  if (m.branch === 'concepts') return 'concepts'
  return m.specificity === 'instance' ? 'narrative' : 'material'
}

export function isMatterGroup(s: string): s is MatterGroup {
  return MATTER_GROUPS.some((g) => g.key === s)
}

const LIST_QUERY = `query MattersList { matter { slug name subtitle branch specificity weight } }`

// Whole list is ~476 rows; weight DESC from the resolver is preserved.
export const getMattersList = cache(async (lang?: string): Promise<MatterListItem[]> => {
  const d = await gql<{ matter: MatterListItem[] }>(LIST_QUERY, {}, { revalidate: 3600, ...(lang ? { lang } : {}) })
  return (d.matter ?? []).filter(Boolean)
})

const MATTER_QUERY = `
  query Matter($slug: [String]) {
    matter(slug: $slug) {
      slug name subtitle description branch specificity weight
      index { ref slug text }
      xrels { rel dst_type dst_slug dst_name }
    }
  }
`

export const getMatter = cache(async (slug: string, lang?: string): Promise<Matter | null> => {
  const d = await gql<{ matter: Matter[] }>(MATTER_QUERY, { slug: [slug] }, { revalidate: 86400, ...(lang ? { lang } : {}) })
  const m = d.matter?.[0]
  // The resolver tips paths to their last segment, so only an exact slug is a hit.
  return m && m.slug === slug ? m : null
})

// xrel destination → site path. Unknown destination types are not linked.
export function xrelHref(x: MatterXrel): string | null {
  if (!x.dst_slug) return null
  if (x.dst_type === 'people') return `/people/${x.dst_slug}`
  if (x.dst_type === 'places' || x.dst_type === 'place') return `/places/${x.dst_slug}`
  if (x.dst_type === 'matter' || x.dst_type === 'matters') return `/matters/${x.dst_slug}`
  return null
}
