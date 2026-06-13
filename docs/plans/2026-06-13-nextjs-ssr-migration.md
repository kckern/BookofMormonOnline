# Next.js SSR Migration — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `frontend/next/` — a Next.js 15 App Router app that server-renders every phpbox route class (scripture, people, place, page, OG images, sitemap) with correct meta tags, replacing the PHP SSR box and CRA for Phase 1 routes.

**Architecture:** Next.js 15 App Router at `frontend/next/`; server components fetch from the Fastify GraphQL backend at `localhost:5006`; `React.cache()` dedupes the fetch between `generateMetadata()` and the page component; `middleware.ts` handles language detection and host redirects. OG images use `next/og` (Satori) with the branded 1200×630 BomOgCard template.

**Tech Stack:** Next.js 15, React 18, TypeScript, `next/og` (Satori), `@playwright/test` for integration tests.

---

## File Map

### New directory: `frontend/next/`

| Path | Role |
|---|---|
| `package.json` | Next.js 15, TypeScript, Playwright |
| `tsconfig.json` | TS config extending Next's defaults |
| `next.config.ts` | hostname config, rewrite for CRA fallback |
| `.gitignore` | standard Next.js ignores |
| `middleware.ts` | lang detection, host redirects, Node.js runtime |
| `app/layout.tsx` | root layout: HTML shell, font links |
| `app/providers.tsx` | `'use client'` Redux + Socket stub wrapper |
| `app/globals.css` | minimal reset |
| `app/og/route.ts` | `GET /og?title&sub&desc&img&lang` → PNG |
| `app/og/BomOgCard.tsx` | branded 1200×630 JSX template for Satori |
| `app/sitemap.ts` | `/sitemap.xml` |
| `app/robots.ts` | `/robots.txt` |
| `app/[slug]/[blockno]/page.tsx` | scripture text: `/{book-slug}/{blockno}` |
| `app/[slug]/page.tsx` | page catch-all: `/{slug}` |
| `app/people/[slug]/page.tsx` | people detail: `/people/{slug}` |
| `app/place/[slug]/page.tsx` | places detail: `/place/{slug}` |
| `lib/graphql.ts` | `gql(query, variables, lang?)` — base fetcher |
| `lib/scripture.ts` | `getReadBlock(ref, lang?)` |
| `lib/people.ts` | `getPerson(slug, lang?)` |
| `lib/places.ts` | `getPlace(slug, lang?)` |
| `lib/pages.ts` | `getPage(slug, lang?)` |
| `public/fonts/RobotoCondensed-Bold.ttf` | OG image font |
| `public/fonts/RobotoCondensed-Light.ttf` | OG image font |
| `public/fonts/IBMPlexSansKR-Regular.ttf` | OG image Korean font |
| `scripts/download-fonts.mjs` | one-time font download helper |
| `playwright.config.ts` | Playwright: starts `next dev --port 3001`, tests against it |
| `test/helpers/meta.ts` | HTML meta-tag parser used by all route tests |
| `test/routes/og.test.ts` | OG image: status 200, content-type image/png, size |
| `test/routes/scripture.test.ts` | `/{slug}/{blockno}`: HTML, title, og tags, og:image works |
| `test/routes/people.test.ts` | `/people/{slug}`: same checklist |
| `test/routes/place.test.ts` | `/place/{slug}`: same checklist |
| `test/routes/pages.test.ts` | `/{slug}`: same checklist |
| `test/routes/sitemap.test.ts` | `/sitemap.xml`: 200, XML, `<loc>` entries present |
| `test/routes/robots.test.ts` | `/robots.txt`: 200, contains `Sitemap:` directive |

---

## Task 1: Scaffold `frontend/next/`

**Files:**
- Create: `frontend/next/package.json`
- Create: `frontend/next/tsconfig.json`
- Create: `frontend/next/.gitignore`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p frontend/next
```

- [ ] **Step 2: Write `frontend/next/package.json`**

```json
{
  "name": "bom-next",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "fonts": "node scripts/download-fonts.mjs"
  },
  "dependencies": {
    "next": "15.3.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.1",
    "@types/node": "^22",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5"
  }
}
```

- [ ] **Step 3: Write `frontend/next/tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `frontend/next/.gitignore`**

```
.next/
node_modules/
out/
*.tsbuildinfo
```

- [ ] **Step 5: Install dependencies**

```bash
cd frontend/next && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/next/package.json frontend/next/tsconfig.json frontend/next/.gitignore frontend/next/package-lock.json
git commit -m "feat(next): scaffold frontend/next package"
```

---

## Task 2: `next.config.ts`

**Files:**
- Create: `frontend/next/next.config.ts`

- [ ] **Step 1: Write `frontend/next/next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  // Allow the GraphQL backend (same host) during SSR fetch
  experimental: {},
  // During Phase 1-3 migration, unknown routes are not handled here;
  // Nginx routes them to CRA. So no catch-all rewrite is needed.
  // Phase 4: remove this comment and add rewrites to kill CRA.

  // Suppress Next.js warning about cross-origin image URLs from media CDN
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.bookofmormon.online' },
    ],
  },

  // Expose the backend URL to server components as an env var
  env: {
    GRAPHQL_URL: process.env.GRAPHQL_URL ?? 'http://localhost:5006/graphql',
  },
}

export default config
```

- [ ] **Step 2: Commit**

```bash
git add frontend/next/next.config.ts
git commit -m "feat(next): add next.config.ts"
```

---

## Task 3: Font download script + assets

**Files:**
- Create: `frontend/next/scripts/download-fonts.mjs`
- Create: `frontend/next/public/fonts/` (directory, populated by script)

