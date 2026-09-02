import { NextRequest, NextResponse } from 'next/server'
import { LANG_PREFIXES, LOCALE_SEGS, langForHost, isAuthorizedHost, isInfraHost, isForceSsrHost, isPreviewHost, CANONICAL_EN_HOST } from '@/lib/locales'
import { seoIntentForPath } from '@/lib/features'
import { proxyClickyJs, proxyClickyBeacon } from '@/lib/clicky'
import { classify, type Decision, type ClientClass, type RenderMode } from '@/lib/classify'
import { ANDROID_ASSET_LINKS, PWA_MANIFEST } from '@/lib/android'

// The CRA uses bare routes (/timeline, not /en/timeline) — language is by
// subdomain, not URL path. So a locale-prefixed path must have that prefix
// stripped before proxying to the CRA, or its router finds no match and the
// page (e.g. the timeline) never mounts. 'en' included (it's the default and
// not in LANG_PREFIXES, but /en/* URLs still occur).

const CRA_ORIGIN = 'http://localhost:8201'
const BACKEND_ORIGIN = 'http://localhost:5005'
const CRA_ASSET_PATHS = new Set(['/sw.js', '/asset-manifest.json'])
const CRA_ASSET_PREFIXES = ['/static/', '/font/', '/icons/', '/img/', '/md/', '/screenshots/', '/tinymce/']
const FAX_BACKEND_PREFIXES = ['/fax/boxes/', '/fax/render/', '/fax/text/']

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

