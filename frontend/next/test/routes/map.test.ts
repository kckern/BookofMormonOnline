import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Map routes', () => {
  test('/map index renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/map')
  })
  test('/maps (distinct index) renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/maps')
  })
  test('/map/{type} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/map/neareast')
  })
  test('/map/{type}/place/{slug} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/map/neareast/place/assyria')
  })
})
