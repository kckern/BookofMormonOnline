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
const BACKEND_ORIGIN = 'http://localhost:5005'
const CRA_ASSET_PATHS = new Set(['/sw.js', '/asset-manifest.json', '/manifest.json'])
const CRA_ASSET_PREFIXES = ['/static/', '/font/', '/icons/', '/img/', '/md/', '/screenshots/', '/tinymce/']
const FAX_BACKEND_PREFIXES = ['/fax/boxes/', '/fax/render/', '/fax/text/']

type RenderMode = 'ssr' | 'cra' | 'asset' | 'analytics'
type ClientClass = 'browser' | 'known-crawler' | 'unknown'

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' https://accounts.google.com https://www.google.com https://www.gstatic.com https://static.userback.io https://static.cloudflareinsights.com https://static.getclicky.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: wss:",
    "media-src 'self' blob: https:",
    "frame-src 'self' https://www.google.com https://recaptcha.google.com https://designrr.page",
    "worker-src 'self' blob:",
    'upgrade-insecure-requests',
  ].join('; '),
}

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

function classifyClient(request: NextRequest, ua: string): ClientClass {
  if (KNOWN_CRAWLER_RE.test(ua)) return 'known-crawler'
  if (isInteractiveBrowserNavigation(request, ua)) return 'browser'
  return 'unknown'
}

function isCraAsset(pathname: string): boolean {
  return CRA_ASSET_PATHS.has(pathname) || CRA_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function markResponse<T extends Response>(response: T, clientClass: ClientClass, renderMode?: RenderMode): T {
  response.headers.set('X-BOM-Client-Class', clientClass)
  if (renderMode) response.headers.set('X-BOM-Render-Mode', renderMode)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value)
  }
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl
  const ua = request.headers.get('user-agent') ?? ''
  const clientClass = classifyClient(request, ua)

  // --- Host redirect: www.* → bare domain ---
  if (hostname.startsWith('www.')) {
    const url = request.nextUrl.clone()
    url.hostname = hostname.slice(4)
    return markResponse(NextResponse.redirect(url, 301), clientClass)
  }

  // The desktop viewer is a CRA route, but these dynamic Facsimiles resources
  // are Fastify endpoints. Route them before the browser/CRA fallback so the
  // client receives box JSON (rather than the SPA HTML shell) in every deploy.
  if (FAX_BACKEND_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.rewrite(new URL(pathname + request.nextUrl.search, BACKEND_ORIGIN))
  }

  // --- First-party analytics proxy (Clicky anti-adblock) ---
  // Obfuscated public paths come from env (never hardcoded — public repo). Proxy
  // them straight from middleware so nothing Clicky-related is a routable path,
  // and humans (the whole point of tracking) reach them without CRA proxying.
  const clickyJsPath = process.env.CLICKY_JS_PATH
  const clickyBeaconPath = process.env.CLICKY_BEACON_PATH
  if (clickyJsPath && pathname === clickyJsPath) {
    return markResponse(await proxyClickyJs(), clientClass, 'analytics')
  }
  if (clickyBeaconPath && pathname === clickyBeaconPath) {
    return markResponse(await proxyClickyBeacon(request), clientClass, 'analytics')
  }

  // --- Crawler/SEO assets: always served by Next, regardless of UA ---
  // robots.txt, sitemap.xml, and OG images are fetched by scrapers that may not
  // send a bot UA, and are not CRA routes — never proxy them to the React app.
  const isSeoAsset =
    pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/og' || pathname.startsWith('/og/')

  // --- Human visitor: proxy transparently to CRA ---
  if (!isSeoAsset && (isCraAsset(pathname) || isInteractiveBrowserNavigation(request, ua))) {
    const segs = pathname.split('/').filter(Boolean)
    // The CRA routes are bare (language is by subdomain). A locale-prefixed page
    // URL must be REDIRECTED to the bare path — a transparent rewrite keeps the
    // /en/... URL in the browser, so the CRA's client-side router still finds no
    // match and the page (e.g. the timeline) never mounts.
    // CRITICAL: only redirect GET navigations. The GraphQL API is POSTed to
    // /{lang} (e.g. POST /en) — redirecting that breaks every query (it 404s at
    // /). API POSTs fall through to the rewrite below.
    if (!isCraAsset(pathname) && request.method === 'GET' && segs.length && LOCALE_SEGS.has(segs[0])) {
      const url = request.nextUrl.clone()
      url.pathname = '/' + segs.slice(1).join('/')
      return markResponse(NextResponse.redirect(url), clientClass, 'cra')
    }
    const target = new URL(CRA_ORIGIN + pathname + request.nextUrl.search)
    const craRes = await fetch(target, { redirect: 'follow' })
    return markResponse(new Response(craRes.body, {
      status: craRes.status,
      headers: responseHeadersForClient(craRes.headers),
    }), clientClass, 'cra')
  }

  // --- Bot/crawler: serve Next.js SSR with lang header ---
  // Language is by HOST (subdomain/domain), not URL path.
  const lang = langForHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'))
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-lang', lang)
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('X-Resolved-Lang', lang)
  markResponse(res, clientClass, isSeoAsset ? 'asset' : 'ssr')
  if (seoIntentForPath(pathname) === 'noindex') {
    res.headers.set('X-Robots-Tag', 'noindex, follow')
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
