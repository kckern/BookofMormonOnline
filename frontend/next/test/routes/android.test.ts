import { test, expect } from '@playwright/test'

test.describe('Android TWA association resources', () => {
  test('/manifest.json is a web manifest, never the CRA HTML shell', async ({ request }) => {
    const response = await request.get('/manifest.json')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/manifest+json')

    const manifest = await response.json()
    expect(manifest.name).toBe('Book of Mormon Online')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192' }),
        expect.objectContaining({ sizes: '512x512' }),
      ])
    )
  })

  test('/.well-known/assetlinks.json delegates to the existing Play identity', async ({ request }) => {
    const response = await request.get('/.well-known/assetlinks.json')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')

    const links = await response.json()
    expect(links).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'online.bookofmormon.twa',
          sha256_cert_fingerprints: [
            'AA:03:3F:59:4A:10:FB:EE:19:75:6D:5A:D9:6F:FF:92:49:A5:50:B4:A5:5B:96:33:0F:13:D2:09:BB:13:BF:A0',
          ],
        },
      },
    ])
  })
})

