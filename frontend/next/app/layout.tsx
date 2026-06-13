import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { DEFAULT_TITLE, DEFAULT_BODY, SITE_SUFFIX, truncateDesc } from '@/lib/seo'

export const metadata: Metadata = {
  metadataBase: new URL('https://bookofmormon.online'),
  title: { default: DEFAULT_TITLE, template: `%s • ${SITE_SUFFIX}` },
  description: truncateDesc(DEFAULT_BODY),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
