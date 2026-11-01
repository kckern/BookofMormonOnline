# UX decruft pass — 2026-11-01

Scope: frontend (`frontend/webapp/src`), mobile experience first. Static cleanup only;
**nothing here was verified in a browser** (the dev backend could not reach MySQL
that day — `connect ETIMEDOUT`, so no page rendered data).

## Done

- **Mobile drawer** (`views/_Common/Drawer.js`): removed the "Full page" button (and the
  `useMaximize` hook); fixed `ProgressDrawer`'s swapped `useEffect` arguments; swipe-to-close
  listeners are now removed on cleanup; one `useDrawerClose` helper replaces four copies of
  the close sequence; `Person`/`Place` fetch via `useEntityData` (a missing entity shows
  "Not found" instead of an endless spinner); dead `ObjectDrawer`, `debug` state and the
  raw-type fallback removed.
- **Bottom nav**: active tab is derived per render instead of state + manual `classList`.
- **Popup/shell**: unreachable `<pre>` fallbacks, `Main.js` debug variable, commented-out code.
- **Imports**: 176 unused imports removed across 58 files (`views/`).
- **Console noise**: 20 debug `console.log`s removed (several printed auth/user tokens:
  `SocialSignIn`, `StudyGroupAdmin`, `Community`); error-handler logs now `console.error`;
  commented-out `console.log` lines removed.
- **Social sign-in**: dead Facebook button (`{false && …}`), token-logging `useGoogleLogin`
  hook, and the `{false ? …}` wrapper removed. Google/Kakao/Naver unchanged.
- **Unused files** (nothing imported them): `Tos.js`, `StudyGroupNotebook.js/.css`,
  `GroupsIcon.js`, `PassageNotes_new.scss`, `InfowindowContent.js`, `MapTiles.js`,
  `TileMap.js`, `peoplePlacesFilterData.js`, `helperFunctions.js`, `dummycom.js`,
  `scriptdata.json.js`, `scriptregex.json.js`, `facebook.svg`, `google.svg`.
- **Unused dependencies** removed from `package.json` + lockfile (38 packages incl. transitives):
  fontawesome ×3, canvasjs, canvasjs-react-charts, csvtojson, rc-mentions, react-dropzone,
  react-fb-login-component, react-images-uploading, react-player, react-recaptcha,
  redux-persist, redux-thunk, slick-carousel, use-sound.
  Kept on purpose: `caniuse-lite`, `dotenv`, `form-data`, `web-vitals` (tooling may use them
  indirectly).

Checks: `vite build` OK; full `vitest run` 265 files / 2392 tests pass (Vitest also prints one
"Timeout calling onTaskUpdate" worker error under load — infrastructure, not a test).

## Phone drawer layout (verified in a browser, 390px)

The phone drawer's person/place/matter bodies now share `PersonBody`/`PlaceBody`/`MatterBody`.
First render showed the desktop popup's two-up `.refbox` rail leaking in (~100px column,
text wrapping a few letters per line). `Drawer.css` now flattens `.ppbody` to one column
(same rules as `EntityPage.css`'s phone block): title, portrait, prose, then full-width
relationship cards and references. Person drawer 10,758px -> 6,582px tall; no horizontal
overflow; close returns to the list route; bottom-nav active tab correct.

## Other mobile views (reviewed by screenshot, 390px)

Home, Read, Study, Contents, People, More menu, Theater, History, Search, User, Maps,
Timeline: no horizontal overflow, no layout breakage found. Observations, not changed:
- Read's chapter-grid map has ~20px cells (small tap targets; dense by design).
- The bottom nav highlights "Study" for any route outside Discover/User/More (People,
  Theater, ...). Default-branch behaviour in `bottomNavSelection.js`.
- Drawer body text is large (shared `.bodytext` styling).

## Dead CSS

`Home/Sampler.css`: removed 44 rules (173 lines) whose selectors were only classes with no
references in frontend, backend or Next (`viewAllBox`, `peopleFace*`, `valueProp*`,
`spotlight*`, `activityTile{Msg,User,Time}`, `historyTileMore`, `faxVerseTitle`,
`notesSource`). Kept `is-*` (built as `is-${role}` in MapStoryTileInner), `sampler*`,
`commentaryTileReadMore`. Home renders identically (same page height, pixel-identical
except the random header avatar). Other flagged CSS (`leaflet-*`, `gm-*`, bootstrap,
`cat-*`, `itemCount*`, `color-scale-*`, `rail-*`) is third-party or dynamic: left alone.

## Still open

- Dev Infisical `MYSQL_*` keys are stale (needs a write-capable agent; see
  `/tmp/bom-db-handover.md`). Visual checks above used a temporary read-only backend.