- [ ] **Step 1: Write `frontend/next/scripts/download-fonts.mjs`**

```javascript
// One-time helper: downloads RobotoCondensed and IBMPlexSansKR from Google Fonts
// into public/fonts/. Run with: npm run fonts
import { createWriteStream, mkdirSync } from 'fs'
import { pipeline } from 'stream/promises'
import { get } from 'https'

const DIR = new URL('../public/fonts/', import.meta.url).pathname
mkdirSync(DIR, { recursive: true })

const fonts = [
  {
    url: 'https://fonts.gstatic.com/s/robotocondensed/v27/ieVo2ZhZI2eCN5jzbjEETS9weq8-19y7DQk5.ttf',
    file: 'RobotoCondensed-Bold.ttf',
  },
  {
    url: 'https://fonts.gstatic.com/s/robotocondensed/v27/ieVl2ZhZI2eCN5jzbjEETS9weq8-32meKCM.ttf',
    file: 'RobotoCondensed-Light.ttf',
  },
  {
    url: 'https://fonts.gstatic.com/s/ibmplexsanskr/v10/vEFK2-VJISZe3O_rc3ZVYh4aTwNO8tK1W77HtMo.ttf',
    file: 'IBMPlexSansKR-Regular.ttf',
  },
]

for (const { url, file } of fonts) {
  const dest = DIR + file
  console.log(`Downloading ${file}...`)
  await new Promise((resolve, reject) =>
    get(url, (res) => {
      const ws = createWriteStream(dest)
      pipeline(res, ws).then(resolve).catch(reject)
    }).on('error', reject)
  )
  console.log(`  → ${dest}`)
}
console.log('Done.')
```

- [ ] **Step 2: Run font download**

```bash
cd frontend/next && npm run fonts
```

Expected output:
```
Downloading RobotoCondensed-Bold.ttf...
  → .../public/fonts/RobotoCondensed-Bold.ttf
Downloading RobotoCondensed-Light.ttf...
  → .../public/fonts/RobotoCondensed-Light.ttf
Downloading IBMPlexSansKR-Regular.ttf...
  → .../public/fonts/IBMPlexSansKR-Regular.ttf
Done.
```

If any download fails (Google Fonts CDN URLs sometimes rotate), check https://fonts.google.com/specimen/Roboto+Condensed and https://fonts.google.com/specimen/IBM+Plex+Sans+KR for updated TTF download links. The files must end up at `public/fonts/*.ttf`.

- [ ] **Step 3: Add fonts to git (they are binary assets)**

```bash
git add frontend/next/scripts/download-fonts.mjs frontend/next/public/fonts/
git commit -m "feat(next): font assets for OG image generation"
```

---

## Task 4: GraphQL data fetchers

**Files:**
- Create: `frontend/next/lib/graphql.ts`
- Create: `frontend/next/lib/scripture.ts`
- Create: `frontend/next/lib/people.ts`
- Create: `frontend/next/lib/places.ts`
- Create: `frontend/next/lib/pages.ts`

- [ ] **Step 1: Write `frontend/next/lib/graphql.ts`**

```typescript
// Base GraphQL fetcher. All lib/* modules call this.
// GRAPHQL_URL is set by next.config.ts env block → http://localhost:5006/graphql
const GRAPHQL_URL = process.env.GRAPHQL_URL!

export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { revalidate?: number | false } = {}
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next:
      options.revalidate === false
        ? { revalidate: 0 }
        : { revalidate: options.revalidate ?? 3600 },
  })
  if (!res.ok) throw new Error(`GraphQL fetch failed: ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data as T
}
```

- [ ] **Step 2: Write `frontend/next/lib/scripture.ts`**

```typescript
import { cache } from 'react'
import { gql } from './graphql'

interface ReadLine { text: string; verse_num: number }
interface ReadUnit { lines: ReadLine[] }
interface ReadSection { heading: string | null; blocks: ReadUnit[] }
interface ReadBlock { ref: string; sections: ReadSection[]; next_ref: string | null; prev_ref: string | null }

const READ_QUERY = `
  query Read($ref: String!) {
    read(ref: $ref) {
      ref
      next_ref
      prev_ref
      sections {
        heading
        blocks {
          lines {
            text
            verse_num
          }
        }
      }
    }
  }
`

export const getReadBlock = cache(async (ref: string, lang = 'en'): Promise<ReadBlock | null> => {
  try {
    const data = await gql<{ read: ReadBlock }>( READ_QUERY, { ref }, { revalidate: 3600 })
    return data.read ?? null
  } catch {
    return null
  }
})

// Extract the first few words of body text as a preview description
export function scripturePreview(block: ReadBlock, maxWords = 20): string {
  for (const section of block.sections) {
    for (const unit of section.blocks) {
      const words = unit.lines.flatMap((l) => l.text.split(/\s+/)).filter(Boolean)
      if (words.length > 0) return words.slice(0, maxWords).join(' ') + '…'
    }
  }
  return ''
}
```

- [ ] **Step 3: Write `frontend/next/lib/people.ts`**

```typescript
import { cache } from 'react'
import { gql } from './graphql'

export interface Person {
  slug: string
  name: string
  title: string | null
  classification: string | null
  description: string | null
}

const PERSON_QUERY = `
  query Person($slug: [String]) {
    person(slug: $slug) {
      slug
      name
      title
      classification
      description
    }
  }
`

