# Entity URL Presentation Model

**Date:** 2026-09-24
**Status:** Phase 1 implemented 2026-09-24; Phase 2 (presentation model) pending plan
**Scope:** `frontend/webapp` (CRA) + `frontend/next` (SSR)

## Problem

`/people/:slug`, `/places/:slug` and `/matters/:slug` are not item URLs. They are
index URLs with a side effect: the route mounts the index grid (`People.js`,
`Places.js`, `Matters.js`) and the slug param only fires `setPopUp`. The item is
always an overlay on a list.

The same URL is produced two ways, and the app cannot tell them apart:

1. **In-app click** — modal opens over whatever you were looking at, `setSlug`
   pushes `/people/noah1` (`models/appController.js:255`). Desirable.
2. **Direct entry** (typed, pasted, reloaded, followed from SNS or search) — you
   get the People index grid with a modal slammed on top. There is no "just this
   item" view anywhere in the CRA, for any type.

Meanwhile SSR already renders those URLs as standalone item pages
(`frontend/next/app/people/[slug]/page.tsx`). The two renderers disagree about
what the URL means, and the CRA is the one that is wrong.

A second, narrower defect motivated this work: SSR 404s bare slugs. Person slugs
are disambiguated (`noah1`, `noah2`, `noah3`), so a shared link to
`/people/noah` unfurls as a 404 for every scraper, while a human clicking the
same link gets a usable chooser from `PopUp.js:205`. Slug resolution lives in a
modal component and nothing else can reach it.

## Root cause: two history instances

The CRA creates `createBrowserHistory()` **twice**:

- `src/App.js:27` — passed to `<Router history={history}>`
- `src/models/routeHistory.js` — used by `appController.setSlug`
  (`appController.js:208`) and ~10 views (Timeline, MobileStudy, Annotations,
  StudyGroupBar, Invitation, HistoryList, ProgressBox, StudyGroupSelect, History)

With `history@4.10.1`, `push()` notifies only its own listeners; `pushState` does
not fire `popstate`. So a `setSlug` push changes the address bar but **the Router
never re-renders** — the `<Switch>` in `views/_Common/Main.js:181` keeps the
previous view mounted. That accident is the only reason "modal over current
context" works today. A reload of the same URL is evaluated cold by the Router,
which is why the two paths diverge.

This constrains sequencing: unifying the two instances (an obvious cleanup) would,
on its own, make every modal open swap the backdrop to an index grid. The
presentation model below has to land in the same change.

## Goals

- One URL per item; presentation chosen by how the user arrived.
- In-app click keeps today's behavior (modal over current context), on purpose
  rather than by accident.
- Direct entry renders a standalone full-page item view.
- A user-invoked **maximize** promotes an open modal to the page view without
  changing the URL.
- Slug resolution becomes a shared rule reachable by the CRA page, the CRA modal,
  and SSR.
- SSR stops 404ing resolvable bare slugs.

## Non-goals

- Changing which URL an item lives at. Every existing shared link keeps working.
- Reworking the index grids themselves.
- Fixing the 8 pre-existing frontend test failures.
- Per-language sitemaps, or giving `matters` an SSR route (see Deliberate holes).

## Design

### 1. Background-location routing

Adopt the standard React Router v5 modal pattern.

| Arrival | `location.state.background` | Render |
|---|---|---|
| In-app click | set to the location at click time | `<Switch>` renders the backdrop from `background`; `<PopUp>` renders the modal |
| Fresh load | absent (cannot survive a cold load) | `<Switch>` matches the item route → standalone page |
| Back/Forward | rides along in the history entry | restores whatever that entry was |
| Maximize | `history.replace(sameUrl, {})` | drops `background`, keeps the URL → page |

The distinction is free: "was this a cold load" is answered by the absence of
state that only an in-app push can write. No `hasNavigatedInApp` flag to maintain,
and Back into a modal entry correctly restores the modal — the "fresh load
primarily" semantics chosen during design.

`Main.js` renders `<Switch location={background || location}>`. `setPopUp` /
`setSlug` attach `background` when opening from a click.

