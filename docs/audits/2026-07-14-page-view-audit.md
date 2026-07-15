# Audit: `frontend/webapp/src/views/Page/` — DRY / SSoT / separation of concerns / dead code

**Date:** 2026-07-14
**Scope:** all 21 files in `views/Page/` (~4,400 LOC JS + ~1,570 LOC CSS) plus their external consumers (`models/Utils.js`, `_Common/PopUp.js`, `_Common/Drawer.js`, `_Common/Commentary.js`, `Map/*`, `models/Routes.js`).
**Method:** full read of every file, cross-reference grep of every export and reducer action.

> **Update 2026-07-14 (post-pull, HEAD `4a08faed`):** the controller→context migration (`docs/plans/2026-07-13-controller-context-migration.md`) and the sendbird-bridge deprecation landed on dev after this audit was written. Deltas:
> - **§1.2 resolved upstream** — `FaxBubbleContainer`, its `crypto-browserify` import, and the `oldbook` import were deleted in `f2f827b4`. The orphan `.fax` CSS in `Narration.css` **remains** and is still in scope.
> - Controller **prop drilling** is gone (components now use `usePageController()` / `useNarration()` / `useTextContent()` hooks). This supersedes the prop-plumbing aspects of §5.1 but **not** the core finding: the mutable controller objects, impure reducers, and render-phase mutations are unchanged — the migration deliberately kept them (see that plan's Architecture note).
> - `PersonLink`/`PlaceLink` now take a `controller` prop resolved through `usePageController(controller)` (the Task-17 override for out-of-tree callers) — the §3.10 merge must preserve that mechanism.
> - Every other finding re-verified present at the new HEAD. Line numbers below predate the pull; grep the quoted snippets rather than trusting offsets.
> - Remediation plan: `docs/plans/2026-07-14-page-view-remediation.md`.

The directory splits into two eras. The recent layer (`usePageInit.js`, `pageCommentCounts.js`, `PageNotFound.js`, `InitWarning.js`, both test files) is clean: pure builders, documented invariants, unit tests. The legacy layer (`Page.js`, `Narration.js`, `TextContent.js`, `Annotations.js`, and the CSS) carries the bulk of the findings below.

---

## 1. Dead code

### 1.1 Entire dead file: `GroupComment.js`
Imported nowhere in the codebase. Line 5 is `return null`, making the 30 lines of lorem-ipsum JSX below it unreachable even if it were imported. **Delete the file.**

### 1.2 Dead component: `FaxBubbleContainer` (`Annotations.js:10-55`)
Exported but has zero importers (TextContent imports only `CommentaryBubbles` and `ImageBubbles`). Removing it also removes:
- the `crypto-browserify` import (`Annotations.js:4`) — a heavyweight polyfill pulled in solely to generate its random tooltip id;
- the `oldbook` svg import and `label`/`useState` usage tied to it;
- orphaned CSS in `Narration.css`: `.fax .comment` (495), `.fax.visible` (501), `.fax:hover` (505), `.fax.visible img` (509) — the base `.fax` rule they modify is itself inside a commented-out block (475-493), so these rules style a component that no longer renders. (Careful on removal: `TextItemCounters` uses `item_counter fax`, a different class.)

### 1.3 Dead stylesheet: `animation.css`
Imported by nothing (`grep -rn "animation.css"` — no hits). Its classes (`center-to-left`, `left-to-center`, `center-to-right`, `right-to-center`) are referenced only by the commented-out `pageRedirect`/`checkConnectionType` block in `Connection.js:41-61`. **Delete both the file and the comment block.**

### 1.4 Dead asset: `svg/fullscreen.svg`
No references anywhere; the code uses `svg/fullscreen.png` (`Narration.js:15`).

### 1.5 Dead reducer limbs in `Page.js`
| Item | Location | Status |
|---|---|---|
| `functions.setOpenRows` | 198-200 | Dispatches `"setOpenRows"` — **no reducer case exists** (silent no-op); zero callers anyway |
| `functions.resetPage` + `resetPage` case | 192-194, 810-813 | Zero callers |
| `startAudio` / `pauseAudio` cases | 866-870 | Never dispatched; `states.audioPlaying` (99) is written only here and read nowhere |
| `setTooltip` case | 872-874 | Never dispatched; `states.toolTip` read nowhere |
| `setPageSlug` case | 789-791 | Never dispatched (distinct from the live `setPageSlugId`) |
| `preLoad.peoplePlaceToolTipData` | 112 | Never read anywhere |
| Commented-out code | 757-761, 652, 798, 820, 828, 736 | Old splice loop, `<pre>{commentState}</pre>`, three stale `setActiveLeafCursorController` comments |

### 1.6 Dead controller limbs in `Narration.js`
- `functions.toggleOpenClose` + reducer case `"toggleOpenClose"` + `states.isOpen` (35-48, 235-238): never invoked — TextContent owns open/close with its own controller. Narration's `states.isOpen` is only ever read by a commented-out `debugger` line (947).
- Unused import: `classNames` (line 20).
- Empty `useEffect` in `PeoplePlacePanel` (679-682) — body is a comment.
- `Page.js:3` imports `ReactTooltip` and never uses it.

### 1.7 Dead props
- `Section.js:17` accepts `setPageSlug` and forwards it to `PageLink` (90), but `Page.js` never passes it and `PageLink` doesn't declare it. Dead threading through two components.
- `Page.js:630` passes `rowIndex={sectionData}` to `Section`, which doesn't declare `rowIndex`. Dead and misleading (an object named "index").
- `Connection.js:6` declares an `index` prop, never used.

### 1.8 Dead CSS
- `Narration.css:453-494` and `518-539`: two commented-out blocks that are **near-identical copies of each other** (`.image-overlay` / `.images` fixed-overlay styles). Delete both.
- `Page.css:324` `.card .scripture .reference {}` — empty rule.
- `Page.css:331-334`: `.faxbox .faxbox .thumb_tabs li` — the selector spans two lines with no comma; as written it requires a `.faxbox` **inside** a `.faxbox` and matches nothing. Either a typo for two selectors or dead.

---

## 2. Bugs surfaced by the audit
(Not the primary brief, but these are load-bearing enough to record.)

1. **`addToPageCommentIndex` (`Page.js:904-919`)** — line 914 checks `meta[key]` where every sibling function checks `meta.links[key]`; it then assigns `[]` and immediately overwrites with `item` on the next line. The Array check is dead-wrong code that only works by accident of the overwrite.
2. **`updateToPageComment` (`Page.js:921-933`)** — the `comments[key] === undefined` guard is commented out (928); an update for a key not yet indexed throws `TypeError`.
3. **`deleteToPageComments` (`Page.js:944`)** — sets the entry to `[]` instead of deleting it. `[]` is truthy, so every downstream existence check (`pageComments?.[type]?.[id]`) still sees a "comment" after deletion.
4. **`Floaters.js:19-21`** — `document.querySelector(...)?.offsetTop + "px"` yields the string `"undefinedpx"` on a miss, so the `if (!topVal)` fallback can never fire. Also: the mapped user circles have no React `key`.
5. **`Section.js:102`** — `else return rowData` returns a raw data object as a JSX child; any unrecognized row type crashes React ("Objects are not valid as a React child").
6. **`TextContent.js:134`** — user-selected highlight text is interpolated into `new RegExp("(" + highlight.string + ")")` unescaped; selecting text containing `(` or `[` throws. (Image/commentary titles are pre-sanitized in `setHighlights`; comment highlights and manual selections are not.)
7. **`FacsimilePanel` (`Narration.js:966`)** — effect dependency `[narrationController.states]`: the reducer spreads the controller but keeps the same `states` object reference, so this dependency never changes identity and the effect cannot re-fire as intended.
8. **`PersonLink`/`PlaceLink` (`PersonPlace.js:126,151`)** — `popUpData: pageController.preLoad?.peoplePlaces?.person` reads Page's `preLoad` stub, which is initialized to `{}` (`Page.js:111-114`) and never populated. Always `undefined` when invoked from a Page; the real data lives on `appController.preLoad`.
9. **`LightBox` (`Narration.js:443-445`)** — `setTimeout(fn, [100])`: the delay is an array (works only via string coercion).
10. **`Page.js:59-66`** — mutates `match.params` from react-router directly.
11. **`Connection.js:91` / `PageLink.js:24`** — `while (!document.querySelector(".content.ready")) await wait(50);` an unbounded poll; if the target page never reaches `.ready` the loop spins forever.
12. **`ScripturePanel` (`Narration.js:808-845`)** — attaches a window-level `keydown` handler that hijacks Tab and arrows globally while any scripture panel is open.
13. **`loadPageComments` (`Page.js:510-540`)** — window listeners are added with the remove-then-add idiom, keyed by pageSlug, but never removed on unmount; handlers accumulate per visited page. (Remove-before-add also silently fails here: each render creates *new* function identities, so the `removeEventListener` calls are no-ops except within a single closure.)

---

## 3. DRY violations

1. **Stage-transition choreography duplicated verbatim** — `Connection.js:81-93` and `PageLink.js:14-26` contain the same 12-line `handleClick` (setStageClass dance, `history.push`, poll loop). Extract to a shared `useStageTransition(slug)` hook.
2. **Inline-tag ID extraction duplicated** — the `\[i\](\d+)\[\/i\]` / `\[c\](\d+)\[\/c\]` scan-and-dedupe appears twice in `Narration.js` (294-328, once for content and once for quotes) and twice more in `TextContent.js` (218-228). One `extractTagIds(content, tag)` helper would replace all four.
3. **Title→regex sanitization repeated 4×** — `Narration.js setHighlights` (152-154, 159-161, 172-174, 179-181): the identical `.replace(/^[^a-z\d]*|[^a-z\d]*$/gi,"").replace(/[^a-z]+/gi,…)` chain, four copies inside one function.
4. **`gatherCommentary` ≡ `gatherImages`** — `Annotations.js:63-88` vs `203-234`: the same DOM-anchor grouping algorithm, differing only in selector (`a.c` vs `a.i`) and one constant (`paddingTop` vs `height`).
5. **`CommentaryBubble` ≡ `ImageBubble`** — `Annotations.js:103-201` vs `256-392`: ~70% shared (comment-count computation, fade-in state, hover preview handlers, absolute positioning by `item.y`).
6. **Page-comment index quartet** — `indexPageComments` / `addToPageCommentIndex` / `updateToPageComment` / `deleteToPageComments` (`Page.js:887-947`) share the same parse-JSON-then-loop-links skeleton four times, and the copies have *diverged into the bugs* listed in §2.1-2.3 — the textbook DRY failure mode.
7. **`scripture_link` parser logic exists 3×** — `SingleNoteItem.parserOptions` (`Narration.js:746-759`), `renderPersonPlaceHTML` (`PersonPlace.js:54-59`), and `ParseMessage` (`models/Utils.js:660-676`), each with slightly different `classname`→`className` handling (one even ships a `TODO: figure out why`).
8. **Digit-to-script conversion duplicated with contradictory outputs** — `numberFormat` (`PersonPlace.js:198-205`) converts to *subscripts* and, lacking `/g`, only converts the first occurrence of each digit; `replaceNumbers` (`Narration.js:686-691`) converts to *superscripts*. Same concept, two behaviors, visible-to-user inconsistency.
9. **Scripture ref-grid duplicated across layers** — `ScripturePanel` (`Narration.js:776-871`) vs `ScripturesContainer` (`models/Utils.js:687-700`): same grid-of-refs + `ScripturePanelSingle` composition, one with keyboard nav, one without.
10. **`PersonLink` ≡ `PlaceLink`** (`PersonPlace.js:119-168`) — identical except the type string and path prefix.
11. **`toggleOpenClose` ≡ `toggleOpenCloseHeader`** (`TextContent.js:28-63`) — identical reducer bodies differing only in which state flag they flip.
12. **Duplicated slug-apply inside one reducer case** — `Page.js setActiveRow`: lines 679-680 run `applySlug` + `autoClicked.delete` unconditionally, then 739-742 run the exact same pair again behind `if (states.init)`. The second block is redundant.
13. **Triple import of the same module** — `Narration.js:11,13,17` imports from `src/models/Utils` on three separate lines under two path spellings (`src/models/Utils` and `../../models/Utils`); `TextContent.js:11,20` same pattern.
14. **CSS duplicates**
    - `Page.css`: `.theater-link` block twice (236-255 and 427-431); `.right-image.leftconnection:hover::before` twice (130-133 and 145-148).
    - `Narration.css`: the panel-wrapper `h5 span` rules twice **with conflicting values** (329-342: plain bold vs 345-361: `font-size: 2em; top: -5px` — the second silently wins); `.narration .images` twice (132, 285); `.narration .images img.panel` twice with conflicting borders (123: `1px solid #aaa` vs 191: `2px solid black`).
    - `TextContent.css:400-404`: `.imgcom:not(.fadedIn)` listed twice in one selector group; the `.comcom` bare selector in the "fadedIn" group (411) forces opacity 1 regardless of fade state.

---

## 4. Single-source-of-truth violations

1. **Current location is held in ≥5 places**: `match.params` (live), `states.route` (the match object frozen at first mount — `FacsimilePanel` reads `states.route.params` at `Narration.js:955-957`, which goes stale as soon as the user navigates within the Page component), `states.initOpen` (refreshed by effect), `states.pageSlug`/`states.textId` (refreshed by `setPageSlugId`), and `localStorage.studybookmark`. The `setPageSlugId` reducer case (`Page.js:831-842`) writes the same value into three of these — the tell that the representation is denormalized.
2. **A row's open state has four representations**: `pageController.states.openRows`, `textContentController.states.isOpen`/`isHeaderOpen`, `narrationController.states.isOpen` (dead, §1.6), and the DOM class `.reference.open` — which `isRefOpen()` (`usePageInit.js:12`) treats as the actual arbiter during scroll campaigns. TextContent seeds `isOpen` from `openRows` at mount (`TextContent.js:188-192`) but nothing keeps them in sync afterwards.
3. **Three `preLoad`s**: `pageController.preLoad` (empty stub, §2.8), `appController.preLoad` (frozen per-mount copy), and `global.preLoad` — `NarrationToolTip` (`PersonPlace.js:176-177`) explicitly works around the frozen copy by preferring the global. The workaround is documented, but the stub on pageController should be removed rather than routed around.
4. **`document.title` written from six call sites** — Page reducer ×3 (`setActiveRow`, `removeOpenRow`, `setActiveSection`, `setPageData`), `ImagePanel`, `FacsimilePanel`, `ScripturePanel`. No single owner; last-writer-wins with no restore discipline.
5. **`setStageClass` published by render-phase mutation** — `Page.js:598` does `appController.functions['setStageClass'] = setStageClass` on every render, injecting a Page-local `useState` setter into the global function table (consumed by `Connection`/`PageLink`). Works, but it's a hidden global with no lifecycle: after Page unmounts the table holds a setter for a dead component.
6. **Comment data split-brain (accepted)** — `pageComments` (raw index) and `pageCommentCounts` (derived) live side by side; fax counts are derived client-side while com/img come from the server. This one is documented in `pageCommentCounts.js` and covered by tests — acceptable, but any new count type must pick a side.

---

## 5. Separation-of-concerns / antipatterns

1. **The homegrown "controller" pattern** (Page, Narration, TextContent each build a mutable `{states, functions, data}` object inside `useReducer`, mutate it in place, and return a shallow clone) reinvents a store without any of the guarantees — while the app already ships Redux. React's reducer-replay semantics have already caused two production bugs that are memorialized in comments (`Page.js:33-38`, `783-787`). The pattern guarantees more: state mutations are invisible to `React.memo`/deps (see §2.7, where a nested object's stable identity breaks an effect).
2. **`setActiveRow` is a side-effect bomb inside a reducer** (`Page.js:664-743`): constructs `new Audio`, attaches an `ended` listener, plays sound, sets `document.title`, navigates (`applySlug`), writes `localStorage`, and fires a *three-deep chain* of API calls with a `setTimeout` sized off audio duration — all inside a reducer React is free to replay. The two fixes already applied to this file (applySlug, setActiveLeafCursorController) treated symptoms of exactly this pattern; the biggest instance remains.
3. **947-line god component** — `Page.js` combines routing normalization, data fetching (two fetch paths), Sendbird comment loading + indexing, window event-listener management, socket-event processing, scroll orchestration wiring, audio lifecycle, progress logging, and rendering. The comment-index functions and `loadPageComments` are the natural extraction seams (a `usePageComments` hook + a pure `commentIndex.js` module next to `pageCommentCounts.js`, which shows the target shape).
4. **DOM as data source / DOM as event bus**:
   - `gatherImages`/`gatherCommentary` measure live DOM geometry during render (`Annotations.js`), causing layout reads inside the render phase;
   - `LightBox` drives the third-party lightbox by programmatically `.click()`-ing DOM nodes found via `document.querySelector` (`Narration.js:437-447, 606`);
   - `autoAdvance` finds the next row via `a[href='/…']` (`Page.js:130-131`);
   - `getPageDataFromAPI` navigates by clicking `.contents_link a` with a `//TODO history.push` admitting it (`Page.js:390-391`);
   - cross-component comment updates travel over `window.addEventListener("addMessageToPage-<slug>")` string-keyed events (`Page.js:510-540`).