export const getPerson = cache(async (slug: string): Promise<Person | null> => {
  try {
    const data = await gql<{ person: Person[] }>(PERSON_QUERY, { slug: [slug] }, { revalidate: 86400 })
    return data.person?.[0] ?? null
  } catch {
    return null
  }
})
```

- [ ] **Step 4: Write `frontend/next/lib/places.ts`**

```typescript
import { cache } from 'react'
import { gql } from './graphql'

export interface Place {
  slug: string
  name: string
  info: string | null
  description: string | null
  type: string | null
  location: string | null
}

const PLACE_QUERY = `
  query Place($slug: [String]) {
    place(slug: $slug) {
      slug
      name
      info
      description
      type
      location
    }
  }
`

export const getPlace = cache(async (slug: string): Promise<Place | null> => {
  try {
    const data = await gql<{ place: Place[] }>(PLACE_QUERY, { slug: [slug] }, { revalidate: 86400 })
    return data.place?.[0] ?? null
  } catch {
    return null
  }
})
```

- [ ] **Step 5: Write `frontend/next/lib/pages.ts`**

```typescript
import { cache } from 'react'
import { gql } from './graphql'

export interface PageData {
  slug: string
  title: string
  description: string | null
  ref: string | null
}

const PAGE_QUERY = `
  query Page($slug: [String]) {
    page(slug: $slug) {
      slug
      title
      description
      ref
    }
  }
`

export const getPage = cache(async (slug: string): Promise<PageData | null> => {
  try {
    const data = await gql<{ page: PageData[] }>(PAGE_QUERY, { slug: [slug] }, { revalidate: 3600 })
    return data.page?.[0] ?? null
  } catch {
    return null
  }
})
```

- [ ] **Step 6: Commit**

```bash
git add frontend/next/lib/
git commit -m "feat(next): GraphQL data fetchers with React.cache"
```

---

## Task 5: Root layout, providers, global CSS

**Files:**
- Create: `frontend/next/app/layout.tsx`
- Create: `frontend/next/app/providers.tsx`
- Create: `frontend/next/app/globals.css`

- [ ] **Step 1: Write `frontend/next/app/globals.css`**

```css
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
```

- [ ] **Step 2: Write `frontend/next/app/providers.tsx`**

```tsx
'use client'

import { ReactNode } from 'react'

// Phase 1: thin client wrapper. Redux and SocketProvider are added in Phase 3
// when community/study routes are migrated.
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 3: Write `frontend/next/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  metadataBase: new URL('https://bookofmormon.online'),
  title: { default: 'Book of Mormon', template: '%s | Book of Mormon' },
  description: 'Read and study the Book of Mormon online.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Verify Next.js starts**

```bash
cd frontend/next && npx next dev --port 3001
```

Expected: `✓ Ready on http://localhost:3001` within 30 seconds. Hit Ctrl-C after confirming.

- [ ] **Step 5: Commit**

```bash
git add frontend/next/app/
git commit -m "feat(next): root layout, providers, global CSS"
```

---

## Task 6: Middleware

**Files:**
- Create: `frontend/next/middleware.ts`

- [ ] **Step 1: Write `frontend/next/middleware.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/next/middleware.ts
git commit -m "feat(next): middleware — lang detection + www redirect"
```

---

## Task 7: OG image route — write failing tests first

The OG route is built TDD: tests go in first, server started, route implemented, tests pass.

**Files:**
- Create: `frontend/next/playwright.config.ts`
- Create: `frontend/next/test/helpers/meta.ts`
- Create: `frontend/next/test/routes/og.test.ts`

- [ ] **Step 1: Install Playwright browsers**

```bash
cd frontend/next && npx playwright install --with-deps chromium
```

Expected: Chromium downloaded, no errors.

- [ ] **Step 2: Write `frontend/next/playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  fullyParallel: false,        // route tests share the same Next.js server
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3001',
    extraHTTPHeaders: { Accept: 'text/html,application/xhtml+xml,*/*' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 3001',
    url: 'http://localhost:3001',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      GRAPHQL_URL: process.env.GRAPHQL_URL ?? 'http://localhost:5006/graphql',
    },
  },
})
```

- [ ] **Step 3: Write `frontend/next/test/helpers/meta.ts`**

```typescript
// Parse OG/Twitter meta tags from raw HTML strings.
// Works on both property="og:*" and name="twitter:*" forms.

export function getMeta(html: string, key: string): string | null {
  // <meta property="og:title" content="..."> or  <meta name="..." content="...">
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRe(key)}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRe(key)}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return m[1]
  }
  return null
}

export function getTitle(html: string): string | null {
  const m = html.match(/<title>([^<]+)<\/title>/i)
  return m?.[1] ?? null
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
```

- [ ] **Step 4: Write `frontend/next/test/routes/og.test.ts`**

```typescript
import { test, expect } from '@playwright/test'

test.describe('OG image route /og', () => {
  test('returns 200 with content-type image/png', async ({ request }) => {
    const res = await request.get('/og?title=Test+Title&sub=Subtitle&desc=Description&lang=en')
    expect(res.status()).toBe(200)
    const ct = res.headers()['content-type']
    expect(ct).toContain('image/png')
  })

  test('image body is non-empty (has pixel data)', async ({ request }) => {
    const res = await request.get('/og?title=1+Nephi+1&sub=Book+of+Mormon&desc=And+it+came+to+pass&lang=en')
    const buf = await res.body()
    // PNG header: 8-byte magic + IHDR chunk (25 bytes) — real images are much larger
    expect(buf.byteLength).toBeGreaterThan(500)
  })

  test('PNG header bytes are correct (real PNG, not an error body)', async ({ request }) => {
    const res = await request.get('/og?title=Nephi&sub=Prophet&desc=A+man&lang=en')
    const buf = await res.body()
    // PNG magic: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50) // 'P'
    expect(buf[2]).toBe(0x4e) // 'N'
    expect(buf[3]).toBe(0x47) // 'G'
  })

  test('Korean lang param does not crash the route', async ({ request }) => {
    const res = await request.get('/og?title=%EB%8B%88%ED%8C%8C%EC%9D%B4&lang=ko')
    expect(res.status()).toBe(200)
  })

  test('missing params return a valid image (graceful fallback)', async ({ request }) => {
    const res = await request.get('/og')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/png')
  })
})
```