Then **unify on the single `routeHistory` instance** and delete the local one in
`App.js`.

### 2. Presentation resolution

`models/Routes.js` already gives each type a separate entry for the item URL
(`/people/:personName`) and the index (`/people`). Only the **item** entry
changes; the index entry keeps mounting the grid. The item entry's component
reads `location.state.background`:

- absent → `<EntityPage type=… slug=…>`
- present → today's index + popup path, unchanged

`EntityPage` reuses the existing popup bodies (`Person`, `Place`, `MatterPopUp`,
`History` in `views/_Common/PopUp.js`) inside a page shell: same data fetch, no
modal chrome, a back-link to the type's index. No duplicate data layer.

`isMobile()` already returns `MobileDrawer` instead of the modal
(`PopUp.js:103`); the page view supersedes the drawer on direct load, and the
drawer keeps serving in-app clicks.

### 3. Participating types

| Type | URL | Today on direct load | After |
|---|---|---|---|
| people | `/people/:slug` | index grid + modal | standalone page |
| places | `/places/:slug`, `/place/:slug` | index grid + modal | standalone page |
| matters | `/matters/:slug` | index grid + modal | standalone page |
| history | `/history/:slug` | client-side `<Redirect>` to `/history/reception/:slug` (`RedirectReceptionSlug.jsx`) | standalone doc page |
| art | `/art/:id`, `/image/:id` | parent chapter + in-page image activation | standalone page |

**history** is a net correctness win. Archive doc slugs are shared across four
archives (reception, translation, witnesses, joseph-smith), but `setSlug` always
pushes `/history/<slug>`, so reloading a witnesses doc today lands it under the
*reception* hub. SSR already treats `/history/<slug>` as the document
(`app/history/[slug]/page.tsx`); the standalone page makes the CRA agree.
`/history/reception/:slug` stays as the hub route.

**art** has no modal today — in-chapter activation goes through
`requestImageActivation` (`views/Page/Annotations.js:202`), which stays as is.
Only direct loads of `/art/:id` and `/image/:id` change. Art therefore needs a
genuinely new view rather than a reused popup body; SSR's `app/art/[id]` defines
the content (image, title, artist, scripture refs).

### 4. Exclusions — enforced, not implied

- **commentary never renders full-page.** Licensing requires commentary to be
  shown in context. Direct loads keep today's behavior: resolve to the parent
  chapter and reopen the modal (`views/Page/Page.js:489-505`).
- **victory stays modal-only.** Not an addressable item.

Both are encoded as an explicit allowlist of page-eligible types with a comment
naming the licensing reason, so a later refactor cannot quietly promote
commentary by generalising the mechanism.

### 5. Shared slug resolution

The current rule — `p.slug.startsWith(activeId)` (`PopUp.js:206`, `:350`) — is
too loose to build on. Measured against the live list (435 person slugs):

| Input | `startsWith` matches |
|---|---|
| `noah` | 4 — `noah1`, `noah2`, `noah3`, `noahs-priests` |
| `nephi` | 13 — includes `nephites`, `nephihah`, `nephite-spies` |
| `laman` | 16 — includes `lamanites`, `lamanite-king1` |

Replace it with a numeric-variant rule, `^<slug>-?\d+$`, which handles both
person (`noah1`) and place (`jerusalem-2`) conventions:

| Case | Result |
|---|---|
| exact slug exists | the item |
| exactly one numeric variant | canonical slug (redirect / auto-resolve) |
| several numeric variants | chooser |
| none | 404 |

Input is lowercased before lookup. The rule ships as one module consumed by `EntityPage`, `PopUp`, and the SSR
routes, so the three cannot drift. All three render the same four outcomes:
`EntityPage` shows the chooser as a full page, `PopUp` keeps showing it as the
modal chooser it shows today, and SSR serves the chooser page from §6.

### 6. SSR changes

`app/people/[slug]`, `app/place/[slug]`, `app/places/[slug]`:

