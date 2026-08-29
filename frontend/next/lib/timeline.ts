import { cache } from 'react'
import { gql } from './graphql'

// One row of bom_timeline as the `timeline` resolver exposes it. The resolver
// ignores its `slug` arg and always returns every event ordered by the DB `y`
// column (legacy ORDER BY ['y']) — the same order the PHP box renders.
export interface TimelineEvent {
  id: string
  slug: string
  // `heading` is the event name; empty string on map-only markers (≈15 rows).
  heading: string | null
  // `date` is a free-form label ("594 BC", "34 AD - 200 AD", "Generations 1-30",
  // or "" when the row has no era of its own).
  date: string | null
  // `html` is the description, already wrapped in its own <p>…</p> by the data,
  // which is why the page renders <p><p>…</p></p>. Null/empty on map-only markers.
  html: string | null
}

const TIMELINE_QUERY = `query Timeline { timeline { id slug heading date html } }`

export const getTimeline = cache(async (): Promise<TimelineEvent[]> => {
  const d = await gql<{ timeline: TimelineEvent[] }>(TIMELINE_QUERY, {}, { revalidate: 3600 })
  return d.timeline ?? []
})

// The PHP /timeline index lists only events with a non-empty heading (map-only
// markers are skipped), in the resolver's y-order, and carries the last seen
// date forward onto any kept row whose own date is empty. We reproduce that
// here so both the body list and the meta description draw from one source.
export interface TimelineIndexItem {
  slug: string
  heading: string
  /** Effective date after carry-forward; '' when no prior row had one. */
  date: string
  html: string
}

export function timelineIndex(events: TimelineEvent[]): TimelineIndexItem[] {
  const out: TimelineIndexItem[] = []
  let lastDate = ''
  for (const e of events) {
    const heading = (e.heading ?? '').trim()
    if (!heading) continue // map-only marker — not listed
    const own = (e.date ?? '').trim()
    if (own) lastDate = own
    out.push({ slug: e.slug, heading: e.heading ?? '', date: lastDate, html: e.html ?? '' })
  }
  return out
}

// Detail selection: the PHP box does `WHERE slug=? LIMIT 1` with no ORDER BY,
// which on this PK-by-`id` table returns the lowest-`id` row for the slug. Some
// slugs repeat (zarahemla×3, land-northward×3, desolation×2, …); we mirror that
// exact pick by sorting matches by id and taking the first. Unlike the index,
// the detail page uses the row's OWN date — no carry-forward.
export const getTimelineEvent = cache(
  async (slug: string): Promise<TimelineEvent | null> => {
    const events = await getTimeline()
    const matches = events.filter((e) => e.slug === slug)
    if (!matches.length) return null
    matches.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    return matches[0]
  },
)
