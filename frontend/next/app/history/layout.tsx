import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// The whole /history subtree is noindex during cutover (feature is 'noindex' in
// features.yml). This metadata cascades to every history page; none sets its own
// `robots`, so it is not clobbered. The matching X-Robots-Tag header is set in
// middleware (App Router layouts cannot set response headers).
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function HistoryLayout({ children }: { children: ReactNode }) {
  return children
}
