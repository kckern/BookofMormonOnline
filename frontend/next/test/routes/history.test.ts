import { test, expect } from '@playwright/test'
import { getMeta, getRobots } from '../helpers/meta'
import { expectSsrPage } from '../helpers/ssr'

test.describe('History routes', () => {
  test('/history index renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/history', { titleIncludes: 'histor' })
  })
  test('/history/{doc} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/history/1836-03-oliver-cowdery')
  })
  test('/history/joseph-smith renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/history/joseph-smith')
  })
  test('/history/witnesses renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/history/witnesses')
  })
  test('/history is crawlable (no noindex)', async ({ request }) => {
    const r = await request.get('/history')
    expect(r.headers()['x-robots-tag']).toBeUndefined()
    expect(getRobots(await r.text()) ?? '').not.toContain('noindex')
  })
  test('/history/{doc} stays noindex (meta + X-Robots-Tag)', async ({ request }) => {
    const r = await request.get('/history/1836-03-oliver-cowdery')
    expect(r.headers()['x-robots-tag']).toBe('noindex, follow')
    expect(getRobots(await r.text())).toBe('noindex, follow')
  })
  test('hub links all five collections with counts', async ({ request }) => {
    const html = await (await request.get('/history')).text()
    for (const k of ['joseph-smith', 'witnesses', 'translation', 'reception', 'lost-116-pages']) {
      expect(html).toContain(`href="/history/${k}"`)
    }
    expect(html).not.toContain('thumbs/"') // no empty thumbnail URLs
  })
  test('collection pages list their documents, grouped by decade', async ({ request }) => {
    for (const [k, h1] of [['translation', 'Translation Process'], ['reception', 'Reception History'], ['lost-116-pages', 'The Lost 116 Pages'], ['witnesses', 'The Witnesses'], ['joseph-smith', 'Joseph Smith']]) {
      const r = await request.get(`/history/${k}`)
      expect(r.status(), k).toBe(200)
      const html = await r.text()
      expect(html, k).toContain(`<h1>${h1}</h1>`)
      expect(html, k).toMatch(/<h2>\d{4}s<\/h2>/)
      expect(html, k).toContain('href="/history/18')
      expect(html, k).toContain('"@type":"BreadcrumbList"')
    }
  })
  test('history descriptions contain neither Markdown nor empty citation punctuation', async ({ request }) => {
    const index = await (await request.get('/history')).text()
    expect(getMeta(index, 'description')).not.toMatch(/\[[^\]]+\]\(|\*[^*]+\*/)
    const detail = await (await request.get('/history/1836-03-oliver-cowdery')).text()
    expect(getMeta(detail, 'description')).not.toMatch(/^\s*:\s*[•·]/)
  })
})
