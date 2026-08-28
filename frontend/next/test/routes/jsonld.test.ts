import { test, expect } from '@playwright/test'

function ldBlocks(html: string): any[] {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  const out: any[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push(JSON.parse(m[1]))
  return out
}

test.describe('JSON-LD structured data', () => {
  test('/people/{slug} emits BreadcrumbList + Person', async ({ request }) => {
    const html = await (await request.get('/people/nephi1')).text()
    const blocks = ldBlocks(html)
    const crumb = blocks.find((b) => b['@type'] === 'BreadcrumbList')
    expect(crumb).toBeTruthy()
    expect(crumb.itemListElement.map((i: any) => i.name)).toContain('People')
    const person = blocks.find((b) => b['@type'] === 'Person')
    expect(person).toBeTruthy()
    expect(person.name).toContain('Nephi')
    expect(person.url).toContain('/people/nephi1')
    expect(person.inLanguage).toBe('en')
  })

  test('ld+json escapes < (prevents </script> breakout)', async ({ request }) => {
    const html = await (await request.get('/people/nephi1')).text()
    const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    let m: RegExpExecArray | null
    let found = false
    while ((m = re.exec(html))) {
      found = true
      expect(m[1]).not.toContain('<') // every '<' must be emitted as <
    }
    expect(found).toBe(true)
  })
})
