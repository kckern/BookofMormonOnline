import { test, expect } from '@playwright/test'
import { getMeta, getRobots } from '../helpers/meta'
import { expectSsrPage } from '../helpers/ssr'

test.describe('History routes (noindex subtree)', () => {
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
  test('/history is noindex (meta + X-Robots-Tag)', async ({ request }) => {
    const r = await request.get('/history')
    expect(r.headers()['x-robots-tag']).toBe('noindex, follow')
    expect(getRobots(await r.text())).toBe('noindex, follow')
  })
  test('history descriptions contain neither Markdown nor empty citation punctuation', async ({ request }) => {
    const index = await (await request.get('/history')).text()
    expect(getMeta(index, 'description')).not.toMatch(/\[[^\]]+\]\(|\*[^*]+\*/)
    const detail = await (await request.get('/history/1836-03-oliver-cowdery')).text()
    expect(getMeta(detail, 'description')).not.toMatch(/^\s*:\s*[•·]/)
  })
})
