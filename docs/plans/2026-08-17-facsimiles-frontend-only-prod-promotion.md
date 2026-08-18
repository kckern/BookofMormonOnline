# Promoting Facsimiles (frontend only) to prod

**Date:** 2026-08-17
**Question:** Can we cherry-pick just `frontend/webapp/src/views/Facsimiles/` onto `prod` and build it, without promoting the green-field backend?
**Answer:** Yes. It builds, and it degrades cleanly — with one bug that needs a one-line fix first.

Verified empirically: `prod` worktree + grafted Facsimiles code → `npm run build` succeeded, then
served the build behind a proxy that forwards GraphQL POSTs to the live prod backend and falls back
to `index.html` for `/fax/*` (exactly what prod does today). Driven with Playwright, desktop + mobile.

---

## 1. Why this is even possible

`prod` and `dev` have diverged enormously — 2,560 commits, 1,820 files, ~405k insertions. The backend
was rewritten: `prod` runs the old Apollo/Sequelize `src/`, `dev` runs the green-field Fastify
`backend/`. But the Facsimiles view's dependency closure is small and its data sources are mostly
already on prod.

Import closure outside `views/Facsimiles/`:

| Module | On prod? |
|---|---|
| `src/models/BoMOnlineAPI` | yes — needs one added export (below) |
| `src/models/Utils` (`label`, `isMobile`, `useSwipe`, `convertIntToRomanNumeral`, `determineLanguage`) | yes, all present |
| `src/utils/scriptureUtils` (`slugify`, `getEnglishReference`) | yes |
| `src/views/_Common/Loader` | yes |
| `src/views/_Common/ScripturePopup` + `ScriptureExcerpt` | **new — must be copied** |
| `src/views/_Common/Breadcrumb/` + `StudyBreadcrumb.jsx` | **new — must be copied** |
| `react-modern-drawer`, `react-masonry-css`, `react-tooltip`, `reactstrap` | already in prod `package.json` |
| `scripture-guide` | prod pins `^1.0.84`; dev uses `^1.0.95` (language-arg support) |

Routes in `models/Routes.js` are **byte-identical** between the branches — no routing change needed.

Page scans come from `assetUrl` (`media.bookofmormon.online`), which prod already serves. The verse
box geometry lives in `bom_xtras_fax_index` (`X/Y/W/H/TLW/TLH/BRW/BRH`, `pageScale`) and
`bom_xtras_fax` (`pgfirstVerse`, `format`, `bgcolor`) — both tables exist in `bom_prd` with all
required columns, and prod already has Sequelize models for them. **No migration is needed.**

## 2. What is actually missing on prod

Two backend surfaces exist only in the green-field `backend/`:

1. **`GET /fax/boxes/{version}/ids/{ids}`** and **`GET /fax/render/{version}/{mode}/w{n}/{sel}.{ext}`**
   — `backend/src/media/fax/route.ts`. Prod has no such route, so the SPA catch-all answers them:
   ```
   $ curl -sI https://bookofmormon.online/fax/boxes/1830/ids/1
   200 text/html          # index.html, not JSON
   ```
2. **GraphQL `faxVerseLocations`** — `backend/src/graphql/resolvers/scriptureextras.ts:194`. Prod:
   ```
   {"errors":[{"message":"Cannot query field \"faxVerseLocations\" on type \"Query\"."}]}
   ```

Observed traffic from the grafted build against the real prod backend:

```
POST /en -> 200  {fax (filter: "pdf") {...}}
POST /en -> 200  {faxIndex (slug: "1830") {...}}
POST /en -> 400  {faxVerseLocations(verseIds: [31209,...])}     <-- only failure
POST /en -> 200  {read (ref: "1 Nephi 4") {...}}
POST /en -> 200  {read (ref: "1 Nephi 5") {...}}
GET  /fax/boxes/1830/ids/31209-... -> 200 text/html             <-- SPA fallback
```

## 3. What works and what doesn't

**Works** (verified by screenshot at 1440×950 and iPhone 13):

- Contact-sheet grid of all editions, covers, masonry layout
- Two-page spread viewer with page scans, side page-stacks, page-turn animation
- Breadcrumbs + edition-switcher dropdown/drawer
- Per-page scripture references (`1 Nephi 4:32-5:7` rails), clickable into the reader
- Page slider with scrub thumbnails, jump-to-page, keyboard nav, `/590` totals
- Mobile scroll viewer, floating thumbscroller, missing-scan placeholders

