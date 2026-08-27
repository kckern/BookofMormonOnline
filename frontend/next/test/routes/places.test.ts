import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Places route /places/{slug}', () => {
  test('/places/{slug} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/places/jerusalem-1')
  })
})
