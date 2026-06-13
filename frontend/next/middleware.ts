export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

// Language codes that can appear as URL path prefixes (e.g. /ko/1-nephi/1)
const LANG_PREFIXES = ['ko', 'fr', 'de', 'es', 'pt', 'ja', 'zh']

export function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl

  // --- Host redirect: www.* → bare domain ---
  if (hostname.startsWith('www.')) {
    const bare = hostname.slice(4)
    const url = request.nextUrl.clone()
    url.hostname = bare
    return NextResponse.redirect(url, 301)
  }

  // --- Language detection from path prefix ---
  const segments = pathname.split('/').filter(Boolean)
  const lang = LANG_PREFIXES.includes(segments[0]) ? segments[0] : 'en'

  // Pass language to server components via response header
  const response = NextResponse.next()
  response.headers.set('x-lang', lang)
  return response
}

export const config = {
  // Run middleware on every route except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