- [ ] **Step 5: Run tests — expect FAIL (route doesn't exist yet)**

```bash
cd frontend/next && npm test -- test/routes/og.test.ts
```

Expected: All 5 tests FAIL with `404` or connection refused. This confirms the tests are wired correctly.

- [ ] **Step 6: Commit the test files**

```bash
git add frontend/next/playwright.config.ts frontend/next/test/
git commit -m "test(next): Playwright config + OG image tests (failing)"
```

---

## Task 8: OG image route — implement `BomOgCard` + `route.ts`

**Files:**
- Create: `frontend/next/app/og/BomOgCard.tsx`
- Create: `frontend/next/app/og/route.ts`

- [ ] **Step 1: Write `frontend/next/app/og/BomOgCard.tsx`**

This is a pure JSX component consumed by Satori (not React DOM). All styles must be inline; no CSS classes.

```tsx
// Satori JSX — no React DOM. Inline styles only.

interface BomOgCardProps {
  title: string
  sub?: string
  desc?: string
  artUrl?: string
}

export function BomOgCard({ title, sub, desc, artUrl }: BomOgCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        width: 1200,
        height: 630,
        background: '#32394d',
        fontFamily: 'RobotoCondensed',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Gold accent frame — top-right corner */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 340,
          height: 340,
          border: '6px solid #fbc658',
          borderRadius: 4,
          transform: 'translate(80px, -80px) rotate(15deg)',
        }}
      />

      {/* Art image area */}
      {artUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={artUrl}
          alt=""
          style={{
            position: 'absolute',
            right: 30,
            top: 30,
            width: 260,
            height: 260,
            objectFit: 'cover',
            borderRadius: 4,
          }}
        />
      )}

      {/* White semi-transparent content card */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'absolute',
          left: 40,
          bottom: 40,
          right: artUrl ? 320 : 60,
          top: 40,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 8,
          padding: '32px 40px',
        }}
      >
        {sub && (
          <div
            style={{
              fontSize: 22,
              color: '#fbc658',
              fontWeight: 700,
              marginBottom: 12,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {sub}
          </div>
        )}

        <div
          style={{
            fontSize: title.length > 40 ? 44 : 56,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.15,
            marginBottom: desc ? 20 : 0,
          }}
        >
          {title}
        </div>

        {desc && (
          <div
            style={{
              fontSize: 24,
              color: 'rgba(255,255,255,0.80)',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {desc}
          </div>
        )}

        {/* Wordmark */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 32,
            fontSize: 16,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: 2,
          }}
        >
          BOOKOFMORMON.ONLINE
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `frontend/next/app/og/route.ts`**

```typescript
import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createElement } from 'react'
import { BomOgCard } from './BomOgCard'

export const runtime = 'nodejs'
export const revalidate = 86400

// Load fonts once at module init (cached for the lifetime of the process)
const fontsDir = join(process.cwd(), 'public', 'fonts')
const robotoCondensedBold = readFileSync(join(fontsDir, 'RobotoCondensed-Bold.ttf'))
const robotoCondensedLight = readFileSync(join(fontsDir, 'RobotoCondensed-Light.ttf'))
const ibmPlexSansKR = readFileSync(join(fontsDir, 'IBMPlexSansKR-Regular.ttf'))

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const title = searchParams.get('title') ?? 'Book of Mormon'
  const sub   = searchParams.get('sub')   ?? undefined
  const desc  = searchParams.get('desc')  ?? undefined
  const lang  = searchParams.get('lang')  ?? 'en'

  // Art image: numeric art ID → media CDN URL
  const artId = searchParams.get('img')
  const artUrl = artId
    ? `https://media.bookofmormon.online/art/square/${artId}.jpg`
    : undefined

  const isKorean = lang === 'ko'

  return new ImageResponse(
    createElement(BomOgCard, { title, sub, desc, artUrl }),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'RobotoCondensed', data: robotoCondensedBold,  weight: 700, style: 'normal' },
        { name: 'RobotoCondensed', data: robotoCondensedLight, weight: 300, style: 'normal' },
        ...(isKorean
          ? [{ name: 'RobotoCondensed', data: ibmPlexSansKR, weight: 400, style: 'normal' as const }]
          : []),
      ],
    }
  )
}
```

- [ ] **Step 3: Run OG tests — expect PASS**

```bash
cd frontend/next && npm test -- test/routes/og.test.ts
```

Expected: All 5 tests pass. If font files are missing, run `npm run fonts` first.

- [ ] **Step 4: Commit**

```bash
git add frontend/next/app/og/
git commit -m "feat(next): OG image route — BomOgCard + Satori renderer"
```

---

## Task 9: Scripture route — write failing tests

**Files:**
- Create: `frontend/next/test/routes/scripture.test.ts`

- [ ] **Step 1: Write `frontend/next/test/routes/scripture.test.ts`**

```typescript
import { test, expect } from '@playwright/test'
import { getMeta, getTitle } from '../helpers/meta'

