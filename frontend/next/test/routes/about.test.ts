import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('About route /about', () => {
  test('/about renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/about', { titleIncludes: 'about' })
  })
})
