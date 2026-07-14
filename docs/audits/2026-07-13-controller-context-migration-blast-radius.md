# Blast radius: migrating *Controller prop drilling → React Context

**Date:** 2026-07-13
**Scope:** `frontend/webapp/src` — replacing `appController` (and `pageController`, `narrationController`, `textContentController`, `theaterController`, `mapController`) prop drilling with a context-based pattern.
**Status:** analysis only; no migration code written.

---

## Headline numbers

| Controller | Refs | Files (non-test) | Created at | Mechanism | Max drill depth |
|---|---|---|---|---|---|
| `appController` | ~1,790 | ~62 (183 JSX pass sites) | `views/_Common/Main.js:35` | `useReducer` | **14 hops below Main** |
| `pageController` | 346 | ~10 | `views/Page/Page.js:209` | `useReducer` + init IIFE | ~6–7 |
| `narrationController` | 244 | 3 (all in `views/Page/`) | `views/Page/Narration.js:280` | `useReducer` + init IIFE | 2–3 |
| `theaterController` | 147 | 1 (`Theater.js`, 1,920 lines) | `views/Theater/Theater.js:191` | plain object, rebuilt per render | 5 |
| `textContentController` | 88 | 2 | `views/Page/TextContent.js:207` | `useReducer` + init IIFE | 2 |
| `mapController` | 79 | 4 | `views/Map/Map.js:121` | plain object, rebuilt per render | 2 |
| `activeLeafCursorController` | 14 | 5 | not a controller — a slot on appController holding the live pageController (`Page.js:264-268`) | — | — |

**Single ownership root.** `appController` is constructed exactly once: `useReducer(appControllerReducer, appInit())` at `views/_Common/Main.js:35-40`. `App.js` does not touch it. Distribution fans out from Main to Header, Sidebar, PopUp, BottomMenu, and every route component (`Main.js:174`, ~30 routes).

**Deepest chains** (all explicit `appController` props):
1. Main → Header → StudyGroupBar → StudyGroupDrawer → StudyHall → StudyGroupMainPanel → DirectMessages → StudyGroupChatPanel → StudyGroupThread → ThreadMessages → ThreadedMessages → BaseMessage → MessageTypes → CommentaryComment → CommentaryInFeed (14 hops)
2. Same trunk → Message → TagList (14 hops)
3. Same trunk skipping DirectMessages (13 hops)
4. Main → Welcome → WelcomeUnShaken → CommunityFeed → HomeFeed → HomeFeedItem → Comments → Comment → ParseMessage → LinkPreviewContainer → LinkPreview → CommentaryPreview (11 hops, crosses into `models/Utils.js`; appController is smuggled *inside the comment data object* at `Feed.js:637`, unwrapped at `Feed.js:757`)
5. Main → PopUp → MobileDrawer → DrawerContent → MobileChatThread → StudyGroupThread → … → TextInFeed (11 hops)

Plus a 10-hop chain that rides **three different carrier objects**: Main → Page → Section → Narration → TextContent → Comments → … → EditComment → TagList, where appController is embedded in `pageController` (`Page.js:216`), then `narrationController` (`Narration.js:288`), then `textContentController` (`TextContent.js:206-214`), and unwrapped at `Study.js:74`.

---

## Favorable factors (things that make this cheaper than it looks)

1. **Zero class components.** Every component in `src/` is a function component — `useContext` works everywhere, no `contextType`/`Consumer` shims.
2. **A precedent already exists and was designed as step 1 of this exact migration.** `contexts/MessengerContext.js` (`createContext` + `useMessenger()` hook + provider mounted in `Main.js:139`) is documented in `docs/specs/2026-06-11-messenger-context-provider.md` as "Step 1 of the appController→context migration". It demonstrates the house patterns: `useRef` to track the identity-churning appController (`MessengerContext.js:60-63`), injected factory for testability, and a `noopController` stub.
3. **Naive context cannot make re-renders worse.** `appControllerReducer` returns `{...appController}` on every dispatch (`models/appController.js:188`), so every subscriber already re-renders on every dispatch. The only `memo()` components taking controller props (`ChapterContent`/`ScriptureBlock`, `views/Read/components/ChapterContent.js:35,98`) never bail out today because the prop identity changes each dispatch. A whole-object context value reproduces current behavior exactly; anything smarter (split contexts, selectors) is a strict improvement.
4. **Tiny test surface.** Only two test files build controller fixtures: `contexts/__tests__/MessengerContext.test.js` and `views/Read/__tests__/Read.test.js:41-47`.
5. **Redux is dead weight, not a constraint.** `redux`/`react-redux` are in package.json but there is no store, no `<Provider>`; two dead `useSelector` imports in `views/About/`. Nothing to reconcile.
6. **Free deletions.** Several components receive `appController` and never use or forward it: Contact (`Contact.js:21`), MobileMenu (`MobileMenu.js:7`), NameControls (`Names.js:40`), plus route components that ignore it entirely (About, KRSEB, Facsimiles, Contents, Timeline, PeopleNetwork, JosephSmith). ~25 more components are pure pass-throughs whose prop plumbing simply gets deleted (Section, MessageList, SingleComment, ThreadMessages, MessageTypes and the five *Comment wrappers, ReadScripture, SearchComponent, Witnesses, ProgressDetails, BotCircles, TheaterStaticContent, TheaterMeta, TheaterSidePanel, CommentFeed, …).

