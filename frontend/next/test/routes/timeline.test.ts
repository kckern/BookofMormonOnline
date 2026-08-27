import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Timeline routes', () => {
  test('/timeline index renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/timeline')
  })
  test('/timeline/{marker} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/timeline/lehite-family')
  })
})
