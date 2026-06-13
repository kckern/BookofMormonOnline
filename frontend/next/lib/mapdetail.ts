import { cache } from 'react'
import { gql } from './graphql'

// ── map detail data ──────────────────────────────────────────────────────────
// Serves /map/:type and /map/:type/place/:slug. The maps resolver exposes 19
// map types; the sitemap also carries a legacy `newyork` map whose place URLs
// clone `panama`'s (see lib/sitemap.ts CLONED_MAPS). Crucially, the live PHP box
// does NOT expose a `newyork` map RECORD:
//   • /map/newyork           → falls back to the maps INDEX page (no such map)
//   • /map/newyork/place/…   → renders the PLACE with an EMPTY map name, e.g.
//                              "City of Ammonihah ( geography model)"
// So getMapDetail returns null for unknown/`newyork` types — callers decide the
// fallback (index page for the detail route; empty map name for the place route).

export interface MapDetail {
  slug: string
  name: string
  desc: string | null
  places: { slug: string; name: string }[]
}

const MAP_QUERY = `query MapDetail($slug: [String]) {
  maps(slug: $slug) { slug name desc places { slug name } }
}`

export const getMapDetail = cache(async (type: string): Promise<MapDetail | null> => {
  try {
    const d = await gql<{ maps: MapDetail[] }>(MAP_QUERY, { slug: [type] }, { revalidate: 3600 })
    const map = d.maps?.[0]
    if (!map) return null
    return { slug: map.slug, name: map.name, desc: map.desc ?? null, places: map.places ?? [] }
  } catch {
    return null
  }
})
