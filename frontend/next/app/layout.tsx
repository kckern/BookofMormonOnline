import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'
import { DEFAULT_TITLE, DEFAULT_BODY, SITE_SUFFIX, truncateDesc } from '@/lib/seo'
import { headers } from 'next/headers'
import { bcp47 } from '@/lib/locales'

export const metadata: Metadata = {
  metadataBase: new URL('https://bookofmormon.online'),
  title: { default: DEFAULT_TITLE, template: `%s • ${SITE_SUFFIX}` },
  description: truncateDesc(DEFAULT_BODY),
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' }],
    apple: [{ url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' }],
  },
}

export const viewport: Viewport = { themeColor: '#000000' }

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
