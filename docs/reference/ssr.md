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

## Feature flags & the crawl surface (robots, sitemap, SEO)

Because the two renderers are UA-split, **a feature flag evaluated in only one of them
governs only that audience.** The cutover flags (`frontend/webapp/config/features.yml`
→ `HIDE_*` in `frontend/webapp/src/models/featureFlags.js`) compile into the **CRA
bundle** and run on the **human** path only. Googlebot and the social scrapers take the
**SSR** path and never execute them. So today a flag that "hides" a feature hides it
from users while the SSR layer keeps serving it and `/sitemap.xml` keeps advertising it
to search engines.

### The second invariant: flag parity

The content-equivalence invariant above has a sibling. **A feature's visibility decision
must hold in BOTH renderers.** If a feature is flagged off for humans but the SSR route
still renders it and the sitemap still lists it, the flag is cosmetic for SEO — and
worse: because routes stay live, a visitor arriving from a search result lands *directly
on the "hidden" feature*. The hidden thing becomes the first thing search traffic sees.

Reaching the SSR layer means two distinct surfaces (plus a third):

1. **URL resolution — what the SSR route returns.** A flagged-off feature's route must
   stop returning indexable `200` content: `notFound()` (404), `410 Gone`, or a
   `robots: noindex` meta. Pulling it from the sitemap is *not enough* alone — crawlers
   also find URLs via external inbound links, the prior index, shares, and the address
   bar; if the route still answers `200`, the page stays indexed.
   > **Soft-404 trap:** the catch-all's single-segment `page` branch returns the generic
   > `DefaultShell` at **HTTP 200** for unknown slugs (`app/[...path]/page.tsx`), so bare
   > `/matters` and `/home` are indexable *soft-404s*, not real 404s.

2. **Sitemap enumeration — what you advertise.** `/sitemap.xml` (`lib/sitemap.ts`) is the
   site telling search engines "crawl and index these." A flagged-off feature's URLs must
   be omitted, or you are explicitly inviting indexing of something you decided to pull.

3. **Internal SSR links.** Server-rendered `<a href>`s keep a target in the crawl graph
   even with no sitemap entry (e.g. `DefaultShell`'s `DEFAULT_NAV` links `/history`, and
   it renders on *every* soft-404 page). A flagged-off feature must also leave the SSR
   link chrome.

**Why both #1 and #2, never one alone:**
- Sitemap removal alone → crawlers still discover the URL elsewhere; an SSR `200` keeps
  it indexed.
- SSR `404`/noindex alone → the sitemap now advertises URLs that 404, which Search
  Console reports as errors and which waste crawl budget and erode site trust.
- Together → stop advertising **and** stop resolving: one consistent signal.

### HTTP status codes are SEO signals, not decoration

The SSR route's **HTTP status is the machine-readable truth crawlers act on** — they use
it to decide what to index, keep, drop, or transfer. It must reflect reality (flag state,
content availability, moves), or the index diverges from the product. A JS/client-side
redirect or a self-canonical `200` on a page that has really moved is **invisible to
non-JS bots and transfers no ranking signal** — only real HTTP codes do.

| Code | Means to a crawler | Use it for |
|---|---|---|
| **200** | Real, indexable content | Live, available content only. *Never* the soft-404 case (200 + empty `DefaultShell` gets thin pages indexed and burns crawl budget). |
| **301 / 308** | Permanent move — transfer ranking to target, replace old URL in index | Relocated/merged content. **The History redesign move `/history/{slug}` → `/history/reception/{slug}` must be a 301** — today it's a *client-side* redirect for humans and a self-canonical `200` for bots, so equity never transfers and the two audiences disagree. |
| **302 / 307** | Temporary move — keep the *original* indexed | Genuinely temporary redirects only. Using it where 301 is meant strands equity on the old URL. |
| **404 / 410** | Not here (404 = gone, may retry; 410 = permanently gone, drop faster) | Missing content, and features flagged **remove**. A "remove"-mode feature must 404/410, not 200-with-empty. |
| **503** | Temporarily unavailable, retry later, **don't de-index** | A feature toggled off *transiently* whose index status you want to preserve (e.g. a maintenance window). |

The flag's SEO intent maps straight onto status + meta: **crawl → 200**, **noindex →
200 + `robots: noindex`**, **remove → 404/410** (or **503** if the disablement is
temporary). So "make the SSR honor the flag" is concretely "return the status code the
flag intent implies."

### robots.txt is *not* the hiding tool

`app/robots.txt` is intentionally allow-all (`Disallow:` empty) + a `Sitemap:` pointer.
`robots.txt` blocks *crawling*, but a `Disallow`ed URL can still be **indexed** (URL-only,
no snippet) if it's linked externally — and blocking the crawl means Google can't even
see a `noindex`. So `robots.txt` is the wrong lever for hiding a feature. Use **sitemap
omission + SSR `noindex`/404 + link removal**; leave `robots.txt` allow-all.

### "Hidden" has two SEO meanings — a boolean can't express them

A per-feature flag must carry SEO *intent*, because the intents demand opposite SSR
behavior:

| Intent | Meaning | CRA | SSR route | Sitemap |
|---|---|---|---|---|
| **crawl** | Hide the human nav entrance, keep the feature indexed ("deep links okay") | hide nav | serve `200`, self-canonical | keep URLs |
| **noindex** | Reachable by direct URL, but keep it out of the index | hide nav | `200` + `robots: noindex` | remove URLs |
| **remove** | De-feature entirely for cutover (not public / not ready) | hide nav | `404` / `410` | remove URLs |

The current `hidden: true` boolean only encodes "hide from humans"; it can't tell the
SSR layer which of crawl/noindex/remove is meant. For the SSR layer to honor flags, the
config must express intent (e.g. `matters: { seo: remove }`), and `frontend/next/` must
read the **same** `features.yml` / `features.generated.json` to gate its routes, its
sitemap enumeration, and its internal links from one source of truth.

### Current state (source of truth: none yet)

The SSR layer has **no knowledge of `features.yml`** — the two sides are wholly
disconnected, so flags and crawl surface drift by construction. As of the 2026-08-27
cutover flags, the human-hidden features resolve for crawlers as:

- **Matters** — no SSR route, not sitemapped, no inbound SSR links; bare `/matters` is a
  soft-404 (`200` DefaultShell), `/matters/{slug}` a real 404. *Nearly* "remove" already;
  only the soft-200 leaks.
- **Home** — same shape (soft-404 on `/home`, real 404 on `/home/community`).
- **History** — the opposite: full SSR routes + ~1024 sitemap URLs + a `DEFAULT_NAV`
  link; fully crawlable/indexed (it carried legacy SEO equity). Consistent with **crawl**,
  not with hiding from search. Decide the intent: keep indexed (no SSR change) or pull it
  (sitemap + routes + nav link all change).

See [`../audits/2026-08-27-ssr-cutover-seo-gaps.md`](../audits/2026-08-27-ssr-cutover-seo-gaps.md)
for the concrete gaps (soft-404s, History SSR ↔ redesign divergence, orphaned new
History section pages that bot-404, the `/history/{slug}` redirect-vs-self-canonical
split, and a canonical cross-subdomain de-index blocker).

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
6. **Feature flags don't reach the SSR layer** — `features.yml`/`HIDE_*` are CRA-only,
   so the crawl surface ignores them (see "Feature flags & the crawl surface" above and
   [`../audits/2026-08-27-ssr-cutover-seo-gaps.md`](../audits/2026-08-27-ssr-cutover-seo-gaps.md)).
   This *is* a cutover blocker to resolve, unlike the others here.

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
