import type { Metadata } from 'next'
import { HistoryIndex, historyMetadata } from '../_index'

// Static segment: wins over app/history/[slug]. The PHP box has no distinct SSR
// for this path — it renders the History index, differing only in canonical/og:url.
export async function generateMetadata(): Promise<Metadata> {
  return historyMetadata('/history/joseph-smith')
}

export default async function HistoryJosephSmithPage() {
  return <HistoryIndex />
}
