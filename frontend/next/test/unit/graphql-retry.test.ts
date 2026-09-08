import { test, expect } from '@playwright/test'
import { isRetryableFetchError, withRetry } from '../../lib/graphql'

// Node's global fetch (undici) throws TypeError('fetch failed') with the real
// cause hung off .cause (sometimes wrapped in an AggregateError's .errors[]).
const econnrefused = () =>
  Object.assign(new TypeError('fetch failed'), {
    cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5005'), { code: 'ECONNREFUSED' }),
  })
const aggregate = () =>
  Object.assign(new TypeError('fetch failed'), { cause: { errors: [{ code: 'ECONNREFUSED' }] } })
const timeout = () => Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' })

test.describe('isRetryableFetchError — only transient network failures retry', () => {
  test('ECONNREFUSED (backend recycle) is retryable', () => {
    expect(isRetryableFetchError(econnrefused())).toBe(true)
  })
  test('AggregateError cause is retryable', () => {
    expect(isRetryableFetchError(aggregate())).toBe(true)
  })
  test('per-attempt timeout is retryable', () => {
    expect(isRetryableFetchError(timeout())).toBe(true)
  })
  test('a GraphQL business error is NOT retryable', () => {
    expect(isRetryableFetchError(new Error('Verse not found'))).toBe(false)
  })
  test('an HTTP 5xx response error is NOT retryable', () => {
    // We do not hammer a backend that is up and answering with 500s.
    expect(isRetryableFetchError(new Error('GraphQL fetch failed: 500'))).toBe(false)
  })
})

test.describe('withRetry — bridges a brief backend outage', () => {
  test('recovers once the backend comes back', async () => {
    let calls = 0
    const op = async () => {
      calls++
      if (calls < 3) throw econnrefused()
      return 'ok'
    }
    const res = await withRetry(op, { sleep: async () => {} })
    expect(res).toBe('ok')
    expect(calls).toBe(3)
  })

  test('rethrows after exhausting retries', async () => {
    let calls = 0
    const op = async () => {
      calls++
      throw econnrefused()
    }
    await expect(withRetry(op, { retries: 2, sleep: async () => {} })).rejects.toThrow('fetch failed')
    expect(calls).toBe(3) // initial attempt + 2 retries
  })

  test('does not retry a non-retryable error', async () => {
    let calls = 0
    const op = async () => {
      calls++
      throw new Error('GraphQL fetch failed: 500')
    }
    await expect(withRetry(op, { sleep: async () => {} })).rejects.toThrow('500')
    expect(calls).toBe(1)
  })
})