- one variant → `permanentRedirect` (308) to the canonical slug. This is the fix
  for shared links unfurling as 404s.
- several variants → chooser page listing them, `noindex, follow` via the page's
  own robots meta tag, so it passes link equity without competing with the real
  entity pages. (A meta tag rather than the `X-Robots-Tag` header: the header is
  set in `middleware.ts`, which would have to repeat the slug resolution to know
  a chooser was coming. Crawlers honour both equally.)
- none → 404, as today.
- an exact match found only after normalizing (padding/case) → redirect to the
  canonical spelling, so the resolver's fourth outcome is never silently a 404.

`app/map/[type]/place/[slug]` carries the same defect (`/map/1/place/jerusalem`
404s) and `PlaceView` generates links of that shape, so it gets the redirect half
of this treatment. No chooser there — a disambiguation page inside a map context
would strand the visitor with no map.

308 rather than 301 is a consequence of `permanentRedirect` in a server
component. If an ancient scraper is found not to follow 308, the fallback is a
301 from `middleware.ts`, at the cost of a people-list fetch in middleware.

### Deliberate holes

- `matters` gets no SSR route. `features.yml` sets `seo: "remove"` for it and the
  catch-all `notFound()`s on that intent (`app/[...path]/page.tsx:36`). Its page
  view is browser-only until the feature is un-gated.
- `matters` is also nav-hidden in prod builds (`HIDE_MATTERS_NAV`); the route
  stays live, so the page view is reachable by direct link.

## Phasing

The two halves are independently shippable and should be planned as separate
phases:

- **Phase 1 — slug resolution + SSR** (§5, §6). No CRA routing changes. Fixes the
  original defect (shared links unfurling as 404s) and lands the shared rule that
  Phase 2 consumes. Ships on its own.
- **Phase 2 — presentation model** (§1-§4). History unification, background
  locations, `EntityPage`, maximize, art view. Larger and riskier; depends on
  Phase 1's resolution module.

## Testing

- **SSR** — Playwright route tests following `test/routes/people.test.ts`:
  bare slug with one variant returns 308 to the canonical slug; bare slug with
  several returns a 200 chooser carrying `noindex`; unknown slug still 404s;
  existing exact-slug assertions unchanged.
- **Slug resolution** — unit tests for the variant rule, including the
  `noah`/`noahs-priests` and `nephi`/`nephites` cases that the old `startsWith`
  rule got wrong.
- **CRA** — unit coverage on the background-location branch: cold load renders
  the page, a click-pushed location renders index + modal, maximize drops
  `background` without changing the URL.
- **Manual** — the history-unification consumers (Timeline, MobileStudy,
  Annotations, StudyGroupBar, Invitation, HistoryList, ProgressBox,
  StudyGroupSelect) verified on `http://localhost:8200` directly, not
  `bom.kckern.net` (Cloudflare serves a stale bundle for 4h).

## Risks

1. **History unification is the sharp edge.** Those ~10 consumers call
   `push`/`replace` directly and will start actually re-rendering the Router.
   That is the correct behavior, but it is where surprises will surface. Verify
   each flow by hand.
2. **Backdrop preservation changes what stays mounted.** Keeping the chapter
   mounted behind a modal is an improvement (scroll position survives), but
   `Page.js` carries stage-transition and init-phase logic that has never run
   with a modal route layered over it.
3. **Art needs a new view**, not a reused popup body — the largest single piece
   of new UI in this change.

## Acceptance criteria

- `/people/noah1` pasted into a fresh tab renders a standalone person page; no
  index grid, no modal chrome.
- Clicking Noah¹ from the People grid, the reader, or the map opens the modal
  over that context, and the URL becomes `/people/noah1`.
- Maximize on that modal renders the page view with the URL unchanged; reload
  agrees.
- `/people/noah` for a crawler 308s to a real person page or renders a chooser;
  it never 404s while a variant exists.
- `/history/<slug>` for a witnesses doc renders that doc, not the reception hub.
- A direct load of a commentary URL still renders the parent chapter with the
  commentary in context, never full-page.
