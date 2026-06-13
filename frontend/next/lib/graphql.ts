// Base GraphQL fetcher. All lib/* modules call this.
// GRAPHQL_URL must be set in the runtime environment (e.g. via Infisical/systemd).
// Falls back to localhost:5006 for local development.
const GRAPHQL_URL = process.env.GRAPHQL_URL ?? 'http://localhost:5006/graphql'

export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { revalidate?: number | false } = {}
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next:
      options.revalidate === false
        ? { revalidate: 0 }
        : { revalidate: options.revalidate ?? 3600 },
  })
  if (!res.ok) throw new Error(`GraphQL fetch failed: ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data as T
}
