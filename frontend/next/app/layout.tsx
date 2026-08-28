import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { DEFAULT_TITLE, DEFAULT_BODY, SITE_SUFFIX, truncateDesc } from '@/lib/seo'
import { headers } from 'next/headers'
import { bcp47 } from '@/lib/locales'

export const metadata: Metadata = {
  metadataBase: new URL('https://bookofmormon.online'),
  title: { default: DEFAULT_TITLE, template: `%s • ${SITE_SUFFIX}` },
  description: truncateDesc(DEFAULT_BODY),
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = bcp47((await headers()).get('x-lang') ?? 'en')
  return (
    <html lang={lang}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
