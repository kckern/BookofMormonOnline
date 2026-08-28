import type { NextRequest } from 'next/server'

// Clicky anti-adblock reverse proxy (https://clicky.com/help/proxy).
//
// All Clicky identifiers are account-specific and THIS REPO IS PUBLIC, so the
// obfuscated public paths come from env (Infisical), never hardcoded:
//   CLICKY_JS_PATH      e.g. /xxxxxxxxxxxxxxxxxx.js   (public JS path)
//   CLICKY_BEACON_PATH  e.g. /yyyyyyyyyyyyyyyyyy      (public beacon path)
// Rotating the paths in the Clicky dashboard = update env, no code change.
// See docs/reference/clicky-integration.md.

export function clickyPaths() {
  return {
    js: process.env.CLICKY_JS_PATH ?? '',
    beacon: process.env.CLICKY_BEACON_PATH ?? '',
  }
}

const JS_UPSTREAM = 'https://static.getclicky.com/js'
const BEACON_UPSTREAM = 'https://in.getclicky.com/in.php'

// Serve Clicky's tracker JS fresh (no vendored copy to drift). The `in=` param
// bakes our first-party beacon path into the returned script, so beacons POST
// back to our origin instead of getclicky.com.
export async function proxyClickyJs(): Promise<Response> {
  const { beacon } = clickyPaths()
  const upstream = await fetch(`${JS_UPSTREAM}?in=${encodeURIComponent(beacon)}`, {
    cache: 'no-store',
  })
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // Static tracker JS — safe to cache at browser/edge for an hour.
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

// Forward a tracking beacon to Clicky. We proxy server-side, so we must pass the
// real visitor IP (X-Forwarded-For) and UA, or every hit would look like it came
// from our server.
export async function proxyClickyBeacon(req: NextRequest): Promise<Response> {
  const xff = req.headers.get('x-forwarded-for') ?? ''
  const clientIp = xff.split(',').map((s) => s.trim()).filter(Boolean)[0] ?? ''

  const headers: Record<string, string> = {
    Host: 'in.getclicky.com',
    'User-Agent': req.headers.get('user-agent') ?? '',
    'X-Forwarded-For': clientIp,
    'X-Forwarded-Proto': req.nextUrl.protocol.replace(':', ''),
    'X-Forwarded-Host': req.headers.get('host') ?? '',
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  }
  if (req.method === 'POST') {
    init.body = await req.text()
    headers['Content-Type'] =
      req.headers.get('content-type') ?? 'application/x-www-form-urlencoded'
  }

  const upstream = await fetch(BEACON_UPSTREAM + (req.nextUrl.search ?? ''), init)
  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'text/plain',
      // Tracking write — never cache (Cloudflare or browser).
      'Cache-Control': 'no-store',
    },
  })
}
