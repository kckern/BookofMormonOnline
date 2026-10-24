# Go-to-market readiness: what was hidden, what is now surfaced, what is dark behind a flag

**Date:** 2026-10-23 · Measured on prod (desktop 1440 + phone 390, real browser) with `scripts/home-audit/surface-scan.mjs`.
**Background:** the site never had real feature flags. "Hidden" meant *reachable by URL, absent from the menu* (plus a build-time `hidden:` list in `features.yml`). This pass inventories every such surface, ships the ready ones, and puts a real, rollout-able flag around the rest.

## 1. The flag system (new)
`frontend/webapp/src/models/flags.js`, config in the `flags:` block of `frontend/webapp/config/features.yml`.

| Want to… | Do |
|---|---|
| widen a rollout | change `rollout: 0 → 10 → 50 → 100`, deploy (a browser keeps its bucket, so people don't flicker) |
| test a dark flag yourself | open any page with `?ff=theology` (on) or `?ff=-matters` (off); remembered in that browser; `?ff=reset` forgets |
| see everything while developing | dev/test builds show all flags on |
| kill a feature fast | `rollout: 0`, deploy |

Crawler behaviour (`seo:` in `features.yml`) is separate and unchanged: **nothing here changes what search engines see.**

## 2. Inventory

| Surface | Was | State on prod | Decision | Flag |
|---|---|---|---|---|
| Discover (`/home`) | no nav entry | healthy; first-visit front door | **surfaced** (2026-10-23, `ba28eb80`) | none (always on) |
| Matters (`/matters`, `/matters/{narrative,material,concepts}`, entity popups) | nav hidden, search group hidden | 200, no errors, no overflow, images load; Discover already shows matters | **surfaced** in nav + search | `matters` = 100 |
| History hub + Joseph Smith, Witnesses, Translation, Reception, Lost 116 Pages | nav hidden | all 200; content rich; no overflow | **surfaced** in nav | `history` = 100 |
| History: New York & Pennsylvania 1820s | linked from hub | **page crashed (blank)**; prod has **zero rows** for this archive | crash fixed (empty archive now shows "still being assembled"); card + route **dark** | `history1820s` = 0 |
| Theology (`/theology`) | dev-only menu item, reachable by URL | page says "scaffold · placeholder data" | **dark**, route redirects home | `theology` = 0 |
| Passage notes (Read panel) | hidden build flag | unreviewed WIP | **dark** | `passageNotes` = 0 |
| Analysis | shown with BETA badge | works; stage-1 polish shipped | stays, labelled Beta | none |
| Community / groups / messenger | host-gated + unlisted `/home/feed` | out of scope for today | stays host-gated (not a rollout flag yet) | see §4 |
| Search, User pages | `seo: noindex` | correct permanently | unchanged | none |

## 3. Fixed today
- History archive feed crashed on an archive with no rows (`[undefined]` from the API) — now filtered, with an empty state.
- Hub no longer advertises an empty collection.
- Discover nav entry + phone bottom nav (earlier today).
- Real flags + tests (12) + browser verification (`scripts/home-audit/verify-flags.mjs`).

## 4. Can't do today — the suppress/follow-up list
| # | Item | Why not today | Next step |
|---|---|---|---|
| 1 | **1820s NY & PA archive content** | no rows in prod; dev DB unreachable from here; source data not on this machine | load the dataset (spec `docs/specs/2026-08-18-1820s-ny-pa-archive.md`), then `history1820s: 100` |
| 2 | **Theology** | placeholder data by its own label | needs real content or removal |
| 3 | **Passage notes** | unreviewed | design/QA pass, then ramp 10% → 100% |
| 4 | **Search-engine exposure** | **Matters: built on dev (2026-10-23), awaiting deploy.** Server-rendered `/matters`, the 3 group pages and 476 matter pages (title, description, verse links, related links, JSON-LD, canonical, sitemap entries); `mattersNav` seo → `crawl`; all 476 render 200 against the prod API; 40+99 SSR/unit tests green. **History: deliberately held at noindex.** The SSR hub still shows raw markdown and empty thumbnail URLs, and the 1,145 document pages are mostly a few hundred characters of quoted text (thin/duplicate risk); the new collection routes (`/history/translation`, `/reception`, `/lost-116-pages`) have no SSR page (404 for crawlers). | History: build collection landing pages with intro text and keep per-document pages `noindex, follow`, then flip the hub; `/theology` and `/home` stay `remove` |
| 5 | **Community / messenger** | host-gated, separate runtime; needs its own readiness pass | wrap in a `community` flag when ready |
| 6 | History thumbnails | 117 requests 404 on the Translation page (cards hide the missing image, so nothing looks broken, but it is wasted traffic and console noise) | render the thumb only when the document has an image, or generate the thumbs |
| 7 | Analytics proxy 403 | some real browsers (known) | separate |
| 8 | Matters index on phone is ~80,000 px tall | works, but very long | paginate or collapse by group |
| 9 | Korean: "Discover" nav label | row applied; host not re-checked | verify on `몰몬경.kr` |
| 10 | Signed-in front door | no real account tested | load `/` while signed in |
