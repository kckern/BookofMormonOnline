import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Study edition routes', () => {
  test('/studyedition renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/studyedition')
  })
  test('/특별반 alias renders SSR content (percent-encoded canonical)', async ({ request }) => {
    await expectSsrPage(request, '/특별반', { canonicalPath: '/%ED%8A%B9%EB%B3%84%EB%B0%98' })
  })
})
