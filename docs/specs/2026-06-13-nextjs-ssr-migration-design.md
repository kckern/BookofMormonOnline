# Next.js SSR Migration Design

**Date:** 2026-06-13
**Status:** Approved — ready for implementation planning
**Replaces:** PHP SSR box (`seo.bookofmormon.online`, `preview.bookofmormon.online`)
**Companion:** See `docs/reference/non-graphql-endpoints.md` for current PHP box route inventory

---

## Goal

Replace the CRA frontend (`frontend/webapp/`) and the PHP SSR box (two services: HTML meta-shell renderer + GD OG image generator) with a single Next.js 15 App Router application at `frontend/next/`. Every visitor — bot and human — gets server-rendered HTML with correct meta tags and crawlable body content. The Fastify GraphQL backend (`backend/`, port 5006) is unchanged; Next.js consumes it as a client.

---

## Architecture

```
Browser / Bot
    ↓
Cloudflare → Nginx
    ↓
Next.js :3000          ← NEW: replaces CRA + PHP SSR box
    ↓ (server components fetch at render time)
Fastify GraphQL :5006  ← unchanged
    ↓
MySQL / Redis
```

**What gets retired (end of migration):**
- `frontend/webapp/` (CRA, port 8200)
- `seo.bookofmormon.online` PHP service
- `preview.bookofmormon.online` PHP preview image service

**Location:** `frontend/next/` — lives alongside `frontend/webapp/` during migration, replaces it at Phase 4.

---

## Middleware (`middleware.ts`)

Runs on every request before rendering. Replaces `lib.php` logic and Nginx bot-detection hacks.

**Runtime:** Next.js middleware defaults to the Edge Runtime, which blocks Node.js APIs (including `redis`). Since we self-host on Node.js (not Vercel edge), declare the Node.js runtime at the top of `middleware.ts`:

```typescript
export const runtime = 'nodejs'
```

| Concern | Implementation |
|---|---|
| Language detection | Read `host` header + URL path prefix (`/ko/`, `/fr/`, etc.); set `x-lang` response header for server components to consume via `headers()` |
| Host redirects | `NextResponse.redirect()` — e.g. `story.xn--289a67xla.kr` → `xn--289a67xla.kr`, `www.*` → bare domain |
| IP allowlist (admin routes) | Read `x-forwarded-for`; return 403 for `/audit` and other gated paths |
| Rate limiting / scraping protection | Redis (already in stack) — middleware calls Redis to check/increment per-IP counter; requires Node.js runtime (above) |
| Bot detection for SSR | **Not needed.** Everyone gets server-rendered HTML. |

---

## Data Fetching

**Pattern:** `React.cache()` wraps each GraphQL fetcher so `generateMetadata()` and the page component share one HTTP request per render.

```typescript
// app/lib/scripture.ts
import { cache } from 'react'

export const getScriptureBlock = cache(async (slug: string, blockno: number) => {
  const res = await fetch('http://localhost:5006/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: BLOCK_QUERY, variables: { slug, blockno } }),
    next: { revalidate: 3600 },
  })
  return (await res.json()).data
})
```

**Caching strategy by content type:**

| Route family | Cache strategy | Rationale |
|---|---|---|
| Scripture text, people, places, pages | `revalidate: 3600` | Content rarely changes; ISR serves cached HTML |
| Commentary, contents, timeline, history | `revalidate: 86400` | More static |
| OG images | `revalidate: 86400` | Title/desc almost never changes |
| Home feed, messenger, study groups | `cache: 'no-store'` | Always live |

**`generateStaticParams()`** enumerates all scripture block references at build time. Popular routes pre-generated as static HTML; long-tail routes generate on first request and cache.

**Language:** Middleware sets `x-lang`; server components read it via `import { headers } from 'next/headers'` and pass it to GraphQL query variables — same as the backend's per-request lang context.

**Auth:** Public content (scripture, people, places) requires no auth — server components work as-is. Auth-gated routes (Phase 3) read a JWT from an HttpOnly cookie via `cookies()` and forward it as `Authorization: Bearer` to GraphQL. Migration from localStorage → cookie is a Phase 3 concern.

---

## OG Image Generation (`/og` route)

