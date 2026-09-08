// Base GraphQL fetcher. All lib/* modules call this.
// GRAPHQL_URL must be set in the runtime environment (e.g. via Infisical/systemd).
// Falls back to localhost:5006 for local development.
import { headers } from 'next/headers'

const GRAPHQL_URL = process.env.GRAPHQL_URL ?? 'http://localhost:5006/graphql'
// SSR and the GraphQL backend share one container; when PM2 recycles the backend
// (max_memory_restart) it is unreachable for ~1-2s and Server-Component fetches
// throw ECONNREFUSED -> HTTP 500 for every crawler mid-flight. Retry across that
// gap. See docs/bugs/2026-09-08-npm-5xx-burst-ssr-econnrefused.md.
const FETCH_TIMEOUT_MS = Number(process.env.GRAPHQL_FETCH_TIMEOUT_MS ?? 8000)
const RETRY_DELAYS_MS = [200, 600, 1500] // ~2.3s of coverage, spans a restart

// Only transient connection-level failures are retried — undici throws
// TypeError('fetch failed') with the socket error on .cause (or, for dual-stack
// hosts, wrapped in an AggregateError's .errors[]); AbortSignal.timeout raises a
// TimeoutError. An HTTP 5xx or a GraphQL business error means the backend IS
// answering, so we surface it immediately rather than hammering it.
const RETRYABLE_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'ETIMEDOUT',
  'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT',
])

export function isRetryableFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return true
  const cause = (err as { cause?: unknown }).cause as
    | { code?: unknown; errors?: Array<{ code?: unknown }> }
    | undefined
  const candidates = cause ? [cause, ...(Array.isArray(cause.errors) ? cause.errors : [])] : []
  if (candidates.some((c) => typeof c?.code === 'string' && RETRYABLE_CODES.has(c.code))) return true
  return err.message === 'fetch failed'
}

export async function withRetry<T>(
  op: () => Promise<T>,
  opts: {
    retries?: number
    delaysMs?: number[]
    shouldRetry?: (e: unknown) => boolean
    sleep?: (ms: number) => Promise<void>
  } = {}
): Promise<T> {
  const delaysMs = opts.delaysMs ?? RETRY_DELAYS_MS
  const retries = opts.retries ?? delaysMs.length
  const shouldRetry = opts.shouldRetry ?? isRetryableFetchError
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  for (let attempt = 0; ; attempt++) {
    try {
      return await op()
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err
      await sleep(delaysMs[Math.min(attempt, delaysMs.length - 1)])
    }
  }
}

export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { revalidate?: number | false; lang?: string } = {}
): Promise<T> {
  // Override short-circuits BEFORE headers() so pinned callers (sitemap) stay static/ISR.
  const lang = options.lang ?? (await headers()).get('x-lang') ?? 'en'
  const url = `${GRAPHQL_URL}${lang === 'en' ? '' : '/' + lang}`
  return withRetry(async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next:
        options.revalidate === false
          ? { revalidate: 0 }
          : { revalidate: options.revalidate ?? 3600 },
    })
    if (!res.ok) throw new Error(`GraphQL fetch failed: ${res.status}`)
    const json = await res.json()
    if (json.errors?.length) throw new Error(json.errors[0].message)
    return json.data as T
  })
}