// Structured one-line log of the SSR-vs-CRA routing decision, per NAVIGATION,
// to the Next process stdout → Vector → VictoriaLogs. Purpose: make both
// misroute directions queryable (see docs/reference/render-decision-logsql.md).
// `suspect` = a browser served SSR (human→SSR). Headers only — no IP/PII.
// Non-navigations (POST/etc.), CRA assets, and SEO assets are skipped by the
// callers / this guard. Disable entirely with BOM_LOG_RENDER_DECISION=0.
function logRenderDecision(
  request: NextRequest,
  decision: Decision,
  servedMode: RenderMode,
  pathname: string,
): void {
  if (process.env.BOM_LOG_RENDER_DECISION === '0') return
  if (!decision.isNav) return
  const h = request.headers
  // Serve-time tripwires — computed against the ACTUAL served mode (only the
  // middleware knows it; classify() only recommends). suspect = a browser
  // navigation that still landed on SSR (human→SSR regression); leak = a crawler
  // that reached the CRA (bot→CRA regression). Both should be ~0; a non-zero
  // count is a routing regression to investigate (see the LogsQL query set).
  // Exclude the ssr.* mirror hosts from `suspect`: a browser served SSR there is
  // intentional (force-SSR), not a misroute.
  const suspect = servedMode === 'ssr' && decision.browserUa && !decision.isbotHit
    && !isForceSsrHost(h.get('x-forwarded-host') ?? h.get('host'))
  const leak = servedMode === 'cra' && decision.isbotHit
  console.log(JSON.stringify({
    tag: 'render-decision',
    suspect,
    leak,
    render: servedMode,
    class: decision.clientClass,
    crawlerFamily: decision.crawlerFamily,
    isMobile: decision.isMobile,
    isNav: decision.isNav,
    isbotHit: decision.isbotHit,
    browserUa: decision.browserUa,
    signal: decision.signal,
    host: h.get('x-forwarded-host') ?? h.get('host') ?? null,
    path: pathname,
    method: request.method,
    ua: h.get('user-agent') ?? '',
    secFetchMode: h.get('sec-fetch-mode'),
    secFetchDest: h.get('sec-fetch-dest'),
    secFetchSite: h.get('sec-fetch-site'),
    secFetchUser: h.get('sec-fetch-user'),
    secChUa: h.get('sec-ch-ua'),
    secChUaMobile: h.get('sec-ch-ua-mobile'),
    secChUaPlatform: h.get('sec-ch-ua-platform'),
  }))
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
  const decision = classify({ method: request.method, ua, secChUaMobile: request.headers.get('sec-ch-ua-mobile') })
  const clientClass = decision.clientClass

  // --- Host redirect: www.* → bare domain ---
  if (hostname.startsWith('www.')) {
    const url = request.nextUrl.clone()
    url.hostname = hostname.slice(4)
    return markResponse(NextResponse.redirect(url, 301), clientClass)
  }

  // --- Host allowlist: unauthorized hosts → canonical English (path preserved) ---
  // Fires before the SSR/CRA branch, so crawlers AND browsers are forwarded.
  // Infra/local hosts (health checks, dev, IP literals, single-label names) pass
  // through. Keyed off x-forwarded-host because behind ALB→NPM the public host
  // arrives there, not in nextUrl.hostname (same reason langForHost reads it).
  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  // The ssr.* mirror hosts serve the SSR render to EVERY client (browsers
  // included) so crawler output can be inspected in a normal browser. They are
  // authorized (below), and force the SSR branch (further down) regardless of UA.
  const forceSsr = isForceSsrHost(forwardedHost)

  // --- Legacy preview-image host: img.* → path-based social card (/preview) ---
  // The old PHP GD service (img.bookofmormon.online/<slug>) is ported to the
  // /preview route; rewrite any path on these hosts to it, with the host's lang.
  if (isPreviewHost(forwardedHost)) {
    const lang = langForHost(forwardedHost)
    const url = request.nextUrl.clone()
    url.pathname = '/preview'
    url.search = ''
    // Pass the slug + lang via HEADERS, not query: a route handler sees the
    // ORIGINAL request.url after a rewrite, so rewritten query params are lost.
    // x-lang also drives the /preview data queries (gql reads it).
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-lang', lang)
    requestHeaders.set('x-preview-q', pathname.replace(/^\/+/, ''))
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

  if (!isInfraHost(forwardedHost) && !isAuthorizedHost(forwardedHost)) {
    // Hardcode https — the site is HTTPS-only and markResponse sets HSTS; keying
    // off x-forwarded-proto risks emitting an http:// Location (extra upgrade hop).
    const target = `https://${CANONICAL_EN_HOST}${pathname}${request.nextUrl.search}`
    return markResponse(NextResponse.redirect(target, 301), clientClass)
  }

  // These platform-association resources must never fall through to the CRA
  // HTML shell. Android and PWABuilder fetch them without browser-navigation
  // headers, and the TWA contract requires exact JSON at these exact paths.
  if (pathname === '/manifest.json') {
    const response = NextResponse.json(PWA_MANIFEST)
    response.headers.set('Content-Type', 'application/manifest+json; charset=utf-8')
    return markResponse(response, clientClass, 'asset')
  }
  if (pathname === '/.well-known/assetlinks.json') {
    return markResponse(NextResponse.json(ANDROID_ASSET_LINKS), clientClass, 'asset')
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
  // On a force-SSR host, page navigations skip the CRA and fall through to the
  // SSR branch (CRA static assets are still served so nothing 404s).
  if (!isSeoAsset && (isCraAsset(pathname) || (decision.renderMode === 'cra' && !forceSsr))) {
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
    // Log real page navigations only — not CRA static assets (/static/, fonts…).
    if (!isCraAsset(pathname)) logRenderDecision(request, decision, 'cra', pathname)
    const target = new URL(CRA_ORIGIN + pathname + request.nextUrl.search)
    const craRes = await fetch(target, { redirect: 'follow' })
    const craResponse = markResponse(new Response(craRes.body, {
      status: craRes.status,
      headers: responseHeadersForClient(craRes.headers),
    }), clientClass, 'cra')
    if (!isCraAsset(pathname)) {
      // The HTML shell is UA-routed. Cloudflare ignores Vary, so Cache-Control is
      // the real guard against a shared cache serving the wrong app; Vary covers
      // well-behaved caches. Hashed static assets keep their own long-lived caching.
      const craVary = craResponse.headers.get('Vary')
      craResponse.headers.set('Vary', craVary ? `${craVary}, User-Agent` : 'User-Agent')
      craResponse.headers.set('Cache-Control', 'private, no-cache')
    } else if (pathname === '/sw.js') {
      // The service-worker script must NOT be edge/browser cached, or a SW update
      // (and the client fixes it carries — e.g. evicting a poisoned cache) won't
      // reach clients until the cache TTL expires. Force revalidation every time.
      craResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    }
    return craResponse
  }

  // --- Bot/crawler: serve Next.js SSR with lang header ---
  // Language is by HOST (subdomain/domain), not URL path.
  const lang = langForHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'))
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-lang', lang)
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('X-Resolved-Lang', lang)
  const ssrMode: RenderMode = isSeoAsset ? 'asset' : 'ssr'
  if (!isSeoAsset) logRenderDecision(request, decision, ssrMode, pathname)
  markResponse(res, clientClass, ssrMode)
  // Only real page NAVIGATIONS are UA-varied HTML. Gate on decision.isNav too so
  // non-nav requests that fall through to SSR (e.g. an API POST to /{lang}) don't
  // get a spurious `Vary: User-Agent` on a non-HTML response.
  if (!isSeoAsset && decision.isNav) {
    // Merge, not clobber: the app-router may set its own Vary (RSC/Next-Router-*).
    const ssrVary = res.headers.get('Vary')
    res.headers.set('Vary', ssrVary ? `${ssrVary}, User-Agent` : 'User-Agent')
    res.headers.set('Cache-Control', 'private, no-cache')
  }
  if (forceSsr || seoIntentForPath(pathname) === 'noindex') {
    // The ssr.* mirror hosts are a QA preview of the SSR render — never let a
    // crawler index them (canonical already points at the real host; this is
    // belt-and-suspenders so the mirror can't surface in search).
    res.headers.set('X-Robots-Tag', 'noindex, follow')
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
