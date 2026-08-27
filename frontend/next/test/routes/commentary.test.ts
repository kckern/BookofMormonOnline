import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

// /commentary/{id} — 10-digit content key, reachable via textblock pages
// (e.g. /lehites/64 links to it). No index/sitemap to derive from.
test.describe('Commentary route /commentary/{id}', () => {
  test('/commentary/{id} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/commentary/1012904101')
  })
})
