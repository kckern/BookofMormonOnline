import { expect, test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Timeline routes', () => {
  test('/timeline index renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/timeline')
  })
  test('/timeline/{marker} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/timeline/lehite-family')
  })

  test('a duplicate slug prefers its content row over an empty map marker', async ({ request }) => {
    const html = await expectSsrPage(request, '/timeline/land-of-nephi')
    expect(html).toContain('<h1>The Land of Nephi (570 BC)</h1>')
  })

  test('a map-only marker is not exposed as an empty indexable page', async ({ request }) => {
    expect((await request.get('/timeline/east')).status()).toBe(404)
  })

  test('the sitemap excludes map-only markers but keeps contentful duplicate slugs', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).not.toContain('<loc>https://bookofmormon.online/timeline/east</loc>')
    expect(xml).toContain('<loc>https://bookofmormon.online/timeline/land-of-nephi</loc>')
  })
})
