import { NextRequest, NextResponse } from 'next/server'
import { LANG_PREFIXES, LOCALE_SEGS, langForHost } from '@/lib/locales'
import { seoIntentForPath } from '@/lib/features'
import { proxyClickyJs, proxyClickyBeacon } from '@/lib/clicky'

// The CRA uses bare routes (/timeline, not /en/timeline) — language is by
// subdomain, not URL path. So a locale-prefixed path must have that prefix
// stripped before proxying to the CRA, or its router finds no match and the
// page (e.g. the timeline) never mounts. 'en' included (it's the default and
// not in LANG_PREFIXES, but /en/* URLs still occur).

// Crawlers and social-preview fetchers get SSR HTML.
// Only requests that positively identify themselves as interactive browser
// navigations get proxied to the React app (CRA) on port 8201. Unknown clients
// default to SSR: crawler access must not depend on keeping a bot-name allowlist
// current.
// Korean bots matter for this site (ko content + sharing): Naver's crawler is
// "Yeti" (UA: naver.me/bot), Daum's is "Daumoa", and KakaoTalk/KakaoStory link
// previews send "kakaotalk-scrap"/"kakaostory-og-reader" — none reliably carry
// "bot"/"crawl", so they're matched explicitly by yeti|naver|daum|kakao.
const KNOWN_CRAWLER_RE = /bot|crawl|spider|slurp|google|bing|baidu|yandex|duckduck|facebook|twitter|linkedin|whatsapp|telegram|slack|discord|preview|curl|python-requests|yeti|naver|daum|kakao/i
const BROWSER_UA_RE = /mozilla\/5\.0.*(?:chrome|chromium|crios|firefox|fxios|safari|edg|opr)\//i

const CRA_ORIGIN = 'http://localhost:8201'

// fetch() decodes content encodings, while a browser applies any encoding
// headers it receives.  Do not copy hop-by-hop or representation-length
// headers from the CRA response: forwarding a stale content-length or
// content-encoding produces a successful response with an unreadable (often
// zero-byte) body at the client.
const FORWARDED_RESPONSE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function responseHeadersForClient(source: Headers): Headers {
  const headers = new Headers()
  source.forEach((value, name) => {
    if (!FORWARDED_RESPONSE_HEADERS.has(name.toLowerCase())) {
      headers.set(name, value)
    }
  })
  return headers
}

function isInteractiveBrowserNavigation(request: NextRequest, ua: string): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  if (KNOWN_CRAWLER_RE.test(ua) || !BROWSER_UA_RE.test(ua)) return false

  // Real modern browsers send Fetch Metadata and/or Client Hint headers.
  // Requiring a positive browser signal keeps an unknown crawler, CLI, feed
  // reader, or social service on the SSR path by default. These headers are not
  // security boundaries; they only select the presentation layer.
  const fetchMode = request.headers.get('sec-fetch-mode')
  const fetchDest = request.headers.get('sec-fetch-dest')
  const hasFetchMetadata = fetchMode === 'navigate' && (fetchDest === 'document' || fetchDest === 'empty')
  const hasClientHints = request.headers.has('sec-ch-ua')
  return hasFetchMetadata || hasClientHints
}

export async function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl
  const ua = request.headers.get('user-agent') ?? ''

  // --- Host redirect: www.* → bare domain ---
  if (hostname.startsWith('www.')) {
    const url = request.nextUrl.clone()
    url.hostname = hostname.slice(4)
    return NextResponse.redirect(url, 301)
  }

  // --- First-party analytics proxy (Clicky anti-adblock) ---
  // Obfuscated public paths come from env (never hardcoded — public repo). Proxy
  // them straight from middleware so nothing Clicky-related is a routable path,
  // and humans (the whole point of tracking) reach them without CRA proxying.
  const clickyJsPath = process.env.CLICKY_JS_PATH
  const clickyBeaconPath = process.env.CLICKY_BEACON_PATH
  if (clickyJsPath && pathname === clickyJsPath) return proxyClickyJs()
  if (clickyBeaconPath && pathname === clickyBeaconPath) return proxyClickyBeacon(request)

  // --- Crawler/SEO assets: always served by Next, regardless of UA ---
  // robots.txt, sitemap.xml, and OG images are fetched by scrapers that may not
  // send a bot UA, and are not CRA routes — never proxy them to the React app.
  const isSeoAsset =
    pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/og' || pathname.startsWith('/og/')

  // --- Human visitor: proxy transparently to CRA ---
  if (!isSeoAsset && isInteractiveBrowserNavigation(request, ua)) {
    const segs = pathname.split('/').filter(Boolean)
    // The CRA routes are bare (language is by subdomain). A locale-prefixed page
    // URL must be REDIRECTED to the bare path — a transparent rewrite keeps the
    // /en/... URL in the browser, so the CRA's client-side router still finds no
    // match and the page (e.g. the timeline) never mounts.
    // CRITICAL: only redirect GET navigations. The GraphQL API is POSTed to
    // /{lang} (e.g. POST /en) — redirecting that breaks every query (it 404s at
    // /). API POSTs fall through to the rewrite below.
    if (request.method === 'GET' && segs.length && LOCALE_SEGS.has(segs[0])) {
      const url = request.nextUrl.clone()
      url.pathname = '/' + segs.slice(1).join('/')
      return NextResponse.redirect(url)
    }
    const target = new URL(CRA_ORIGIN + pathname + request.nextUrl.search)
    const craRes = await fetch(target, { redirect: 'follow' })
    return new Response(craRes.body, {
      status: craRes.status,
      headers: responseHeadersForClient(craRes.headers),
    })
  }

  // --- Bot/crawler: serve Next.js SSR with lang header ---
  // Language is by HOST (subdomain/domain), not URL path.
  const lang = langForHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'))
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-lang', lang)
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('X-Resolved-Lang', lang)
  if (seoIntentForPath(pathname) === 'noindex') {
    res.headers.set('X-Robots-Tag', 'noindex, follow')
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