Replaces the PHP GD preview renderer at `preview.bookofmormon.online`. Uses `next/og` (Satori: JSX → SVG → PNG). No image processing library needed.

**Route:** `app/og/route.ts` — single shared endpoint, accepts query params. All route families share one branded template.

```
GET /og?title=...&sub=...&desc=...&img={artId}&lang={en|ko|...}
```

**Template** (`BomOgCard`) recreates the PHP design:
- 1200×630 px
- Navy background (`#32394d`)
- Gold accent frame (`#fbc658`) top-right, art image composited over it
- White semi-transparent content area
- RobotoCondensed Bold for title/subtitle; Light for description
- IBM Plex Sans KR for Korean routes (same fonts as PHP box, copied from `PHPBox/preview/fonts/`)

**Fonts:** Loaded as `ArrayBuffer` from `public/fonts/` at route handler startup. Language param selects the font set.

**Wired into `generateMetadata()`:**

```typescript
const host = (await headers()).get('host') ?? 'bookofmormon.online'
const ogUrl = `https://${host}/og?${new URLSearchParams({ title, sub, desc, img, lang })}`

openGraph: {
  images: [{ url: ogUrl, width: 1200, height: 630 }]
}
```

The URL **must be absolute** — Twitter, Facebook, and other crawlers do not follow relative `og:image` paths. Next.js emits the `og:image` and `twitter:image` tags automatically. `preview.bookofmormon.online` is retired.

**Response headers:** `Cache-Control: public, max-age=86400` — Cloudflare caches generated PNGs at the edge.

---

## App Router File Structure

```
frontend/next/
├── middleware.ts
├── next.config.ts                    # rewrites (CRA fallback during migration), headers
├── app/
│   ├── layout.tsx                    # root layout: Providers, navbar, global CSS
│   ├── providers.tsx                 # 'use client' — Redux Provider + SocketProvider
│   ├── sitemap.ts                    # /sitemap.xml
│   ├── robots.ts                     # /robots.txt
│   ├── og/
│   │   ├── route.ts                  # ImageResponse endpoint
│   │   └── BomOgCard.tsx             # branded 1200×630 template
│   │
│   ├── [slug]/                       # BOM page slugs (catch-all)
│   │   ├── page.tsx                  # /{slug} → Page
│   │   └── [blockno]/
│   │       ├── page.tsx              # /{slug}/{blockno} → Scripture text ★
│   │       └── fax/page.tsx          # /{slug}/{blockno}/fax
│   │
│   ├── people/[slug]/page.tsx        # /people/:slug ★
│   ├── place/[slug]/page.tsx         # /place/:slug ★
│   ├── commentary/[...slug]/page.tsx # /commentary/...
│   ├── contents/page.tsx
│   ├── map/page.tsx                  # Leaflet → dynamic import ssr:false
│   ├── timeline/page.tsx
│   ├── history/page.tsx
│   ├── about/page.tsx
│   ├── search/page.tsx
│   ├── home/
│   │   ├── page.tsx
│   │   └── [channelId]/
│   │       ├── page.tsx
│   │       └── [messageId]/page.tsx
│   ├── group/[channelId]/page.tsx
│   ├── invitation/[code]/page.tsx
│   ├── user/page.tsx
│   └── theater/page.tsx
│
├── components/                       # shared UI components
│   ├── server/                       # pure server components
│   └── client/                       # 'use client' components
├── lib/                              # data fetchers (React.cache wrappers)
│   ├── scripture.ts
│   ├── people.ts
│   ├── places.ts
│   └── pages.ts
└── public/
    └── fonts/                        # RobotoCondensed + IBMPlexSansKR (from PHPBox)
