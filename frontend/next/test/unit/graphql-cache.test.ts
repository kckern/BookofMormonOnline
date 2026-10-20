import { test, expect } from '@playwright/test'
import { gql } from '../../lib/graphql'

// A GraphQL error arrives as HTTP 200, so Next's data cache stores it for the
// revalidate window (default 1h): one DB blip used to poison a page's data for
// an hour (prod 2026-10-20: /people/moroni1 returned 500 to crawlers long after
// the 18:31 UTC outage). An errors-bearing response is re-asked uncached.
const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 })
const bad = (msg: string) => new Response(JSON.stringify({ errors: [{ message: msg }], data: {} }), { status: 200 })

test.describe('gql — a cached GraphQL error does not poison the page', () => {
  const real = globalThis.fetch
  let calls: Array<{ init: RequestInit & { next?: unknown } }> = []
  test.afterEach(() => { globalThis.fetch = real; calls = [] })
  const stub = (...responses: Response[]) => {
    calls = []
    globalThis.fetch = (async (_u: unknown, init: RequestInit) => {
      calls.push({ init: init as RequestInit & { next?: unknown } })
      return responses[Math.min(calls.length - 1, responses.length - 1)].clone()
    }) as typeof fetch
  }

  test('an errors response is retried once with no-store and the fresh data wins', async () => {
    stub(bad('Unexpected error.'), ok({ person: [{ slug: 'moroni1' }] }))
    const data = await gql<{ person: unknown[] }>('{ person }', {}, { lang: 'en' })
    expect(data.person).toHaveLength(1)
    expect(calls).toHaveLength(2)
    expect(calls[1].init.cache).toBe('no-store')
    expect(calls[1].init.next).toBeUndefined() // never combine no-store with revalidate
  })

  test('still erroring after the uncached retry: throws the error', async () => {
    stub(bad('Verse not found'), bad('Verse not found'))
    await expect(gql('{ x }', {}, { lang: 'en' })).rejects.toThrow('Verse not found')
    expect(calls).toHaveLength(2)
  })

  test('a clean response is a single cached fetch', async () => {
    stub(ok({ a: 1 }))
    await gql('{ a }', {}, { lang: 'en' })
    expect(calls).toHaveLength(1)
    expect(calls[0].init.next).toEqual({ revalidate: 3600 })
  })

  test('revalidate:false is already uncached: no second call', async () => {
    stub(bad('boom'))
    await expect(gql('{ a }', {}, { lang: 'en', revalidate: false })).rejects.toThrow('boom')
    expect(calls).toHaveLength(1)
  })
})
