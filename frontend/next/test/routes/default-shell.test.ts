import { test, expect } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Default shell /', () => {
  test('/ renders the default study-resource shell', async ({ request }) => {
    const html = await expectSsrPage(request, '/', { canonicalPath: '/' })
    // Default nav is present in the shell.
    expect(html).toContain('href="/contents"')
  })
})
