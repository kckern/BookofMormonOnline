# SSR Architecture: Dynamic Rendering (Next.js for bots, CRA for humans)

How `bookofmormon.online` serves crawlable HTML for SEO and social sharing while
keeping the existing interactive React app for users. This is the architecture
reference (the *what* and *why*); for the route-by-route parity details and PHP-box
quirks, see [`nextjs-ssr-parity.md`](./nextjs-ssr-parity.md).

## The shape: two apps, one front door

There are **two separate frontends**, bridged by Next.js middleware. They share no
code (`frontend/next/` imports nothing from `frontend/webapp/`).

| | `frontend/webapp/` (CRA) | `frontend/next/` (Next.js 15) |
|---|---|---|
| Audience | Humans | Crawlers + social scrapers |
| Port | `:8201` | `:8200` (the public front door) |
| Renders | Full interactive SPA (Redux, socket.io, CKEditor, Leaflet, Highcharts) | Server-rendered crawlable HTML; proxies humans to the CRA |
| Data layer | `src/models/GraphQLQueries.js` | `lib/*.ts` (own GraphQL client) |
| React | 17 | 18 |
| systemd unit | `bom-dev` | `bom-nextjs` |

Both read the same Fastify GraphQL backend (`backend/`, `:5006`). Cloudflare → Nginx
→ Next.js `:8200` is the request path; Next decides per-request whether to render
SSR or hand off to the CRA.

```
            Cloudflare → Nginx → Next.js :8200  ← front door
                                     │
              middleware.ts reads User-Agent
                   ┌─────────────────┴─────────────────┐
              bot / scraper                        human
                   │                                   │
          Next.js SSR route                  rewrite → CRA :8201
          (crawlable HTML)                   (the React SPA)
                   │                                   │
                   └──────── GraphQL backend :5006 ────┘
```

## The middleware — `frontend/next/middleware.ts`

Runs on every request (matcher excludes `_next/static`, `_next/image`, `favicon.ico`).

1. **`export const runtime = 'nodejs'`** — overrides Next's default Edge runtime so
   Node APIs and backend `fetch` behave predictably.
2. **Host redirect** — `www.*` → bare domain (301).
3. **SEO assets always served by Next, regardless of UA** — `/robots.txt`,
   `/sitemap.xml`, `/og` (real crawlers fetch robots/sitemap without a bot UA, and
   these aren't CRA routes).
4. **Bot detection** — a single regex (`BOT_RE`) against the `User-Agent`:
   - No match → **human** → `NextResponse.rewrite()` transparently proxies to the
     CRA on `:8201`. Same URL; the user just gets the SPA.
   - Match → **bot** → falls through to the Next.js SSR route, after setting an
     `x-lang` header (from the URL's language prefix) that server components read
     via `headers()`.
   - Matched UAs include the search/social majors **and the Korean crawlers**:
     Naver (`Yeti`), Daum (`Daumoa`), KakaoTalk/KakaoStory link-preview scrapers
     (`kakao*`) — these don't reliably carry `bot`/`crawl`, so they're listed
     explicitly. Korean coverage matters here (ko content + KakaoTalk sharing).

## Why dynamic rendering (and not "just let Googlebot render the SPA")

This is deliberate, not laziness. The human UX puts the indexable content in
**popups/overlays over a base page** (`frontend/webapp/src/views/_Common/PopUp.js`
renders commentary, people, place, object, and history as draggable `#popUp` cards
over the scripture `Page`). At, e.g., `/commentary/123` the CRA loads the scripture
*chapter* as the document and opens the commentary as `position:absolute` chrome
behind a `×`.

- **Google would SEO the page, not the popup.** A rendered SPA presents the chapter
  as primary content and the commentary as dismissible overlay UI — crawlers don't
  reliably attribute modal/overlay content as a URL's primary topic. The commentary,
  the reason that URL exists, would be buried.
- **Most non-Google bots don't run JS at all** — Naver, Daum, and the Kakao/Facebook/
  Twitter link-preview scrapers. Without SSR they get an empty shell: no search
  presence, broken share cards.

So the Next SSR route makes the commentary (or person, place, history doc, …) the
unambiguous `<h1>` + body. The content genuinely lives at that URL for humans too
(in the popup DOM); SSR just makes the crawler's job unambiguous.

## Is this cloaking?

Technically yes — **dynamic rendering**: branch on User-Agent, serve bots HTML and
users the SPA. It is the *tolerated* kind: Google penalizes serving bots **different
content** than users (bait-and-switch), not serving equivalent content rendered
differently. Bing/Naver/Yandex officially endorse it; Google calls it "a workaround,
not a long-term recommendation" — discouraged, not punished. It is the same approach
the retired PHP SSR box used for years.

### The hard invariant

The line between defensible dynamic rendering and the kind Google dislikes is content
equivalence. **Treat this as a rule: an SSR detail page's content must equal what the
CRA popup shows for the same URL.** Both read the same GraphQL (`commentary(id)`,
`person(slug)`, …), so they agree today — but nothing automatically enforces it. The
parity harness checks Next vs the old PHP box, *not* Next vs the live CRA. If the two
data layers drift, the equivalence (and the SEO defensibility) breaks.

Keep self-canonical on each detail URL (`buildMetadata` does) so the page ranks on
its own rather than being folded into the chapter.

## Known limitations / pending (none are blockers)

1. **Two data layers can drift** — `GraphQLQueries.js` (CRA) vs `lib/*.ts` (Next),
   same backend, maintained independently. The invariant above is manual.
2. **Humans get no SSR benefit** — they still receive the CRA shell + client-side
   rendering; only crawlers gain from the SSR work.
3. **The Next app has no interactive human routes** — it is crawler-HTML + proxy only.
4. **The migration spec is stale** — `docs/specs/2026-06-13-nextjs-ssr-migration-design.md`
   describes SSR-for-everyone with "bot detection not needed," the opposite of what
   shipped. Amend it if it's used as a source of truth.
5. **UA gaps** — a crawler whose UA matches none of `BOT_RE` (a novel bot, or a
   headless browser spoofing Chrome) gets the CRA shell. Hardening option: also treat
   empty/no-UA requests as bots.

## The end state ("fold into one app")

Not a cleanup task — it is the migration's later phases. It means porting the
interactive CRA into Next (Redux → RSC/client components, socket.io, the editors,
maps, charts), unifying to one GraphQL layer, serving SSR to **everyone** + hydrating,
then deleting the `BOT_RE` branch and retiring `frontend/webapp/` and its systemd
unit. Multi-month; the risk lives in the interactive pieces. Until then, the two-app
dynamic-rendering setup documented here is the intended, supported architecture.

## Verifying it works

From `frontend/next/`:
- `node scripts/parity.mjs [paths…]` — head-tag parity vs the live PHP box.
- `node scripts/body-diff.mjs <path>` — body structure parity.
- `node scripts/sitemap-diff.mjs` — sitemap coverage (superset of the box's 3179 URLs).

Quick manual check — bots get SSR, humans get the shell:
```
curl -A "Googlebot" http://localhost:8200/lehites/64   # → SSR <title> + content
curl -A "Mozilla/5.0 … Chrome/120" http://localhost:8200/lehites/64   # → empty CRA shell
```