5. **Render-phase side effects and prop mutation**: `Page.js:598` (function-table write, §4.5); `Page.js:625` mutates `sectionData.sectionIndex` during map; `TextContent.js:277-278` rewrites `data.heading` on every render; `TextContent.js:247` and `Narration.js:355` reassign `controller.pageController` during render; `ImagePanel` triggers `preLoadSupplement` (an API call) from the render path (`Narration.js:602-604`); `ImageBubble` calls `setCycleIndex` during render (`Annotations.js:322-323`); `SingleNoteItem` mutates `item.text` (`Narration.js:761`).
6. **`MuteButton.js:14-16`** mutates the shared `preferences` object in place before handing it to `updatePrefs` — the store sees old === new.
7. **`Connection.js:12-39`** derives `pageAnimation` from `rowData.connection.type` via `useState`+`useEffect` — derived state that should be a pure lookup table (one render with wrong animation class on every type change, plus a redundant re-render).
8. **`for…in` over arrays and NodeLists** throughout `Page.js`/`Narration.js`/`Annotations.js` — the NodeList cases only survive because of `className !==` guards that skip the inherited keys.
9. **Section-level `ReactTooltip id="page-info-tooltip"`** (`Section.js:50-56`) renders one tooltip instance *per section* with the same id — duplicate-id DOM, N-1 of them dead weight.