```

---

## Client Component Strategy

Server components are the default. `'use client'` is opt-in.

| Component category | Mode | Note |
|---|---|---|
| Scripture text body | Server | Static content, full SSR, indexed by Google |
| People / place detail | Server | Static content, full SSR |
| Navigation, menus | Client | Interactive, auth-aware |
| `StudyGroupBar` | Client | Socket.io, real-time presence |
| Home feed | Client | Real-time, auth-gated |
| Messenger / chat | Client | Socket.io throughout |
| Map (Leaflet) | Client + `ssr:false` | Requires `window` |
| Charts (Highcharts) | Client + `ssr:false` | Requires `window` |
| TinyMCE / CKEditor | Client + `ssr:false` | Requires `window` |
| User profile | Client | Auth-gated, no SEO value |

**Redux** narrows in scope: server components fetch from GraphQL directly; Redux manages UI state, user session, and real-time updates from Socket.io. Initialized in `providers.tsx` (`'use client'`), which wraps the app in `layout.tsx`.

**Socket.io** connects on mount inside `SocketProvider` (client-only). Next.js never touches it server-side. Existing `MessengerController` logic ports directly into this context. No behavioral changes.

---

## Migration Phases

Both apps run simultaneously during migration. Nginx routes by path prefix: migrated routes → Next.js `:3000`; everything else → CRA `:8200`. Each phase is a discrete PR that (a) builds Next.js routes, (b) updates Nginx location blocks.

**Nginx pattern (evolves per phase):**

```nginx
upstream nextjs { server 127.0.0.1:3000; }
upstream cra    { server 127.0.0.1:8200; }

# Phase 1 — scripture text, people, places, pages, OG images, sitemap
location ~ "^/[a-z0-9-]+/[0-9]+"  { proxy_pass http://nextjs; }  # /{slug}/{blockno}
location /people/                   { proxy_pass http://nextjs; }
location /place/                    { proxy_pass http://nextjs; }
location /og                        { proxy_pass http://nextjs; }
location /sitemap.xml               { proxy_pass http://nextjs; }
location /robots.txt                { proxy_pass http://nextjs; }

# Default → CRA until route is migrated
location / { proxy_pass http://cra; }
```

Each subsequent phase adds location blocks for its routes and removes the CRA fallback for those paths. Phase 4 removes the CRA upstream entirely.

### Phase 1 — Foundation (highest SEO value)
- `frontend/next/` scaffold: `next.config.ts`, `layout.tsx`, `providers.tsx`, `middleware.ts`
- `/og` route + `BomOgCard` template + font assets
- `/{slug}/{blockno}` — Scripture text
- `/people/[slug]` — People detail
- `/place/[slug]` — Places detail
- `/[slug]` — Page catch-all
- `/sitemap.xml`, `/robots.txt`
- `bom-nextjs` systemd unit (`next dev --port 3000`)
- Nginx: route Phase 1 paths to `:3000`

### Phase 2 — Content routes
- `/contents`, `/commentary`, `/timeline`, `/history`, `/about`, `/facsimiles`, `/search`
- Update Nginx

### Phase 3 — Community / interactive
- `/home`, `/group`, `/user`, `/invitation`, `/map`, `/theater`, `/analysis`
- Auth token → HttpOnly cookie (enables authenticated server components)
- Update Nginx

### Phase 4 — Cleanup
- Nginx routes all traffic to Next.js `:3000`
- Delete `frontend/webapp/`
- Remove CRA start from `bom-dev` unit; remove `bom-nextjs` unit; `bom-dev` becomes Next.js
- Retire PHP SSR box (`seo.bookofmormon.online`, `preview.bookofmormon.online`)

---

## React 17 → 18 Notes

Next.js 15 requires React 18. Key migration concerns:

- `useEffect` fires twice in dev with `StrictMode` — reveals missing cleanup functions in existing components; fix on encounter
- Concurrent rendering is automatic — no code changes
- `ReactDOM.render()` → `createRoot()` — CRA's bootstrap handled this, not component code
- Most existing components work in React 18 with zero changes

---

## What the PHP Box Did vs. What Replaces It

| PHP subsystem | Replacement |
|---|---|
| `seo/lib.php` — lang detection, DB connect | `middleware.ts` + GraphQL data fetchers |
| `seo/index.php` — URL regex dispatch | App Router file-based routing |
| `seo/header.php` — OG/Twitter meta tags | `generateMetadata()` in each `page.tsx` |
| `seo/*.php` body content | Server component render output |
| `preview/index.php` + `render.php` | `app/og/route.ts` + `BomOgCard.tsx` |
| `preview/gather/*.php` — data for images | Same `React.cache()` fetchers as page |
| `seo.bookofmormon.online` host | Retired — Next.js serves all routes |
| `preview.bookofmormon.online` host | Retired — `/og` route serves all OG images |