---

## Hazards (where a naive migration breaks)

### H1. The reference cycle: `activeLeafCursorController`
`Page` registers its own `pageController` back onto appController (`Page.js:264-268` → `models/appController.js:483-486`), producing `appController.activeLeafCursorController.appController === appController`. Out-of-tree components then **re-enter the Page component tree with it**: `Commentary.js:431` and `PopUp.js:790` render `<Comments pageController={appController.activeLeafCursorController}>`. So `Comments` (Study.js) receives a "pageController" prop that is *either* the in-tree live controller *or* this global escape hatch. A `PageControllerContext` cannot serve the out-of-tree callers — Comments must keep a prop override (`prop ?? useContext`) or the cursor slot must survive the migration as-is. **This is the single trickiest design decision in the whole migration.**

### H2. Controllers embedded in data objects
`Feed.js:637` stores appController *inside each comment object* and unwraps it at `Feed.js:757` before handing it to `ParseMessage` in `models/Utils.js`. Data objects can't read context; these call sites need restructuring, not mechanical substitution.

### H3. Mid-tree augmentation — two values of "the same" controller in one tree
- `TheaterMainPanel` shadows `theaterController` with a spread-and-extend (`Theater.js:393-399`), so MainPanel descendants see a richer object than SidePanel descendants. One provider at TheaterWrapper can't represent both; either re-provide at MainPanel or hoist the extra state.
- `MapPanel` grafts its own state onto the parent's object (`mapController.selectedStory = …`, `MapPanel.js:232-233`) — child-mutates-parent, invisible to context propagation.

### H4. Runtime mutation of the functions map
- `Page.js:598`: `pageController.appController.functions['setStageClass'] = setStageClass` stuffs a React setState into the shared functions map; consumed at `Connection.js:76`, `PageLink.js:9`.
- `MessengerContext.js:83`: `app.sendbird = ctrl` — the compatibility bridge with **78 non-test `appController.sendbird` call sites**. The bridge works precisely *because* everyone shares one mutable object; context consumers reading a snapshot won't see mutations without the `messengerBridgeChanged` re-render nudge (`appController.js` notifier).

### H5. Non-React code that holds or receives appController
Context is a React-only mechanism; these stay argument-passing (fine) or need care:
- `global._appDispatch` (`Main.js:40`) — how `models/appController.js` builds dispatch closures outside React. Unaffected by context, but it *is* the real state root; don't let a migration fork it.
- `models/MessengerController.js:73-76` — plain class storing appController; socket handlers call `functions.setStudyGroups` etc. (lines 205–280).
- `models/Utils.js` — `getUsersFromTextInput` (:113), `refreshChannel` (:538), `log` (:550), `formatText` (:575), `ParseMessage` (:655 — a hook-calling function-component-in-disguise).
- `models/BoMOnlineAPI.js:19` — `exitBeacon(appController)`.
- `views/Page/Page.js:39-40` — module-level `applySlug()` calls `appFunctions.setSlug` directly, **bypassing dispatch**.
- `Main.js:43-74` — window event listeners (`fireStudyGroupAction`, `fireMessage`, `typingStatusUpdated`, `visibilitychange`, `beforeunload`) registered once with `[]` deps, closing over the first-render appController; they rely on `functions` identity being stable across dispatches.
- `global.preLoad` (`appController.js:346`) — deliberately preferred over the prop at `PersonPlace.js:169-175` (stale-clone workaround).
- Leaflet drawing code in `MapContents.js` reads `mapController.appController` outside React rendering (:203-214, :356).

