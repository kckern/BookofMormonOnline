import { expect, test } from '@playwright/test'
import { NextRequest } from 'next/server'
import { proxyClickyBeacon } from '../../lib/clicky'

test('Clicky beacon forwards Referer but not application cookies', async () => {
  const originalFetch = globalThis.fetch
  let forwardedHeaders: Headers | undefined

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    forwardedHeaders = new Headers(init?.headers)
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const request = new NextRequest(
      'https://bookofmormon.online/clicky-beacon?site_id=66488278',
      {
        headers: {
          cookie: 'session=must-not-leak',
          referer: 'https://bookofmormon.online/lehites',
          'user-agent': 'Clicky regression test',
          'x-forwarded-for': '203.0.113.10, 198.51.100.20',
        },
      },
    )

    await proxyClickyBeacon(request)

    expect(forwardedHeaders?.get('referer')).toBe(
      'https://bookofmormon.online/lehites',
    )
    expect(forwardedHeaders?.get('x-forwarded-for')).toBe('203.0.113.10')
    expect(forwardedHeaders?.get('cookie')).toBeNull()
  } finally {
    globalThis.fetch = originalFetch
  }
})
