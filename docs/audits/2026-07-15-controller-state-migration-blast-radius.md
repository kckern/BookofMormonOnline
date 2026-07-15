# Blast-radius audit — controller state-management migration (Page / Narration)

**Phase 0 gate.** This audit must pass before any code is written. It enumerates every
consumer of the three Page-view controllers (Page, Narration, TextContent) that could break
when they move from the mutable-object-in-`useReducer` pattern to immutable pure reducers.

## 1. Baseline

- **Branch:** `refactor/page-structural-followups` (audit stays on this branch; analysis only, no production code).
- **Tests:** `174 passed` (green baseline, per Phase 0 handoff).
- **Focus:** Page (`views/Page/Page.js`) and Narration (`views/Page/Narration.js`).
  TextContent (`views/Page/TextContent.js`) was already made stateless in a prior task — Phase 1 verifies it, this audit does not re-derive it.

## 2. Invariant changes introduced by the migration

- **(a) Identity was stable, fields mutated → identity now changes per update.**
  Today `controller` and `controller.states` are the *same object* across renders; the reducer
  mutates fields in place and returns `{...controller}` (a shallow copy that reuses the nested
  `states`, `functions`, `pageComments`, ... references). Consumers that captured the controller
  or its `states` object once and expected to see later field writes through that same reference
  will, after the migration, hold a **stale snapshot**.

- **(b) External writes to `controller.states.X` used to "work" (mutation) → now lost writes.**
  Any code outside the three controller files that assigns to `controller.states.X` currently
  mutates the live object and is observed. After the migration state is immutable and owned by the
  reducer, so such a write mutates a value that the next dispatch will overwrite/replace — a
  silent lost write. Every such site must become a dispatch or a local variable.

---

## 3. Grep results with dispositions

### Grep (1) — direct `states.X =` writes outside the three controller files

```
grep -rn "pageController.states\.[a-zA-Z]* =\|narrationController.states\.[a-zA-Z]* =" . --include=*.js \
  | grep -v "==|===|!=" | grep -v "Page.js|Narration.js|TextContent.js"
```

**Result: ZERO hits.** No file outside the three controllers writes to
`pageController.states.X` or `narrationController.states.X`. Invariant (b) has **no external
violators** — the only in-place `states.X =` writes live inside the reducers themselves (expected;
they become the pure-reducer body). This is the single most reassuring finding of the audit.

*(Note: the campaign's `autoClicked` Set is mutated externally, but via method call
`.add()/.delete()`, not assignment, so it does not match this grep — covered in Grep (3).)*

### Grep (2) — in-file render-phase mutations to kill

| Hit | Disposition |
|---|---|
| `Page.js:418` `pageController.appController.functions['setStageClass'] = setStageClass;` | **dispatch/effect** — render-phase mutation of `appController.functions`. Move the exposure into a `useEffect` (or a stable ref on appController). Not a `states` write, but it is a render-phase side effect and must leave render. |
| `Narration.js:294` `narrationController.pageController = pageController;` | **ref-read (handled in rewrite)** — wires the live `pageController` onto the narration controller so the Narration reducer can read `narrationController.pageController.states.activeRow` (used in `setActiveImageId`). In the immutable rewrite this wiring must be a live ref, not a render-phase assignment onto the state object. Part of Narration.js's own rewrite; no external consumer. |

Expected third pattern `.pageController = narrationController.pageController` — **no hits.**

### Grep (3) — campaign's direct `autoClicked` Set mutation → becomes `markAutoClicked`

| Hit | Disposition |
|---|---|
| `usePageInit.js:59` `autoClicked.add(slug)` | **dispatch** — becomes `pageController.functions.markAutoClicked(slug)` (new action; the Set is immutable state now). |
| `Page.js:502` `pageController.states.autoClicked.delete(slug)` | **dispatch** — becomes an unmark dispatch (`markAutoClicked(slug, false)` or `unmarkAutoClicked`). Direct Set mutation is a lost write post-migration. |
| `TextContent.js:159` `pageController.states.autoClicked?.has(slug) === true` | **ref-read / state read** — read only, safe; reads the (new immutable) Set from current state. No change needed beyond identity. |
| `__tests__/usePageInit.test.js:138` `autoClicked.has("lehites/3")` | **test** — assertion on the Set; will still hold if `markAutoClicked` populates it. Update test only if the accessor shape changes. |

