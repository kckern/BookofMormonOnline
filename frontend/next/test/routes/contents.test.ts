import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Contents route /contents', () => {
  test('/contents renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/contents', { requireDescription: false })
  })
})
