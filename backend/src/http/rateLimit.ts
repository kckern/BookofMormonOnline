const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/**
 * Next SSR and Fastify run in the same container. SSR's server-side GraphQL
 * calls therefore arrive over loopback and must not consume the public-client
 * rate-limit bucket. The backend port is not published by Docker; public API
 * traffic reaches it through Nginx and does not have a loopback peer address.
 */
export function isInternalLoopback(ip: string): boolean {
  return LOOPBACK_IPS.has(ip)
}