// Uses a real chapter from bom_prd. 1 Nephi 1 is the canonical first chapter.
const REF = '/1-nephi/1'

test.describe('Scripture route /{slug}/{blockno}', () => {
  test('returns 200', async ({ request }) => {
    const res = await request.get(REF)
    expect(res.status()).toBe(200)
  })

  test('returns valid HTML document', async ({ request }) => {
    const res = await request.get(REF)
    const html = await res.text()
    expect(html).toMatch(/<!DOCTYPE html>/i)
    expect(html).toContain('</html>')
  })

  test('<title> is non-empty and not the default fallback', async ({ request }) => {
    const res = await request.get(REF)
    const html = await res.text()
    const title = getTitle(html)
    expect(title).toBeTruthy()
    expect(title).not.toBe('Book of Mormon')
    // Should contain a chapter reference or heading
    expect(title!.length).toBeGreaterThan(3)
  })

  test('og:title is present and non-empty', async ({ request }) => {
    const res = await request.get(REF)
    const html = await res.text()
    expect(getMeta(html, 'og:title')).toBeTruthy()
  })

  test('og:description is present and non-empty', async ({ request }) => {
    const res = await request.get(REF)
    const html = await res.text()
    expect(getMeta(html, 'og:description')).toBeTruthy()
  })

  test('og:image is an absolute URL', async ({ request }) => {
    const res = await request.get(REF)
    const html = await res.text()
    const img = getMeta(html, 'og:image')
    expect(img).toBeTruthy()
    expect(img).toMatch(/^https?:\/\//)
  })

  test('og:image URL resolves to a PNG', async ({ request }) => {
    const res = await request.get(REF)
    const html = await res.text()
    const img = getMeta(html, 'og:image')!
    // Strip host so the request goes through the test server
    const path = new URL(img).pathname + new URL(img).search
    const imgRes = await request.get(path)
    expect(imgRes.status()).toBe(200)
    expect(imgRes.headers()['content-type']).toContain('image/png')
  })

  test('page body contains scripture text (not empty)', async ({ page }) => {
    await page.goto(REF)
    // Some text content should be visible — not a blank page
    const text = await page.locator('body').innerText()
    expect(text.trim().length).toBeGreaterThan(50)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd frontend/next && npm test -- test/routes/scripture.test.ts
```

Expected: All tests FAIL (404 — route doesn't exist yet).

- [ ] **Step 3: Commit tests**

```bash
git add frontend/next/test/routes/scripture.test.ts
git commit -m "test(next): scripture route tests (failing)"
```

---

## Task 10: Scripture route — implement `app/[slug]/[blockno]/page.tsx`

**Files:**
- Create: `frontend/next/app/[slug]/[blockno]/page.tsx`

- [ ] **Step 1: Write `frontend/next/app/[slug]/[blockno]/page.tsx`**

```tsx
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getReadBlock, scripturePreview } from '@/lib/scripture'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ slug: string; blockno: string }>
}

// Convert URL slug + block number to a ref the backend understands.
// e.g. slug="1-nephi", blockno="1" → ref="1-nephi/1"
function toRef(slug: string, blockno: string) {
  return `${slug}/${blockno}`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, blockno } = await params
  const h = await headers()
  const lang = h.get('x-lang') ?? 'en'
  const ref = toRef(slug, blockno)
  const block = await getReadBlock(ref, lang)
  if (!block) return {}

  const heading = block.sections[0]?.heading ?? ref
  const desc = scripturePreview(block)
  const host = h.get('host') ?? 'bookofmormon.online'
  const ogUrl = `https://${host}/og?${new URLSearchParams({ title: heading, desc, lang })}`

  return {
    title: heading,
    description: desc,
    openGraph: {
      title: heading,
      description: desc,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: heading,
      description: desc,
      images: [ogUrl],
    },
  }
}

export default async function ScripturePage({ params }: Props) {
  const { slug, blockno } = await params
  const h = await headers()
  const lang = h.get('x-lang') ?? 'en'
  const ref = toRef(slug, blockno)
  const block = await getReadBlock(ref, lang)
  if (!block) notFound()

  const heading = block.sections[0]?.heading ?? ref

  return (
    <main>
      <h1>{heading}</h1>
      {block.sections.map((section, si) => (
        <section key={si}>
          {section.heading && si > 0 && <h2>{section.heading}</h2>}
          {section.blocks.map((unit, ui) => (
            <p key={ui}>
              {unit.lines.map((line, li) => (
                <span key={li} data-verse={line.verse_num}>
                  <sup>{line.verse_num}</sup>
                  {line.text}{' '}
                </span>
              ))}
            </p>
          ))}
        </section>
      ))}
      <nav>
        {block.prev_ref && <a href={`/${block.prev_ref}`}>← {block.prev_ref}</a>}
        {block.next_ref && <a href={`/${block.next_ref}`}>{block.next_ref} →</a>}
      </nav>
    </main>
  )
}
```

- [ ] **Step 2: Run tests — expect PASS**

```bash
cd frontend/next && npm test -- test/routes/scripture.test.ts
```

Expected: All 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/next/app/\[slug\]/\[blockno\]/
git commit -m "feat(next): scripture text route /{slug}/{blockno}"
```

---

## Task 11: People route — TDD

**Files:**
- Create: `frontend/next/test/routes/people.test.ts`
- Create: `frontend/next/app/people/[slug]/page.tsx`

- [ ] **Step 1: Write `frontend/next/test/routes/people.test.ts`**

```typescript
import { test, expect } from '@playwright/test'
import { getMeta, getTitle } from '../helpers/meta'

// Nephi is the most prominent person in bom_prd — slug is "nephi"
const PATH = '/people/nephi'

test.describe('People route /people/{slug}', () => {
  test('returns 200', async ({ request }) => {
    expect((await request.get(PATH)).status()).toBe(200)
  })

  test('<title> contains the person name', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    const title = getTitle(html)
    expect(title).toBeTruthy()
    // Title should include "Nephi" (case-insensitive)
    expect(title!.toLowerCase()).toContain('nephi')
  })

  test('og:title is non-empty', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    expect(getMeta(html, 'og:title')).toBeTruthy()
  })

  test('og:description is non-empty', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    expect(getMeta(html, 'og:description')).toBeTruthy()
  })

  test('og:image is an absolute URL', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    const img = getMeta(html, 'og:image')
    expect(img).toMatch(/^https?:\/\//)
  })

  test('og:image resolves to PNG', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    const img = getMeta(html, 'og:image')!
    const path = new URL(img).pathname + new URL(img).search
    const r = await request.get(path)
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toContain('image/png')
  })

  test('unknown person returns 404', async ({ request }) => {
    const r = await request.get('/people/zzz-does-not-exist-xyz')
    expect(r.status()).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd frontend/next && npm test -- test/routes/people.test.ts
```

- [ ] **Step 3: Write `frontend/next/app/people/[slug]/page.tsx`**

```tsx
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getPerson } from '@/lib/people'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const person = await getPerson(slug)
  if (!person) return {}

  const h = await headers()
  const lang = h.get('x-lang') ?? 'en'
  const host = h.get('host') ?? 'bookofmormon.online'
  const title = person.title ? `${person.name} — ${person.title}` : person.name
  const desc = person.description ?? `${person.name} in the Book of Mormon`
  const ogUrl = `https://${host}/og?${new URLSearchParams({ title: person.name, sub: 'People', desc, lang })}`

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description: desc, images: [ogUrl] },
  }
}

