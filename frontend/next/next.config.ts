import type { NextConfig } from 'next'

const config: NextConfig = {
  // Allow the GraphQL backend (same host) during SSR fetch
  experimental: {},
  // Phase 1-3: proxy unmigrated routes to CRA (port 8200).
  // NPM routes the whole domain to Next.js; this rewrite handles the rest.
  // Phase 4: remove this rewrites block when CRA is retired.
  async rewrites() {
    return {
      fallback: [
        {
          source: '/:path*',
          destination: 'http://localhost:8200/:path*',
        },
      ],
    }
  },

  // Suppress Next.js warning about cross-origin image URLs from media CDN
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.bookofmormon.online' },
    ],
  },

}

export default config