---

## 6. What's healthy (keep doing this)

- `usePageInit.js`: pure step-builders separated from the effect, invariants documented at the decision point, instrumentation seam (`recordDeepLinkEvent`), and real unit tests including rAF/timer edge cases.
- `pageCommentCounts.js`: tiny pure module with tests; the P1 spec reference in the header comment makes provenance checkable.
- `PageNotFound.js` / `InitWarning.js`: small, prop-driven, label-with-fallback pattern.
- The load-bearing comments in `Page.js` (reducer-replay warnings, cache-gate explanations) are exactly the right kind — they state constraints the code can't show.

---

## 7. Suggested remediation order

1. **Zero-risk deletions** (no behavior change): `GroupComment.js`, `FaxBubbleContainer` + `crypto-browserify` import + orphan `.fax` CSS, `animation.css` + `Connection.js` comment block, `fullscreen.svg`, dead reducer cases/functions/state (§1.5), unused imports, dead props (§1.7), duplicated/empty CSS rules (§1.8, §3.14).
2. **Small correctness fixes**: comment-index quartet (§2.1-2.3 — collapse into one `applyToIndex(comments, item, fn)` helper, fixing all three bugs at once), `Floaters` topVal/key, `Section` unknown-row-type fallback (`return null`), regex escaping in `renderTextContent`, `MuteButton` mutation.
3. **DRY extractions with tests**: stage-transition hook (§3.1), tag-ID extractor (§3.2), bubble gatherer + generic `AnnotationBubble` (§3.4-3.5), digit-script formatter with one canonical output (§3.8).
4. **Structural (needs a plan doc first)**: extract `usePageComments` from Page.js; retire `states.route` in favor of live match params; unify row-open state onto `openRows` as the single owner. The controller-pattern replacement is a rewrite-scale decision — flag for the Next.js-era architecture discussion rather than piecemeal refactoring.
