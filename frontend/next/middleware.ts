export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

const LANG_PREFIXES = ['ko', 'fr', 'de', 'es', 'pt', 'ja', 'zh']

// Crawlers and social-preview fetchers get SSR HTML.
// Everyone else gets proxied to the React app (CRA) on port 8201.
// Korean bots matter for this site (ko content + sharing): Naver's crawler is
// "Yeti" (UA: naver.me/bot), Daum's is "Daumoa", and KakaoTalk/KakaoStory link
// previews send "kakaotalk-scrap"/"kakaostory-og-reader" — none reliably carry
// "bot"/"crawl", so they're matched explicitly by yeti|naver|daum|kakao.
const BOT_RE = /bot|crawl|spider|slurp|google|bing|baidu|yandex|duckduck|facebook|twitter|linkedin|whatsapp|telegram|slack|discord|preview|curl|python-requests|yeti|naver|daum|kakao/i

const CRA_ORIGIN = 'http://localhost:8201'

export function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl
  const ua = request.headers.get('user-agent') ?? ''

  // --- Host redirect: www.* → bare domain ---
  if (hostname.startsWith('www.')) {
    const url = request.nextUrl.clone()
    url.hostname = hostname.slice(4)
    return NextResponse.redirect(url, 301)
  }

  // --- Crawler/SEO assets: always served by Next, regardless of UA ---
  // robots.txt, sitemap.xml, and OG images are fetched by scrapers that may not
  // send a bot UA, and are not CRA routes — never proxy them to the React app.
  const isSeoAsset =
    pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/og' || pathname.startsWith('/og/')

  // --- Human visitor: proxy transparently to CRA ---
  if (!isSeoAsset && !BOT_RE.test(ua)) {
    const target = new URL(CRA_ORIGIN + pathname + request.nextUrl.search)
    return NextResponse.rewrite(target)
  }

  // --- Bot/crawler: serve Next.js SSR with lang header ---
  const segments = pathname.split('/').filter(Boolean)
  const lang = LANG_PREFIXES.includes(segments[0]) ? segments[0] : 'en'
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-lang', lang)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
