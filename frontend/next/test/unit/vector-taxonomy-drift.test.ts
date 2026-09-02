import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import yaml from 'js-yaml'
import { classify } from '../../lib/classify'

// One representative UA per crawler family. Vector's regex cascade AND
// classify()'s FAMILY_RES must agree — this guards against the two copies
// drifting (they cannot share code: one is VRL, one is TS).
const FAMILY_FIXTURES: Record<string, string> = {
  google: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  bing: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  meta: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  openai: 'Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)',
  screpy: 'Mozilla/5.0 (compatible; Screpy/1.0)',
  'seo-tool': 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
}

function vectorSource(): string {
  // Playwright runs from frontend/next; repo root is two levels up.
  const path = resolve(process.cwd(), '../../ops/telemetry/vector.yaml')
  const doc = yaml.load(readFileSync(path, 'utf8')) as any
  return doc.transforms.bom_access.source as string
}

// Extract [family, RegExp] from each VRL `match(ua, r'...') { .crawler_family = "x" }`.
function vectorFamilyRes(src: string): Array<[string, RegExp]> {
  const re = /match\(ua,\s*r'([^']+)'\)\s*\{\s*\.crawler_family\s*=\s*"([^"]+)"/g
  const out: Array<[string, RegExp]> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) out.push([m[2], new RegExp(m[1], 'i')])
  return out
}

test.describe('classify() families agree with ops/telemetry/vector.yaml', () => {
  const pairs = vectorFamilyRes(vectorSource())

  test('vector.yaml yields the expected match-based family list, in order', () => {
    expect(pairs.map(([f]) => f)).toEqual(
      ['google', 'bing', 'meta', 'openai', 'screpy', 'seo-tool', 'other-crawler'],
    )
  })

  test('each fixture: classify() and the vector cascade assign the same family', () => {
    for (const [family, ua] of Object.entries(FAMILY_FIXTURES)) {
      expect(classify({ method: 'GET', ua }).crawlerFamily, `classify ${family}`).toBe(family)
      // Vector downcases the UA before matching, so mimic that here.
      const firstHit = pairs.find(([, r]) => r.test(ua.toLowerCase()))
      expect(firstHit?.[0], `vector ${family}`).toBe(family)
    }
  })
})
