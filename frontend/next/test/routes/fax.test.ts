import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Fax routes', () => {
  test('/fax index renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/fax')
  })
  test('/fax/{slug} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/fax/original')
  })
})