**Silently absent** (everything downstream of `/fax/boxes`):

- Verse hotspots, hover cutouts, verse tooltips
- The verse modal (crop image, verse text, speaker avatar, prev/next verse nav)
- "Page › Section" study links in the tooltip/modal (that's `faxVerseLocations`)
- Passage-highlight overlay when arriving from a scripture reference (`useFaxHighlight`)

All the fetch paths already `.catch(() => null)` / `.catch(() => [])`, so **no page errors, no
crashes, no console noise beyond the 400/404s.** Verse hotspot element count on a loaded spread: 0.

## 4. The one real bug — verse deep-links hang

`/fax/1830/31209` (or any ref-slug deep link) spins the loader forever.

`FacsimilePageViewer.js:523` holds a loader while a verse deep-link resolves:

```js
const deepLinkLoading = urlTargetsVerse && !suppressModal && urlVerseId != null && !vstate.openVerse;
```

`suppressModal` is false because the edition *is* indexed and the verse *does* map to a page. The
escape hatch at `:509` is gated on `!spreadVerses.length`:

```js
if (!urlTargetsVerse || suppressModal || vstate.openVerse || !faxVerses.ready || !spreadVerses.length) return;
```

Its comment assumes the empty-spread case is "handled up front by `suppressModal`" — true when boxes
load, false when `/fax/boxes` returns HTML. `spreadVerses` is then permanently empty, the fallback
never fires, and the loader never lifts.

**Fix — drop the `!spreadVerses.length` clause:**

```js
if (!urlTargetsVerse || suppressModal || vstate.openVerse || !faxVerses.ready) return;
```

Verified: after this change `/fax/1830/31209` falls back to `/fax/1830/1` and renders normally. The
clause is redundant even with a working backend — `faxVerses.ready` already gates the pre-resolution
spread, and the `found` check below it handles the loaded-with-hotspots case.

The **mobile viewer is not affected** — `FacsimilePageViewerMobile.js:188` bails with a plain
`if (!v) return;` and no loader gate. Deep-link settles onto the page and renders.

## 5. Promotion checklist

1. Copy `frontend/webapp/src/views/Facsimiles/` wholesale (minus `__tests__/` if prod's test setup
   can't run them).
2. Copy new shared components:
   - `views/_Common/Breadcrumb/` (`Breadcrumb.jsx`, `Breadcrumb.css`)
   - `views/_Common/StudyBreadcrumb.jsx`
   - `views/_Common/ScripturePopup.js` + `.css`
   - `views/_Common/ScriptureExcerpt.js` + `.css`
3. Add to `models/BoMOnlineAPI.js`:
   ```js
   export const renderBaseUrl = process.env.REACT_APP_RENDER_URL || "";
   ```
4. Add the `faxVerseLocations` entry to `models/GraphQLQueries.js` (harmless — it 400s and is caught;
   include it so the feature lights up for free the day the backend lands).
5. Bump `scripture-guide` to `^1.0.95` in `frontend/webapp/package.json`.
6. Apply the `deepLinkLoading` fix from §4.
7. Build with `npm run build` — **`react-app-rewired`, not `react-scripts`**. `config-overrides.js`
   pushes `src/` and the package root onto `resolve.modules`; bare `react-scripts build` fails on
   `Can't resolve 'models/BoMOnlineAPI'` in `_Common/Header.js`.

### Optional: dark mode

The fax stylesheets key off `html[data-theme="dark"]` (6 rules across the two SCSS files). Prod's
`Main.js` only sets a `.dark` class on `.body` and never writes `data-theme`, so the fax viewer will
render light-styled even with dark mode on. Fix by promoting the effect from dev's
`views/_Common/Main.js:128-132`:

```js
useEffect(() => {
  document.documentElement.setAttribute("data-theme", isDarkMode ? "dark" : "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isDarkMode ? "#1a1a1a" : "#323b4d");
}, [isDarkMode]);
```

That attribute is additive — nothing else on prod reads it, so it can't regress existing styling.

**Placement matters.** Prod's `Main.js` computes `isDarkMode` *below* an `if (apiFailure) return`
early return, so dropping the `useEffect` next to it makes it a conditional hook — React throws
"rendered fewer hooks than expected" the moment `apiFailure` flips. Read the preference into its own
`const` and put the effect up with the other hooks, above that early return.

## 6. Note for whenever the backend does get promoted

`/fax/render` and `/fax/boxes` collide with the SPA route `/fax/:faxVersion+` in `models/Routes.js`.
Whatever serves prod must register the backend routes ahead of the static/SPA catch-all, or the
frontend will keep swallowing them. This is a deploy-config item, not a code one.

Also note `bom.kckern.net` currently serves the Next.js frontend (`frontend/next`), which 404s on
`/fax/render` — it is not a valid reference for CRA fax behavior right now.

---

# Outcome — promoted and deployed 2026-08-17

Branch `promote/facsimiles-frontend` (commit `eacaf2b4`, 35 files, +4395/-744), pushed to
`origin`. Not merged into `prod` — it sits alongside it for review.

## How it was deployed

A **full image rebuild was deliberately avoided.** The prod host is 2 vCPU / 3.8 GB with ~1.5 GB
free and no swap; running the CRA production build there would likely OOM and could take the live
app or MySQL down with it. Since only frontend assets changed, the deploy is a one-layer image on
top of the running image — a `COPY` of static files, so it is architecture-independent and needs no
compilation on the host:

```dockerfile
FROM kckern/bookofmormon-online:latest
COPY build /usr/src/app/frontend/webapp/build
```

The frontend was built on the laptop, first replicating the Dockerfile's stamp steps
(`date > public/build.txt`, append the commit, `sed` the commit into `sw.js`'s `{{BUILD_VERSION}}`
— that substitution is the service-worker cache-bust, so skipping it would strand returning
visitors on stale assets). The `build/` tree was tarred to the host and built there.

This also keeps the blast radius at exactly the fax change. The deployed image predates prod's one
undeployed commit (`a10fa9c8` — Node 18.20.4, `npm ci`, TS config, a Zod fix, and a flag that
disables PassageNotes in Read); a full rebuild would have shipped all of that too. **That commit is
still undeployed.**

| | |
|---|---|
| New image | `kckern/bookofmormon-online:fax-eacaf2b4` (449 MB) |
| Base / rollback image | `kckern/bookofmormon-online:rollback-20260818` = `07fbb6750c30`, built 2026-05-10 |
| Rollback container | `bookofmormon-online-old-20260818` (stopped, config intact) |
| Frontend commit live | `eacaf2b4` (was `4a133fc8`, 2026-05-10) |

## Container swap notes

- The app container has no compose file, no mounts, no port bindings, and no labels. It carries **27
  env vars** (including the pool tuning) that must survive a recreate — the swap script reads them
  from `docker inspect` and passes them straight through without ever printing values.
- Entrypoint `docker-entrypoint.sh`, cmd `forever ./dist/index.js`, network
  `bomdocker_phpnetwork`, restart `unless-stopped`.
- **nginx-proxy-manager targets the app by container *name*** (`set $server "bookofmormon-online"`),
  not by IP, so a same-name recreate needs no proxy change. (It came back on the same IP anyway.)
- The swap aborted safely on the first attempt: a `bookofmormon-online-old` container from the
  2026-07-14 pool-tuning swap still held the name. It was renamed to `-old-20260714` and the new
  anchor dated. **Date the rollback container name** — a bare `-old` collides with the previous one.

## Verification

Origin (`curl -H "Host: bookofmormon.online" http://54.190.52.236/`), Cloudflare
(`cf-cache-status: DYNAMIC`, so human traffic is uncached), and Chromium desktop + iPhone 13
against the live URL:

| Route | Result |
|---|---|
| `/fax` | grid renders, 0 page errors |
| `/fax/1830/10` | spread viewer renders, 0 page errors |
| `/fax/1830/31209` | falls back to `/fax/1830/1` — the deep-link fix works in prod |
| `/fax/1830/10` (iPhone 13) | mobile scroll viewer renders |
| `/`, `/read/1.nephi.1` | unaffected |

Backend startup log clean: `Database connected successfully` / `Listening on port 5005`.

The only non-2xx are the two expected ones: `400` on the `faxVerseLocations` GraphQL query and a
pre-existing `404` for the page-0 placeholder scan. Both fail closed.

## Rolling back

```bash
ssh bom
docker stop bookofmormon-online && docker rm bookofmormon-online
docker rename bookofmormon-online-old-20260818 bookofmormon-online
docker start bookofmormon-online
```