New reducer actions required: **`markAutoClicked` (add)** and an **unmark** (delete). `resetAutoClicked`
already exists.

### Grep (4) — async closures over the controllers (staleness candidates)

`usePageComments.js` and `usePageInit.js` close over `pageController`. Every read observed goes
through **`pageController.functions.*` or `pageController.states.*` / `.pageComments` / `.pageData`**,
i.e. property access at call time, never a captured `states` snapshot:

- `usePageInit.js`: `buildInitSteps` destructures `pageController.states` at *call* time (line 28);
  the step callbacks read via `pageController.functions.isRowOpen(...)` (65),
  `pageController.functions.markAsInitiated()` (174), `pageController.functions.setInitWarning(...)`
  (183), `pageController.states.initOpen.textId` / `.pageSlug` (182/185),
  `pageController.states.loading` (141). Effect deps include `pageController.states.loading` (210).
  **Disposition: ref-read** — all reads are property lookups through the live controller; safe once
  `functions` is a stable table over a live ref and `states` is re-read (not captured).
- `usePageComments.js`: reads `pageController.pageComments` (65/66/97), `pageController.pageData`
  (76/95/123/151 dep), `pageController.states.pageSlug` / `.commentGroupId` (28/77/99/151 dep),
  `pageController.appController.states.*` (23/32/58), and dispatches via
  `pageController.functions.*` (29/79/81/104/138). Effect deps read
  `pageController.states.pageSlug`, `pageController.pageData`, `pageController.pageComments`.
  **Disposition: ref-read** — safe, but note the in-code comment at line 73 ("pageController's
  inner objects are mutated in place") becomes **false** after the migration and should be updated;
  the effect deps that key on `pageController.pageComments` / `.pageData` identity will now change
  per update (invariant a) — this makes the effects *fire more precisely*, not break, since they
  were already listed as deps.

### Grep (5) — out-of-tree consumers of `activeLeafCursorController` (get the facade)

`grep -rln activeLeafCursorController` →
`models/appController.js`, `contexts/PageControllerContext.js`, `views/_Common/Commentary.js`,
`views/_Common/Sidebar.js`, `views/_Common/PopUp.js`, `views/_Common/Study/Study.js`.

Exact accessors on the exposed cursor controller (this is the leaf `pageController` exposed to
`Main` via `appController.functions.setActiveLeafCursorController(pageController)` in `Page.js:252`,
keyed on `[pageController.pageComments, pageController.pageCommentCounts]`):

| Consumer | Accessors on `activeLeafCursorController` | Disposition |
|---|---|---|
| `models/appController.js:541` | `.states.studyBuddies?.[userId]` | **facade** (live read) |
| `contexts/PageControllerContext.js:6` | comment reference only, no runtime access | **n/a (doc comment)** |
| `views/_Common/Commentary.js:249–253` | `.pageCommentCounts?.[num].com` | **facade** (live read) |
| `views/_Common/Commentary.js:431` | passes **whole controller** as `pageController={...}` prop into `<Comments>` | **facade — full live surface** |
| `views/_Common/PopUp.js:796` | passes **whole controller** as `pageController={...}` prop into `<Comments>` | **facade — full live surface** |
| `views/_Common/Sidebar.js:147,223,409` | `.states.activeAudio?.pause()` | **facade** (live read) |
| `views/_Common/Study/Study.js:1079` | `=== null` identity check | **facade** (existence; facade must be nullable / null when no active page) |
| `views/_Common/Study/Study.js:1080` | `.functions.deleteToPageComments(...)` | **facade** (live function table) |

The two prop-passing sites (Commentary 431, PopUp 796) hand the controller to `<Comments>`, which
resolves it via `usePageController(pageControllerProp)` (`Study.js:53`) and then reads the **full**
controller surface *and expects it to be live* (socket-driven `addToPageComments` must appear in the
open panel): `.pageComments` (553/559–561), `.functions.addToPageComments` (167/638),
`.functions.updateToPageComment` (995), `.states.commentGroupId` (549), `.appController.*`
(405/941). See Facade requirements (§4) — this is why the facade must be a **live proxy**, not a
frozen snapshot.

### Grep (6) — reads of `narrationController.supplement` (moves into state, alias kept)

All hits are in `Narration.js` (in-file):

| Line | Kind | Disposition |
|---|---|---|
| 74 | **write** `narrationController.supplement = input.val` (in `preLoadSupplement` reducer case) | **dispatch/state** — becomes `state.supplement` set inside the pure reducer |
| 122, 151, 152, 177, 390, 424, 435, 474, 525, 526, 528, 531 | reads (`.supplement`, `.supplement.image`, `.supplement.commentary`) | **alias** — keep `narrationController.supplement` as a getter alias to `states.supplement` so these read sites (and any external caller) are untouched; internal rewrite may switch them to `states.supplement` directly |

No external file reads `.supplement` (all hits are `Narration.js`). Alias is a safety belt, not a
hard requirement, but cheap — keep it.

### Grep (7) — dispatch-name inventory (pure reducers must cover every one)

See §5.

### Grep (8) — possibly-dead narration actions

| Symbol | Callers | Disposition |
|---|---|---|
| `setTextContent` (Narration reducer case, line 76–77; writes `narrationController.components.textContent`) | **none** — no `functions.setTextContent`, no `dispatch({fn:"setTextContent"})` anywhere | **dead — delete** the case + the `components.textContent` write |
| `components.textContent` | written only by dead `setTextContent`; **never read** (`Narration.js:341` renders `components.description`, set at init line 285 — different field; `StudyGroupSelect.js:735` `.components` is an unrelated object) | **dead — delete** |
| `setPreviewImageIds` | `Annotations.js:248,251` | **NOT dead — keep** (a `functions` closure that calls `setHighlights`, never dispatches) |
| `setPreviewCommentaryIds` | `Annotations.js:70,74` | **NOT dead — keep** (same; calls `setHighlights`) |

### Grep (9) — whole-controller context consumers (identity-change impact)

All read the controller from context via `usePageController()/useNarration()/useTextContent()`:

`Study.js:53(prop),382,605,913`; `Floaters.js:6`; `useStageTransition.js:35`;
`Annotations.js:30,54,166,185(useTextContent),55,186(useNarration)`;
`TextContent.js:44,297(useNarration)`; `Narration.js:107(usePageController),374,453,589,642,696,861(useNarration)`;
`PageLink.js:10`; `MuteButton.js:10`; `PersonPlace.js:130(usePageController(controller))`.

**Disposition: facade / context re-read (safe).** These are in-tree consumers reading the current
context value. Post-migration the context value identity changes per dispatch (invariant a), which
makes them **re-render correctly on state change** — today they rely on the parent re-rendering and
the mutated fields being visible. This is a behavior improvement (more precise re-renders), not a
break. Watch for any consumer that memoizes on controller identity expecting it *not* to change —
none found in this grep set.

---

## 4. Facade requirements (cursor-controller getter-facade)

The object exposed via `appController.activeLeafCursorController` must be a **live getter-facade over
the current controller ref** — NOT a snapshot captured at `setActiveLeafCursorController` time.
Reason: `<Comments>` (reached from Commentary/PopUp) reads the full surface and must reflect
socket-driven comment updates live. Required surface, derived from every §3-Grep(5) consumer:

| Facade member | Read by | Kind |
|---|---|---|
| `.states` (whole object; live) | Sidebar (`.states.activeAudio`), appController (`.states.studyBuddies`), Study/Comments (`.states.commentGroupId`, and general) | live getter → current state |
| `.states.activeAudio` | Sidebar.js:147,223,409 (`.pause()`) | live getter |
| `.states.studyBuddies` | appController.js:541 | live getter |
| `.states.commentGroupId` | Study.js:549 | live getter |
| `.pageComments` | Commentary/PopUp→Comments (Study.js:553,559–561), usePageComments | live getter (must reflect `addToPageComments`/`updateToPageComment`) |
| `.pageCommentCounts` | Commentary.js:249–253 | live getter |
| `.pageData` | Study/Comments, usePageComments | live getter |
| `.functions` (whole table; stable) | Study.js:1080 (`deleteToPageComments`), Study/Comments (`addToPageComments`, `updateToPageComment`) | stable function table over live ref |
| `.functions.deleteToPageComments` | Study.js:1080 | stable fn |
| `.functions.addToPageComments` | Study.js:167,638 | stable fn |
| `.functions.updateToPageComment` | Study.js:995 | stable fn |
| `.appController` | Study.js:405,941; usePageComments | reference passthrough |
| nullability | Study.js:1079 `=== null`; Commentary.js:248 truthiness | facade is `null` when no active page, a live object otherwise |

**Verdict:** a partial hand-picked getter set is insufficient. The safest implementation is a thin
proxy whose `states`, `pageComments`, `pageCommentCounts`, `pageData` getters read the current
controller ref, and whose `functions` / `appController` pass through the stable table/reference.

---

## 5. Reducer action inventory (pure reducers must cover all)

### Page (`views/Page/Page.js`) — 17 existing dispatch actions
`setLoading`, `markAsInitiated`, `setPageData`, `setPageComments`, `addToPageComments`,
`updateToPageComment`, `deleteToPageComments`, `setActiveRow`, `removeOpenRow`, `setActiveSection`,
`setPageSlugId`, `resetAutoClicked`, `setNotFound`, `setInitWarning`, `setInitOpen`,
`moveStudyBuddies`, `setPageProgress`.

Pure helpers (no dispatch, keep as closures over the live ref): `autoAdvance`, `isRowOpen`.

**New actions to add:** `markAutoClicked` (add slug) + unmark/delete (from Grep (3)).

Side effects currently inside reducer cases that must move to effects in the pure rewrite:
`setActiveRow`/`setPageComments` do `applySlug` / `setActiveLeafCursorController` exposure — the
exposure already lives in an effect (`Page.js:250`); verify no reducer case retains a `Main`
setState or `appController.functions.*` call.

### Narration (`views/Page/Narration.js`) — reducer cases
`setPanelImageIds`, `setActiveImageId`, `setActiveFax`, `toggleFax`, `preLoadSupplement`,
`~~setTextContent~~ (DELETE — dead)`, `setHighlights`, `setPeoplePlaceSlugs`, `setScriptures`,
`setNotes`, `clearAllPanels`.

Wrapper `functions` (no dispatch or extra behavior): `setPreviewImageIds`, `setPreviewCommentaryIds`
(call `setHighlights`), `preloadFax`, `preLoadSupplement`, `getSupplement`, `setCommentHighlights`,
`setPeoplePlaces`.

Reducer-embedded side effects to relocate out of the pure reducer: `setActiveImageId`,
`setActiveFax`, `toggleFax` all call `narrationController.appController.functions.setSlug(...)` and
`toggleFax` calls `functions.setActiveImageId(0)` — these `setSlug` / re-dispatch side effects must
move to the dispatching call sites or effects; the pure reducer only computes next state.
`setActiveImageId`/`setActiveFax` also read `narrationController.pageController.states.activeRow` and
`narrationController.data.text.slug` — the live `pageController` ref (Grep 2) and `data` must remain
reachable.

State fields: `supplement` moves from controller root into `states` (Grep 6), alias kept.

---

## 6. STOP list (must be resolved before coding)

**No hard STOPs.** Grep (1) returned zero external `states.X =` writes — the migration's central
risk (invariant b violators) has no offenders. Every hit above has a clean disposition.

Two items are **not STOPs but must not be forgotten** in the rewrite (they are in-file, no external
consumer, but they are render-phase side effects that a naive pure-reducer conversion would drop or
mis-place):

1. **`Page.js:418` `appController.functions['setStageClass'] = setStageClass`** — render-phase
   mutation exposing a function to `appController`. Move to an effect/ref; if silently dropped,
   whatever calls `appController.functions.setStageClass` breaks. (Confirm callers before moving.)
2. **`Narration.js:294` `narrationController.pageController = pageController`** — the Narration
   reducer depends on this live wiring (`setActiveImageId` reads `pageController.states.activeRow`).
   The immutable rewrite must keep `pageController` reachable as a live ref, or those cases read a
   stale/absent row.

And one **live-facade requirement that is a latent break if implemented as a snapshot** (§4): the
cursor facade MUST proxy live `pageComments`/`states`/etc. If the migration exposes a frozen copy at
`setActiveLeafCursorController` time, socket-driven comment updates stop appearing in the open
PopUp/Commentary Comments panel — a functional regression that tests may not catch (no socket in the
174-test suite). Flag for manual verification.

---

## 7. Dead actions to delete (from Grep (8))

- **`setTextContent`** (Narration reducer case, `Narration.js:76–77`) — callerless. Delete the case.
- **`components.textContent`** — written only by the dead action, never read. Delete the write; the
  `components` object otherwise holds `description` (init-set, still used at `Narration.js:341`), so
  keep `components` itself.

`setPreviewImageIds` / `setPreviewCommentaryIds` are **NOT** dead (called from `Annotations.js`) —
keep them.
