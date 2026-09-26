# react-router 5 → 7 migration

**Status:** Blocked on a route-architecture decision. Codemods proven; the route
table is the problem. Attempted 2026-09-25 and reverted rather than ship a
half-migrated core.

## Why it is not just a version bump

`react-router-dom@7` removes `Switch`, `Redirect`, `useHistory`,
`useRouteMatch` and `withRouter`, and — the real blocker — **narrows the path
syntax to `:param`, a trailing `*`, and `:param?`**. It supports neither regex
params nor `+` (one-or-more-segments) params. `models/Routes.js` uses both.

## What already works (proven, then reverted)

These codemods ran clean over the whole tree and are worth re-applying verbatim:

| Change | Scale |
|---|---|
| `react-router-dom/cjs/react-router-dom.min` → `react-router-dom` | 8 files |
| `Switch` → `Routes` | 11 files |
| `<Redirect to>` → `<Navigate to replace>` | 2 files |
| `useHistory()` → `useNavigate()`, incl. `push`/`replace`/`goBack` call forms | 33 files |
| `exact` removed (v7 matches exactly by default) | 3 files |
| `useRouteMatch()` → `{ params: useParams(), url: useLocation().pathname }` | 24 files |

`useRouteMatch` is a safe mechanical substitution here: consumers read only
`.params` (40 sites) and `.url` (7 sites, every one of them meaning "the path
that matched", which for these leaf routes is the current pathname).

**Take care with the `exact` codemod.** Removing the bare word leaves
`exact={x.exact}` welded onto the previous attribute (it produced
`keyProp={i}={x.exact}` in `_Common/Main.js`). Remove the whole attribute.

## The two-histories problem, and its answer

`App.js` passed a `createBrowserHistory()` to `<Router history=…>`, while
`models/routeHistory.js` created a SECOND instance that eleven files use for URL
updates the Router never hears — so a modal becomes shareable and Back-closable
without the route swapping the view out. That behaviour is load-bearing and
documented in `entity/MaximizeButton.js` and `Entity/EntityPage.js`.

v7 dropped its `history` dependency and `BrowserRouter` owns its instance with no
way to inject one. **The answer is to keep `routeHistory.js` as a thin wrapper
over the native History API** (`pushState`/`replaceState`/`back`), which is
exactly what the old instance did underneath — identical semantics, no package,
and still invisible to the Router. This was written and works; `App.js` becomes a
plain `<BrowserRouter>`.

## The actual blocker: the route table

`models/Routes.js` paths that v7 cannot express:

```
/:pageSlug+/:textId(\d+)                     <-- core scripture page
/:pageSlug+/:textId(\d+)/fax/:faxVersion+    <-- facsimile view
/analysis/:value*   /theater/:slug*   /audit/:key*
/community/:channelId/:messageId(\d+)        /group/:channelId/:messageId(\d+)
/commentary/:commentaryId(\d+)   /image/:imageId(\d+)   /art/:imageId(\d+)
```

Mechanical for most of them:
- `:param(\d+)` → `:param`, with the numeric check moved into the component
  (these already 404 on bad input, so the check has somewhere to live)
- `:slug*` → `*`, read via `useParams()["*"]`

**`:pageSlug+` is the one that needs a decision.** It matches one-or-more
segments before a numeric id, and v7 has no equivalent. The plausible approach:
give those two routes `path="*"` and let `Page` parse `useParams()["*"]` itself.
v7 ranks a splat route lowest and picks the best match rather than the first, so
a catch-all does not shadow the other routes — but this changes how the site's
most-trafficked route resolves its params, so it needs browser verification
across every page class plus an SSR-parity check against `frontend/next`, not
just a green suite.

## Recommended sequence

1. Re-apply the six proven codemods.
2. Land the `routeHistory.js` native-History rewrite and `BrowserRouter`.
3. Normalise the mechanical paths (regex → plain, `:x*` → `*`).
4. Decide and implement `:pageSlug+`, then verify in a browser per route class
   and re-check SSR parity.
5. Restore the three tests that build their own history with `createMemoryHistory`
   (`Container.test.js`, `ArtPage.test.js`, `MaximizeButton.test.js`) — v7's
   `MemoryRouter` takes no history prop, so they must observe location through a
   route element the way `Home.test.js` already does.

Step 4 is the one carrying real risk; steps 1–3 and 5 are known quantities.

## Note on urgency

react-router 5.3.4 runs fine on React 19 — the full suite is green on 19 with
router 5 — so this is currency and maintenance debt, not a blocker for anything
shipped. `@sentry/react@11` is the one dependency that actually wants router 6+,
and Sentry was removed entirely (it was dead code), so nothing is waiting on it.