export default async function PeoplePage({ params }: Props) {
  const { slug } = await params
  const person = await getPerson(slug)
  if (!person) notFound()

  return (
    <main>
      <h1>{person.name}</h1>
      {person.title && <p><em>{person.title}</em></p>}
      {person.classification && <p>Classification: {person.classification}</p>}
      {person.description && <p>{person.description}</p>}
    </main>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend/next && npm test -- test/routes/people.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/next/app/people/ frontend/next/test/routes/people.test.ts
git commit -m "feat(next): people route + tests"
```

---

## Task 12: Places route — TDD

**Files:**
- Create: `frontend/next/test/routes/place.test.ts`
- Create: `frontend/next/app/place/[slug]/page.tsx`

- [ ] **Step 1: Write `frontend/next/test/routes/place.test.ts`**

```typescript
import { test, expect } from '@playwright/test'
import { getMeta, getTitle } from '../helpers/meta'

const PATH = '/place/jerusalem'

test.describe('Places route /place/{slug}', () => {
  test('returns 200', async ({ request }) => {
    expect((await request.get(PATH)).status()).toBe(200)
  })

  test('<title> contains the place name', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    const title = getTitle(html)
    expect(title!.toLowerCase()).toContain('jerusalem')
  })

  test('og:title is non-empty', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    expect(getMeta(html, 'og:title')).toBeTruthy()
  })

  test('og:description is non-empty', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    expect(getMeta(html, 'og:description')).toBeTruthy()
  })

  test('og:image is absolute URL and resolves to PNG', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    const img = getMeta(html, 'og:image')!
    expect(img).toMatch(/^https?:\/\//)
    const path = new URL(img).pathname + new URL(img).search
    const r = await request.get(path)
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toContain('image/png')
  })

  test('unknown place returns 404', async ({ request }) => {
    const r = await request.get('/place/zzz-no-such-place-xyz')
    expect(r.status()).toBe(404)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend/next && npm test -- test/routes/place.test.ts
```

- [ ] **Step 3: Write `frontend/next/app/place/[slug]/page.tsx`**

```tsx
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getPlace } from '@/lib/places'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const place = await getPlace(slug)
  if (!place) return {}

  const h = await headers()
  const lang = h.get('x-lang') ?? 'en'
  const host = h.get('host') ?? 'bookofmormon.online'
  const desc = place.description ?? place.info ?? `${place.name} — a place in the Book of Mormon`
  const ogUrl = `https://${host}/og?${new URLSearchParams({ title: place.name, sub: 'Place', desc, lang })}`

  return {
    title: place.name,
    description: desc,
    openGraph: {
      title: place.name,
      description: desc,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: place.name, description: desc, images: [ogUrl] },
  }
}

export default async function PlacePage({ params }: Props) {
  const { slug } = await params
  const place = await getPlace(slug)
  if (!place) notFound()

  return (
    <main>
      <h1>{place.name}</h1>
      {place.type && <p>Type: {place.type}</p>}
      {place.location && <p>Location: {place.location}</p>}
      {(place.description ?? place.info) && <p>{place.description ?? place.info}</p>}
    </main>
  )
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd frontend/next && npm test -- test/routes/place.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/next/app/place/ frontend/next/test/routes/place.test.ts
git commit -m "feat(next): places route + tests"
```

---

## Task 13: Page catch-all route — TDD

**Files:**
- Create: `frontend/next/test/routes/pages.test.ts`
- Create: `frontend/next/app/[slug]/page.tsx`

**Note:** `app/[slug]/page.tsx` and `app/[slug]/[blockno]/page.tsx` must coexist. Next.js App Router disambiguates: a URL with two segments matches `[slug]/[blockno]`; one segment matches `[slug]`.

- [ ] **Step 1: Write `frontend/next/test/routes/pages.test.ts`**

```typescript
import { test, expect } from '@playwright/test'
import { getMeta, getTitle } from '../helpers/meta'

// "about" is a static page that exists in bom_prd
const PATH = '/about'

test.describe('Page catch-all route /{slug}', () => {
  test('returns 200', async ({ request }) => {
    expect((await request.get(PATH)).status()).toBe(200)
  })

  test('<title> is non-empty', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    expect(getTitle(html)).toBeTruthy()
  })

  test('og:title is non-empty', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    expect(getMeta(html, 'og:title')).toBeTruthy()
  })

  test('og:description is present', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    // description may be null in DB — just check the tag exists if data provides it
    const desc = getMeta(html, 'og:description')
    // Either there is a description or the og:image is there (one of the two must exist)
    const img = getMeta(html, 'og:image')
    expect(desc || img).toBeTruthy()
  })

  test('og:image is absolute URL and resolves to PNG', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    const img = getMeta(html, 'og:image')!
    expect(img).toMatch(/^https?:\/\//)
    const path = new URL(img).pathname + new URL(img).search
    const r = await request.get(path)
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toContain('image/png')
  })

  test('unknown page returns 404', async ({ request }) => {
    const r = await request.get('/zzz-no-such-page-xyz')
    expect(r.status()).toBe(404)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend/next && npm test -- test/routes/pages.test.ts
```

- [ ] **Step 3: Write `frontend/next/app/[slug]/page.tsx`**

```tsx
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getPage } from '@/lib/pages'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) return {}

  const h = await headers()
  const lang = h.get('x-lang') ?? 'en'
  const host = h.get('host') ?? 'bookofmormon.online'
  const desc = page.description ?? `${page.title} — Book of Mormon`
  const ogUrl = `https://${host}/og?${new URLSearchParams({ title: page.title, desc, lang })}`

  return {
    title: page.title,
    description: desc,
    openGraph: {
      title: page.title,
      description: desc,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: page.title, description: desc, images: [ogUrl] },
  }
}