### H6. Per-instance controllers are not singletons
`narrationController` and `textContentController` are created **per mounted row/block** — many live instances at once, and TextContent recurses into itself for quotes (`TextContent.js:161-167`). Context handles this fine via *nested providers* (nearest-provider-wins matches current behavior, including quote recursion), but a single app-level provider does not.

### H7. Sub-controller cross-links assume object identity
`narrationController.pageController = pageController` re-assigned every render (`Narration.js:355`), `textContentController.pageController = narrationController.pageController` (`TextContent.js:246`), reducers reaching three hops (`textContentController.narrationController.pageController.pageData.title`, `TextContent.js:37,55`). Replacing carrier objects with contexts means each consumer takes each context directly instead of chaining — mechanical but touches every one of these expressions.

---

## Incidental findings (pre-existing, found during analysis)

- **Latent TypeError:** `theaterController.controls.pause()` at `Theater.js:1005` — `controls` was spread into the object, never attached as a key; throws if the 100%-completion "victory" branch runs. Should be `theaterController.pause()`.
- Misnamed reducers: `setUser` writes `states.panelImageIds`, `setStudyGroup` overwrites `states.popUp` (`appController.js:204-211`).
- Dead export `FaxBubbleContainer` (`Annotations.js:10`), unused `Comments` import (`Narration.js:4`), dead `useSelector/useDispatch` imports in `views/About/About.js:2`, `Tos.js:2`.
- `useMessenger()` has zero consumers — all messenger traffic still flows through the `.sendbird` bridge.

---

## Blast radius by phase (suggested order, each phase shippable)

### Phase 1 — `AppControllerContext` (large but mechanical)
Provider wraps Main's children; `useAppController()` hook mirrors `useMessenger()`. Consumers migrate leaf-first, file by file; prop and context can coexist indefinitely.
- **Files:** ~62 non-test consumers + ~25 pure pass-throughs (deletions) + ~10 dead-prop cleanups. 183 JSX pass sites eventually deleted.
- **Risk:** low per file; H2 (Feed comment embedding), H4 (sendbird bridge — keep the mutable-object + notifier pattern), H5 call sites keep receiving it as an argument from a hook-holding parent.
- **Biggest wins:** the 14-hop Study/chat chains collapse; `Study/StudyChat.js`, `StudyHall.js`, `StudyGroupBar.js` shed dozens of pass sites.

### Phase 2 — `TheaterContext` and `MapContext` (small, contained)
Single-file (Theater) and 4-file (Map) scopes, single instance per route.
- **Prework:** fix H3 — hoist `TheaterMainPanel`'s augmentation (or re-provide), move `MapPanel`'s grafted state up to MapContainer. Fix the `Theater.js:1005` bug while there.
- **Risk:** low; no external consumers of either controller.

### Phase 3 — Page family: `PageControllerContext`, nested `NarrationContext`/`TextContentContext` (small file count, highest coupling)
- **Files:** ~10 (`Page.js`, `Section.js`, `Narration.js`, `TextContent.js`, `Annotations.js`, `Connection.js`, `PageLink.js`, `PersonPlace.js`, `Floaters.js`, `MuteButton.js`, plus `Study.js` Comments).
- **Prework:** decide H1 — recommended: `Comments` accepts an optional `pageController` prop that overrides context (out-of-tree callers via `activeLeafCursorController` keep working), revisit the cursor slot later.
- Nested providers per Narration row / TextContent block preserve per-instance semantics including quote recursion (H6).

### Explicitly out of scope for a context migration
`global._appDispatch`, `global.preLoad`, `MessengerController`, `models/Utils.js` argument-passing, `exitBeacon`, module-level `applySlug`, and the window event listeners — all keep working untouched as long as Main remains the reducer owner. They're refactor candidates, not blockers.

---

## Bottom line

Blast radius: **~80 production files, ~2,700 controller references, 183 JSX pass sites**, but with one owner, one proven precedent, zero class components, and a re-render profile that context reproduces exactly. The migration is wide, not deep: Phase 1 is a long mechanical grind that can land file-by-file behind no flag; the concentrated design risk lives in three places — the `activeLeafCursorController` cycle (H1), controllers embedded in data (H2), and mid-tree augmentation (H3).
