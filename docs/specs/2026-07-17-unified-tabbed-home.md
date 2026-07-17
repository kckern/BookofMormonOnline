# Unified Tabbed Home — Design Spec

**Date:** 2026-07-17
**Status:** Approved (design); ready for implementation planning
**Author:** Claude (brainstormed with KC)

## Summary

Merge the separate `/home` (Sampler explore page) and `/community` (feed) views —
plus the `/user` view — into a single **unified Home with tabs**:

- **Explore** (Sampler) — default tab
- **Community** — messenger-gated
- **User** — the existing profile/progress/history/preferences view

URLs collapse under `/home`, the old top-level `/community` and `/user` paths
redirect in, and the tab bar is a desktop/tablet construct (mobile keeps its
bottom nav).

## Goals

- One consolidated Home surface for explore + social + personal.
- Preserve every existing deep link (channel threads, user sub-pages) via redirects.
- No remount of the Home shell when switching tabs.
- Keep `Sampler`, `Community`, and `User` as independent, pure content components.
- Maintain Next SSR/sitemap parity.

## Non-Goals

- No redesign of the Sampler, Community, or User content itself.
- No change to the mobile bottom-nav model (Home / Study / User / More / Groups).
- No new messenger functionality; Community remains behind the existing flag.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Third tab | **Yes** — User becomes the 3rd tab; sidebar profile card deep-links into it |
| URL scheme | **Collapse under `/home`**: `/home`, `/home/community`, `/home/user`; redirect old paths |
| Community when messenger OFF | **Hide the tab**; `/home/community` redirects to `/home` |
| Mobile | **Desktop tabs only**; mobile keeps bottom nav, paths updated |
| Build approach | **A — Home shell wrapper** (new `Home.js` owns tab bar + inner `<Switch>`) |
| Sampler tab label | **"Explore"** (new i18n key `home_tab_explore`) |
| Sidebar Home item | Stays labeled "Home", points at `/home` (Sampler tab) |

## Architecture

### Component structure (Approach A)

```
views/Home/Home.js         (NEW — shell)
├── <HomeTabs>             (NEW — desktop/tablet tab bar; hidden on mobile)
└── <Switch> (inner)
    ├── /home/user/:value?                        → User      (unchanged)
    ├── /home/community/:channelId?/:messageId?   → Community  (unchanged)
    ├── /home  (exact)                            → Sampler   (unchanged, default)
    └── /home/:legacyChannelId                    → <Redirect to /home/community/:legacyChannelId>
```

The shell owns the tab bar and inner routing. `Sampler`, `Community`, and `User`
remain pure content components and keep reading their params via
`useParams`/`useRouteMatch` — the inner `<Switch>` preserves the param names
(`:channelId`, `:messageId`, `:value`), so their internals do not change.

The shell does **not** remount on tab switch; only the matched child content swaps.

### Active tab resolution

Derived from `location.pathname`:
- starts with `/home/user` → **User**
- starts with `/home/community` → **Community**
- otherwise → **Explore** (Sampler)

## Routing changes (`frontend/webapp/src/models/Routes.js`)

**Remove:** the current `/home` (Sampler), `/home/:channelId(/:messageId)`
`HomeChannelRedirect` entries, the three `/community*` entries, and the three
`/user*` entries (`/user/signup`, `/user/:value`, `/user`).

**Add — one Home subtree:**
```js
{ path: "/home", component: Home }   // non-exact; shell does its own inner routing
```
Place it before the generic `/:pageSlug+` catch-alls.

**Add — redirects (old → new):**
```js
/community/:channelId/:messageId(\d+)  → /home/community/:channelId/:messageId
/community/:channelId                   → /home/community/:channelId
/community                              → /home/community
/user/signup                            → /home/user/signup
/user/:value                            → /home/user/:value
/user                                   → /home/user
```
These use `<Redirect>` components (same pattern as the existing
`HomeChannelRedirect`). They must be declared before the `/:pageSlug+` catch-all.

**Legacy `/home/:channelId`:** no longer a top-level redirect (it would shadow
`/home/community`). Handled inside the shell's inner `<Switch>` as the *last*
route: `/home/:legacyChannelId` → `<Redirect to /home/community/:legacyChannelId>`.

## Tab bar (`HomeTabs`)

- Tabs, in order: **Explore** (Sampler) · **Community** · **User**.
- Each tab is a `<Link>`/`<NavLink>` that changes the URL to the tab's base path.
- **Community tab renders only when `isMessengerEnabled()` is true.** When false,
  the tab is absent and `/home/community` redirects to `/home` (guard in the shell).
- Sticky at the top of the Home content area (desktop/tablet).
- **Not rendered on mobile** (`isMobile()`); the child view renders directly and
  the bottom nav drives navigation.
- Labels: `label("menu_community")`, `label("user")`, and a **new** key
  `home_tab_explore` (default English "Explore") for the Sampler tab.