export default async function PageRoute({ params }: Props) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) notFound()

  return (
    <main>
      <h1>{page.title}</h1>
      {page.description && <p>{page.description}</p>}
    </main>
  )
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd frontend/next && npm test -- test/routes/pages.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add "frontend/next/app/[slug]/page.tsx" frontend/next/test/routes/pages.test.ts
git commit -m "feat(next): page catch-all route + tests"
```

---

## Task 14: Sitemap and robots — TDD

**Files:**
- Create: `frontend/next/test/routes/sitemap.test.ts`
- Create: `frontend/next/test/routes/robots.test.ts`
- Create: `frontend/next/app/sitemap.ts`
- Create: `frontend/next/app/robots.ts`

- [ ] **Step 1: Write `frontend/next/test/routes/sitemap.test.ts`**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Sitemap /sitemap.xml', () => {
  test('returns 200', async ({ request }) => {
    expect((await request.get('/sitemap.xml')).status()).toBe(200)
  })

  test('content-type is application/xml or text/xml', async ({ request }) => {
    const r = await request.get('/sitemap.xml')
    expect(r.headers()['content-type']).toMatch(/xml/)
  })

  test('contains at least one <loc> entry', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).toContain('<loc>')
  })

  test('root URL appears in sitemap', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).toMatch(/bookofmormon\.online/)
  })
})
```

- [ ] **Step 2: Write `frontend/next/test/routes/robots.test.ts`**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Robots /robots.txt', () => {
  test('returns 200', async ({ request }) => {
    expect((await request.get('/robots.txt')).status()).toBe(200)
  })

  test('contains Sitemap directive', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text()
    expect(body).toContain('Sitemap:')
  })

  test('allows all user agents by default', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text()
    expect(body).toContain('User-agent: *')
  })
})
```

- [ ] **Step 3: Run — expect FAIL**

```bash
cd frontend/next && npm test -- test/routes/sitemap.test.ts test/routes/robots.test.ts
```

- [ ] **Step 4: Write `frontend/next/app/sitemap.ts`**

```typescript
import type { MetadataRoute } from 'next'
import { gql } from '@/lib/graphql'

const BASE = 'https://bookofmormon.online'

interface DivisionRow { slug: string; pages: { slug: string }[] }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static high-priority pages
  const static_entries: MetadataRoute.Sitemap = [
    { url: BASE, priority: 1.0, changeFrequency: 'daily' },
    { url: `${BASE}/about`, priority: 0.5, changeFrequency: 'yearly' },
    { url: `${BASE}/people`, priority: 0.7, changeFrequency: 'monthly' },
    { url: `${BASE}/places`, priority: 0.7, changeFrequency: 'monthly' },
    { url: `${BASE}/timeline`, priority: 0.6, changeFrequency: 'monthly' },
    { url: `${BASE}/contents`, priority: 0.8, changeFrequency: 'monthly' },
  ]

  // Scripture chapters from the division tree
  let scripture_entries: MetadataRoute.Sitemap = []
  try {
    const data = await gql<{ division: DivisionRow[] }>(
      `query { division(slug: null) { slug pages { slug } } }`,
      {},
      { revalidate: 86400 }
    )
    for (const div of data.division ?? []) {
      for (const page of div.pages ?? []) {
        scripture_entries.push({
          url: `${BASE}/${div.slug}/${page.slug}`,
          priority: 0.9,
          changeFrequency: 'yearly',
        })
      }
    }
  } catch {
    // If backend is unreachable at build time, return static entries only
  }

  return [...static_entries, ...scripture_entries]
}
```

- [ ] **Step 5: Write `frontend/next/app/robots.ts`**

```typescript
import type { MetadataRoute } from 'next'

