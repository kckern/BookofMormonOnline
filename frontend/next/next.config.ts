import type { NextConfig } from 'next'

const config: NextConfig = {
  // Allow the GraphQL backend (same host) during SSR fetch
  experimental: {},

  // Suppress Next.js warning about cross-origin image URLs from media CDN
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.bookofmormon.online' },
    ],
  },

}

export default config