## Sidebar, profile card, bottom nav

### `views/_Common/menuConfig.js`
- **Remove** the `community` item.
- Keep `home` → `/home` (label unchanged: `menu_home`).

### `views/_Common/Sidebar.js`
- Active-state split to avoid double-highlight on the User tab:
  - **Home** menu item highlights on `/home` and `/home/community`.
  - **Profile card** (`UserInfo`) highlights on `/home/user` (its `^/user`
    match becomes `^/home/user`).
- `determinePath()` updated so `/home`, `/home/community`, `/home/user` resolve
  to the Home section, with the user tab distinguished for the profile card.
- Profile-card link targets updated:
  - `/user` → `/home/user`
  - `/user/preferences` → `/home/user/preferences`
  - `/user/history` → `/home/user/history`

### `views/_Common/BottomNav.js`
- `determineSelection()` updated to distinguish `/home` (Home item) from
  `/home/user` (User item) — both now share the `home` first path segment.
- User nav item `path`: `/user` → `/home/user`. Home item `path` stays `/home`.

## Mobile

- `User` already returns `MobileUser` when `isMobile()`; `Sampler`/`Community`
  keep their `.m.css`. The shell renders the child **without** the tab bar on mobile.
- `MobileMenu` builds from `loadMenu()` and already filters out `home`/`study`;
  removing `community` from `menuConfig` also removes it there (it was the
  messenger-gated item). No further mobile menu work needed.

## Next SSR parity (`frontend/next/`)

**Corrected after implementation-planning exploration — this is mostly
verification, not new code.** `middleware.ts` proxies *every* human path to the
CRA (`localhost:8201`) transparently, so `/home/community` and `/home/user` are
handled entirely by the CRA router with no Next change. `/home`, `/community`,
and `/user` are **not** in the sitemap (`lib/sitemap.ts`) nor in the bot
route-class table — bots hitting them get the generic DefaultShell, unchanged.

Therefore:
- **No middleware/route/sitemap code change is required** for the new paths.
- Old `/community` / `/user` URLs redirect **client-side** (via the CRA
  `<Redirect>` routes); humans are proxied to the CRA which performs the redirect.
- **Verify** by re-running the `frontend/next/scripts/` parity harnesses
  (`parity.mjs`, `body-diff.mjs`, `sitemap-diff.mjs`) to confirm nothing
  regressed.
- *Optional (not required for parity):* add server-side 301s for `/community/*`
  and `/user/*` in `middleware.ts` if we later want canonical bot redirects.
  Deferred — the PHP-box parity spec does not redirect these.

### Verified 2026-07-17 (implementation)
Parity harness passed for `/home`, `/community`, `/user` (42/42 head fields,
3/3 body-start vs the live PHP box); zero `frontend/next` files changed on the
branch. Observed trade-off: a **bot-UA** request to the new nested
`/home/community` / `/home/user` returns 404 from Next SSR (they fall onto the
`[slug]/[blockno]` text route, not the DefaultShell), while **human** requests
are proxied to the CRA and render 200. These sub-paths are not in the sitemap
and are not linked from any SSR shell, so there is no indexing/SEO impact. If we
ever want bots to receive a 200 shell for these app routes, add `/home/community`
and `/home/user` to the DefaultShell/known-route handling — tracked as an
optional follow-up, not required for parity.

## Testing

- **Home shell:** renders the correct tab/child for each of `/home`,
  `/home/community`, `/home/community/:channelId`, `/home/user`,
  `/home/user/history`.
- **Messenger gate:** Community tab absent and `/home/community` → `/home` when
  the flag is off; present when on.
- **Redirects:** `/community`, `/community/:channelId/:messageId`, `/user`,
  `/user/:value` land on the corresponding `/home/*` paths.
- **Legacy:** `/home/:channelId` (non-`community`, non-`user`) → `/home/community/:channelId`.
- Update existing `views/Home/__tests__` and any tests referencing `/community`
  or `/user` routes.
- Next: parity harness green after the middleware/sitemap changes.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Legacy `/home/:channelId` shadows `/home/community` | Legacy redirect is the **last** route in the inner Switch; `community`/`user` matched first |
| Community deep-link params drop on nesting | Inner Switch preserves `:channelId`/`:messageId` param names |
| Double active-highlight in sidebar | Home item excludes `/home/user`; profile card owns `/home/user` |
| SSR/bots see stale routes | Server-side redirects + sitemap update + parity harness re-run |
| Broken internal links to `/user` or `/community` | Redirects cover external/bookmarked links; internal links updated in Sidebar/BottomNav |

## Open items for the implementation plan

- Exact `path-to-regexp` patterns for the optional nested params in the inner Switch.
- Whether the "Explore" label should also appear anywhere else (currently tab-only).
- Confirm no other components hard-link to `/user` or `/community` beyond
  Sidebar/BottomNav (grep sweep during implementation).