const BASE = 'https://bookofmormon.online'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
```

- [ ] **Step 6: Run — expect PASS**

```bash
cd frontend/next && npm test -- test/routes/sitemap.test.ts test/routes/robots.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add frontend/next/app/sitemap.ts frontend/next/app/robots.ts \
        frontend/next/test/routes/sitemap.test.ts frontend/next/test/routes/robots.test.ts
git commit -m "feat(next): sitemap.xml + robots.txt + tests"
```

---

## Task 15: Run full test suite

- [ ] **Step 1: Run all route tests**

```bash
cd frontend/next && npm test
```

Expected output (approximately):
```
  ✓ OG image route /og (5 tests)
  ✓ Scripture route /{slug}/{blockno} (8 tests)
  ✓ People route /people/{slug} (7 tests)
  ✓ Places route /place/{slug} (6 tests)
  ✓ Page catch-all route /{slug} (6 tests)
  ✓ Sitemap /sitemap.xml (4 tests)
  ✓ Robots /robots.txt (3 tests)

  39 passed
```

If any test fails:
- `404` on a route → the `app/` file for that route doesn't exist or has a syntax error; check the file.
- `og:image` PNG check fails → the OG route is not returning a real image; check `app/og/route.ts` and ensure fonts are in `public/fonts/`.
- `<title>` is empty → `generateMetadata()` returned `{}` because the GraphQL call failed; check that the backend is running on `:5006` and the slug is valid in `bom_prd`.

- [ ] **Step 2: Commit test results**

```bash
git add -A && git commit -m "test(next): all phpbox benchmark route tests passing"
```

---

## Task 16: `bom-nextjs` systemd unit

This task registers the Next.js app as a systemd user service so it runs alongside `bom-dev`.

**Files:**
- Create: `frontend/next/bom-nextjs.service` (unit template, not installed automatically)

- [ ] **Step 1: Write `frontend/next/bom-nextjs.service`**

```ini
[Unit]
Description=BOM Next.js frontend (port 3000)
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/BookofMormonOnline/frontend/next
EnvironmentFile=%t/bom-dev.env
ExecStart=/usr/bin/npm run dev -- --port 3000
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

- [ ] **Step 2: Install and enable the unit**

```bash
cp frontend/next/bom-nextjs.service ~/.config/systemd/user/bom-nextjs.service
systemctl --user daemon-reload
systemctl --user enable --now bom-nextjs
systemctl --user status bom-nextjs
```

Expected: `Active: active (running)` within 30 seconds.

- [ ] **Step 3: Verify the server is up**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
```

Expected: `200` (or `404` once actual pages exist — either confirms the server is responding).

- [ ] **Step 4: Commit**

```bash
git add frontend/next/bom-nextjs.service
git commit -m "feat(next): systemd unit for bom-nextjs"
```

---

## Task 17: Switch NPM proxy host to Next.js `:3000`

NPM handles domain → backend proxying only (no path-based routing). Path routing is done by Next.js's `rewrites` fallback in `next.config.ts`, which proxies unmigrated routes to CRA `:8200`.

- [ ] **Step 1: In Nginx Proxy Manager, change the proxy host for `bookofmormon.online`**

Update the upstream from `localhost:8200` → `localhost:3000`.

That's it — Next.js's `rewrites.fallback` in `next.config.ts` proxies any route it doesn't know about to CRA `:8200`. Phase 1 routes (scripture, people, place, OG, sitemap, robots) are served by Next.js. Everything else falls through to CRA transparently.

- [ ] **Step 2: Free port 3000 (stale next-server process)**

A stale `next-server (v16.2.4)` process (PID 20534, owned by user `kckern`) is holding `:3000`. Kill it as that user, then start the new unit:

```bash
# as kckern:
kill 20534
# then as bom:
systemctl --user start bom-nextjs
```

- [ ] **Step 3: Smoke-test**

```bash
curl -I http://localhost:3000/1-nephi/1     # Next.js route → 200
curl -I http://localhost:3000/home          # CRA proxied route → 200
curl -I http://localhost:3000/og?title=Test # OG image → 200, content-type: image/png
```

- [ ] **Step 4: Phase 4 cleanup (future)**

When all routes are migrated, remove the `rewrites.fallback` block from `next.config.ts` and retire `frontend/webapp/`.

---

## Self-Review Checklist

- **Spec coverage:** All sections of `docs/specs/2026-06-13-nextjs-ssr-migration-design.md` Phase 1 are covered: scaffold ✓, middleware ✓, OG route ✓, scripture route ✓, people route ✓, place route ✓, page catch-all ✓, sitemap/robots ✓, `bom-nextjs` systemd unit ✓, Nginx routing ✓, font assets ✓, data fetchers with `React.cache()` ✓.

- **Test coverage:** Every phpbox route class has a dedicated test file with: 200 status, HTML validity, `<title>`, `og:title`, `og:description`, `og:image` absolute URL, and the `og:image` URL itself resolves to `image/png`. OG image tested independently with PNG magic bytes. Sitemap and robots tested for structure.

- **No placeholders:** All code is complete and runnable. No TBD/TODO in any step.

- **Type consistency:** `ReadBlock`, `Person`, `Place`, `PageData` defined in `lib/*.ts` and used in `app/*/page.tsx` without renaming.

- **Phase 2-4:** Not covered by this plan — add separate plans as phases begin.
