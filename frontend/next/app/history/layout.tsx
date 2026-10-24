import type { ReactNode } from 'react'

// Indexing is decided per path by seoIntentForPath (buildMetadata + middleware):
// the hub and the five collection pages are crawlable, individual documents under
// /history/<slug> are `noindex, follow`.
export default function HistoryLayout({ children }: { children: ReactNode }) {
  return children
}
