import { test, expect } from '@playwright/test'
import { classify } from '../../lib/classify'

const G = 'GET'

test.describe('classify — real browsers reach the CRA', () => {
  const browsers: Record<string, string> = {
    chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'safari-desktop': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'ios-safari': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'firefox-ios': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15',
    'chrome-android': 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  }
  for (const [name, ua] of Object.entries(browsers)) {
    test(`${name} → browser/cra`, () => {
      const d = classify({ method: G, ua })
      expect(d.clientClass, name).toBe('browser')
      expect(d.renderMode, name).toBe('cra')
      expect(d.crawlerFamily, name).toBe('browser')
    })
  }
})

test.describe('classify — in-app WebViews reach the CRA (the fix)', () => {
  const webviews: Record<string, string> = {
    'facebook-ios': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/443.0]',
    instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0',
    'kakaotalk-android': 'Mozilla/5.0 (Linux; Android 13; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36;KAKAOTALK 2510020',
    'naver-app': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 1000; 12.9.5)',
  }
  for (const [name, ua] of Object.entries(webviews)) {
    test(`${name} → browser/cra`, () => {
      const d = classify({ method: G, ua })
      expect(d.clientClass, name).toBe('browser')
      expect(d.renderMode, name).toBe('cra')
    })
  }
})

test.describe('classify — crawlers get SSR with a family', () => {
  const crawlers: Record<string, [string, string]> = {
    googlebot: ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'google'],
    bingbot: ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'bing'],
    facebookexternalhit: ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'meta'],
    gptbot: ['Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)', 'openai'],
    ahrefs: ['Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', 'seo-tool'],
    yeti: ['Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)', 'other-crawler'],
    daumoa: ['Mozilla/5.0 (compatible; Daumoa/4.0; +http://cs.daum.net/faq/15/4118.html)', 'other-crawler'],
    'kakaotalk-scrap': ['facebookexternalhit/1.1; kakaotalk-scrap/1.0; +https://devtalk.kakao.com/', 'meta'],
    'spoofed-scraper': ['Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)', 'seo-tool'],
  }
  for (const [name, [ua, family]] of Object.entries(crawlers)) {
    test(`${name} → known-crawler/ssr/${family}`, () => {
      const d = classify({ method: G, ua })
      expect(d.clientClass, name).toBe('known-crawler')
      expect(d.renderMode, name).toBe('ssr')
      expect(d.crawlerFamily, name).toBe(family)
    })
  }
})

test.describe('classify — headless clients stay on SSR (accepted)', () => {
  const headless: Record<string, string> = {
    'headless-chrome': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/119.0.0.0 Safari/537.36',
    lighthouse: 'Mozilla/5.0 (Linux; Android 7.0; Moto G4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
  }
  for (const [name, ua] of Object.entries(headless)) {
    test(`${name} → known-crawler/ssr`, () => {
      const d = classify({ method: G, ua })
      expect(d.clientClass, name).toBe('known-crawler')
      expect(d.renderMode, name).toBe('ssr')
    })
  }
})

test.describe('classify — unknown clients default to SSR', () => {
  for (const ua of ['', 'Acme-Monitor/1.0', 'Java/1.8.0_301-internal-fake']) {
    test(`"${ua.slice(0, 20)}" → unknown or crawler, always ssr`, () => {
      const d = classify({ method: G, ua })
      expect(d.renderMode).toBe('ssr')
      expect(['unknown', 'known-crawler']).toContain(d.clientClass)
    })
  }
})

test.describe('classify — non-navigations never route to CRA', () => {
  test('browser POST → isNav false, renderMode ssr, still classed browser', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    const d = classify({ method: 'POST', ua })
    expect(d.isNav).toBe(false)
    expect(d.renderMode).toBe('ssr') // non-nav never routes to CRA
    expect(d.clientClass).toBe('browser')
  })
})

test.describe('classify — isMobile from header or UA', () => {
  test('sec-ch-ua-mobile: ?1 → isMobile even on a desktop-looking UA', () => {
    const d = classify({ method: 'GET', ua: 'Mozilla/5.0 (X11; Linux) Chrome/120 Safari/537.36', secChUaMobile: '?1' })
    expect(d.isMobile).toBe(true)
  })
  test('sec-ch-ua-mobile: ?0 on a desktop UA → not mobile', () => {
    const d = classify({ method: 'GET', ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', secChUaMobile: '?0' })
    expect(d.isMobile).toBe(false)
  })
  test('iPhone UA → isMobile', () => {
    const d = classify({ method: 'GET', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1) AppleWebKit/605.1.15 Mobile Safari/604.1' })
    expect(d.isMobile).toBe(true)
  })
})
