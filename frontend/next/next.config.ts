import type { NextConfig } from 'next'

const config: NextConfig = {
  // Allow the GraphQL backend (same host) during SSR fetch
  experimental: {},
  // During Phase 1-3 migration, unknown routes are not handled here;
  // Nginx routes them to CRA. So no catch-all rewrite is needed.
  // Phase 4: remove this comment and add rewrites to kill CRA.

  // Suppress Next.js warning about cross-origin image URLs from media CDN
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.bookofmormon.online' },
    ],
  },

  // Expose the backend URL to server components as an env var
  env: {
    GRAPHQL_URL: process.env.GRAPHQL_URL ?? 'http://localhost:5006/graphql',
  },
}

export default config
