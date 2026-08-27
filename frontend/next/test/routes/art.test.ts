import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

// /art/{id} — no index page or sitemap entry; /art/1000 is a verified existing id.
test.describe('Art route /art/{id}', () => {
  test('/art/{id} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/art/1000')
  })
})
