import { test, expect } from '@playwright/test'
import { gql, resetGraphqlMemo } from '../../lib/graphql'

// Next's fetch data cache is bypassed (cache: 'no-store'); gql keeps its own
// bounded in-process TTL cache. Errors arrive as HTTP 200 and must never be stored
// (prod 2026-10-20: a cached error 500'd /people/moroni1 for an hour).
const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 })
const bad = (msg: string) => new Response(JSON.stringify({ errors: [{ message: msg }], data: {} }), { status: 200 })

test.describe('gql — bounded in-process cache', () => {
  const real = globalThis.fetch
  let calls: Array<{ init: RequestInit }> = []
  test.beforeEach(() => resetGraphqlMemo())
  test.afterEach(() => { globalThis.fetch = real; calls = [] })
  const stub = (...responses: Response[]) => {
    calls = []
    globalThis.fetch = (async (_u: unknown, init: RequestInit) => {
      calls.push({ init })
      return responses[Math.min(calls.length - 1, responses.length - 1)].clone()
    }) as typeof fetch
  }

  test('never asks Next to persist the response', async () => {
    stub(ok({ a: 1 }))
    await gql('{ a }', {}, { lang: 'en' })
    expect(calls[0].init.cache).toBe('no-store')
    expect((calls[0].init as { next?: unknown }).next).toBeUndefined()
  })

  test('a repeat query inside the TTL is served from memory', async () => {
    stub(ok({ a: 1 }))
    const one = await gql<{ a: number }>('{ a }', {}, { lang: 'en' })
    const two = await gql<{ a: number }>('{ a }', {}, { lang: 'en' })
    expect(calls).toHaveLength(1)
    expect(two).toEqual(one)
  })

  test('different variables or language are different entries', async () => {
    stub(ok({ a: 1 }))
    await gql('{ a }', { id: 1 }, { lang: 'en' })
    await gql('{ a }', { id: 2 }, { lang: 'en' })
    await gql('{ a }', { id: 1 }, { lang: 'ko' })
    expect(calls).toHaveLength(3)
  })

  test('a caller mutating its result does not corrupt the cache', async () => {
    stub(ok({ list: [3, 1, 2] }))
    const one = await gql<{ list: number[] }>('{ l }', {}, { lang: 'en' })
    one.list.sort()
    const two = await gql<{ list: number[] }>('{ l }', {}, { lang: 'en' })
    expect(two.list).toEqual([3, 1, 2])
  })

  test('concurrent identical queries share one fetch', async () => {
    stub(ok({ a: 1 }))
    await Promise.all([1, 2, 3, 4].map(() => gql('{ a }', {}, { lang: 'en' })))
    expect(calls).toHaveLength(1)
  })

  test('an errors response throws and is not stored', async () => {
    stub(bad('Unexpected error.'), ok({ person: [{ slug: 'moroni1' }] }))
    await expect(gql('{ p }', {}, { lang: 'en' })).rejects.toThrow('Unexpected error.')
    const data = await gql<{ person: unknown[] }>('{ p }', {}, { lang: 'en' })
    expect(data.person).toHaveLength(1)
    expect(calls).toHaveLength(2)
  })

  test('revalidate:false is never cached', async () => {
    stub(ok({ a: 1 }))
    await gql('{ a }', {}, { lang: 'en', revalidate: false })
    await gql('{ a }', {}, { lang: 'en', revalidate: false })
    expect(calls).toHaveLength(2)
  })

  test('entries expire after their revalidate window', async () => {
    stub(ok({ a: 1 }))
    await gql('{ a }', {}, { lang: 'en', revalidate: 1 })
    const realNow = Date.now
    Date.now = () => realNow() + 2000
    try { await gql('{ a }', {}, { lang: 'en', revalidate: 1 }) } finally { Date.now = realNow }
    expect(calls).toHaveLength(2)
  })
})
