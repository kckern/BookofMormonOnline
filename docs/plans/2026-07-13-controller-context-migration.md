# Controller → React Context Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate `appController` / `pageController` / `narrationController` / `textContentController` / `theaterController` / `mapController` prop drilling by moving every consumer to React Context hooks, in three independently shippable phases.

**Architecture:** Main.js keeps sole ownership of the appController reducer; a thin `AppControllerProvider` publishes the object via context and a `useAppController()` hook (mirroring the existing `MessengerContext` house pattern). Sub-controllers get their own nested providers created where the controller is created (Page, Narration, TextContent, TheaterWrapper, MapContainer) — nearest-provider-wins reproduces today's per-instance semantics, including TextContent's quote recursion. Controller *objects* keep their embedded cross-references (`pageController.appController`, etc.) because reducers running outside React depend on them; only the prop plumbing is removed.

**Tech Stack:** React 17.0.2 (function components only), CRA/react-scripts (`react-app-rewired` start), Jest + @testing-library/react 11, react-router-dom 5.

**Companion analysis:** `docs/audits/2026-07-13-controller-context-migration-blast-radius.md` — read the Hazards section (H1–H7) before starting. Line numbers in this plan come from that audit; they drift — always grep to confirm before editing.

**Working conventions for every task:**
- Frontend root: `frontend/webapp`. Run tests with `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false` (CI=true prevents watch mode).
- Smoke-test against `http://localhost:8200` (local HMR bundle), never `bom.kckern.net` (Cloudflare edge-caches the bundle for 4h).
- Import style: absolute from `src/` (e.g. `import { useAppController } from "src/contexts/AppControllerContext";`) — matches `MessengerContext.js`.
- After removing a prop from a destructure, check the component body for other uses before deleting; eslint (`react-app` config) flags unused vars — fix them, don't suppress.
- One commit per task. Do not batch tasks into one commit.

---

## Migration recipe R1 (referenced by many tasks)

For each component in the task's file list that currently receives `appController` as a prop:

1. Add (once per file): `import { useAppController } from "src/contexts/AppControllerContext";`
2. In the component signature, remove `appController` from the props destructure.
   - Before: `function Header({ appController, isReady }) {`
   - After: `function Header({ isReady }) {`
3. Add as the first line of the component body: `const appController = useAppController();`
4. If the component **only forwarded** the prop (never read it): skip steps 1–3, just delete `appController` from the destructure and from every `appController={...}` JSX attribute in the file.
5. Delete `appController={...}` JSX attributes for children that no longer declare the prop (i.e., migrated in this or an earlier task). Leaving a stray attribute on a migrated child is harmless (unused prop) — the final cleanup task (Task 12) catches stragglers — but clean up what you can see.
6. Watch for **rest-spread forwarding** (`{...props}`, `{...mapController}`) — grep the file for `...props` before assuming a prop isn't forwarded.

---

# PHASE 1 — AppControllerContext (Tasks 1–12)

## Task 1: Create AppControllerContext with test

**Files:**
- Create: `frontend/webapp/src/contexts/AppControllerContext.js`
- Test: `frontend/webapp/src/contexts/__tests__/AppControllerContext.test.js`

**Step 1: Write the failing test**

```jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  AppControllerProvider,
  useAppController,
} from "../AppControllerContext";

const fixture = {
  states: { user: { user: "testuser" } },
  functions: {},
};

function Probe() {
  const appController = useAppController();
  return <div>{appController.states.user.user}</div>;
}

test("useAppController returns the provided controller", () => {
  render(
    <AppControllerProvider appController={fixture}>
      <Probe />
    </AppControllerProvider>
  );
  expect(screen.getByText("testuser")).toBeInTheDocument();
});

test("useAppController throws a helpful error without a provider", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  expect(() => render(<Probe />)).toThrow(/AppControllerProvider/);
  console.error.mockRestore();
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false -t "useAppController"`
Expected: FAIL — `Cannot find module '../AppControllerContext'`

**Step 3: Write the implementation**

```jsx
/**
 * AppControllerContext — publishes the appController object app-wide.
 *
 * Step 2 of the appController→context migration (step 1 was
 * contexts/MessengerContext.js; see
 * docs/audits/2026-07-13-controller-context-migration-blast-radius.md).
 *
 * Main.js still OWNS the reducer (useReducer + global._appDispatch); this
 * provider only distributes the current object. The reducer returns a fresh
 * shallow copy on every dispatch, so every consumer re-renders per dispatch —
 * identical to the prop-drilling behavior this replaces.
 */
import React, { createContext, useContext } from "react";

export const AppControllerContext = createContext(null);

export const useAppController = () => {
  const appController = useContext(AppControllerContext);
  if (!appController)
    throw new Error(
      "useAppController() called outside <AppControllerProvider>. " +
        "The provider is mounted in views/_Common/Main.js; in tests, wrap " +
        "your component with <AppControllerProvider appController={fixture}>."
    );
  return appController;
};

export function AppControllerProvider({ appController, children }) {
  return (
    <AppControllerContext.Provider value={appController}>
      {children}
    </AppControllerContext.Provider>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false -t "useAppController"`
Expected: 2 passing

**Step 5: Commit**

```bash
git add frontend/webapp/src/contexts/AppControllerContext.js frontend/webapp/src/contexts/__tests__/AppControllerContext.test.js
git commit -m "feat(context): add AppControllerContext provider + useAppController hook"
```

---

## Task 2: Mount the provider in Main.js

**Files:**
- Modify: `frontend/webapp/src/views/_Common/Main.js` (render block, ~line 138)

**Step 1: Wrap the tree**

Import: `import { AppControllerProvider } from "src/contexts/AppControllerContext";`

Wrap the existing return so `AppControllerProvider` is **outermost** (MessengerProvider keeps its explicit prop — it mutates the object and is the documented bridge owner):

```jsx
return (
  <AppControllerProvider appController={appController}>
    <MessengerProvider appController={appController}>
      {/* ...existing tree unchanged... */}
    </MessengerProvider>
  </AppControllerProvider>
);
```

Do NOT remove any `appController={...}` props from Main.js yet — that happens in Task 12 after all consumers are migrated.

**Step 2: Verify**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false`
Expected: full suite passes (18 test files).
Smoke: `curl -s http://localhost:8200 | head -c 200` returns HTML; load the site in a browser — home page renders, sign-in state unchanged.

**Step 3: Commit**

```bash
git add frontend/webapp/src/views/_Common/Main.js
git commit -m "feat(context): mount AppControllerProvider at the Main.js root"
```

---

## Task 3: Delete dead appController props

These components declare the prop and never read or forward it. Pure deletions, no hook needed.

**Files:**
- Modify: `frontend/webapp/src/views/Contact/Contact.js` (~:21)
- Modify: `frontend/webapp/src/views/_Common/MobileMenu.js` (~:7)
- Modify: `frontend/webapp/src/views/Analysis/Names/Names.js` — `NameControls` (~:40) only; `Container` (~:9) forwards it, leave for Task 8.

**Step 1:** In each file, remove `appController` from the props destructure. Grep the file body first to confirm zero other references: `grep -n "appController" <file>`.

**Step 2:** Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false` — passes.

**Step 3: Commit**

```bash
git commit -am "refactor(context): drop dead appController props (Contact, MobileMenu, NameControls)"
```

---

## Task 4: Migrate the Study/chat subtree (deepest chains — 14 hops collapse here)

**Files (all under `frontend/webapp/src/views/_Common/Study/`):**
- Modify: `Study.js` — consumers: `Comments` (unwraps `pageController.appController` at ~:74 — replace that unwrap with the hook), `CommentInput`, `MyComment`, `EditComment`, `MessageFooter` (receives `appController={pageController.appController}` at ~:900 — switch to hook). Pass-throughs to strip: `MessageList`, `SingleComment`, `ThreadedMessages`. **Do not touch the `pageController` prop threading** — that is Phase 3.
- Modify: `StudyChat.js` — consumers: `StudyGroupThread`, `ThreadedMessages`, `BaseMessage`, `LikeButton`, `TypingIndicators`, `CommentInput`. Pass-throughs: `ThreadMessages` (~:768), `MessageTypes` (~:1333), `TextComment`, `CommentaryComment`, `SectionComment`, `ImageComment`, `FaxComment`, `Message`.
- Modify: `StudyHall.js` — `StudyHall`, `StudyGroupHeader`, `StudyGroupSideBar`, `UserSideBarItem`, `StudyGroupMainPanel`, `StudyGroupChatPanel`, `StudyGroupChat`, `StudyGroupChatInput`.
- Modify: `StudyGroupBar.js` — `StudyGroupBar`, `StudyGroupStatus`, `StudyGroupUser`, `StudyGroupUserCircle`, `UnreadDMCount`, `LiveMessageStudy`, `LiveMessageDM`, `BotPlugin`, `StudyGroupDrawer`, `StudyGroupSelect`, `StudyGroupList(+Items,+Item)`, `NewStudyGroup`. Pass-through: `BotCircles`.
- Modify: `StudyGroupSelect.js`, `StudyGroupAdmin.js` (+ `RequestManagement`, `Requester`, `BannedMembers`), `StudyGroupProgress.js`, `StudyGroupNotebook.js`, `DirectMessages.js`, `Mobile/MobileStudy.js` (+ `MobileChatHeader`), `ActionBubble.js`, `TagList.js`, `StudyInFeed.js` (all five `*InFeed` components).

**Step 1:** Apply recipe R1 to every file, bottom-up (leaf components first: TagList → StudyInFeed → StudyChat internals → StudyHall → StudyGroupBar → Study.js).

**Step 2: Grep gate**

Run: `grep -rn "appController={" frontend/webapp/src/views/_Common/Study/`
Expected: empty. Then: `grep -rn "props.appController\|({.*appController" frontend/webapp/src/views/_Common/Study/ | grep -v useAppController` — inspect any hit; expected: none.

**Step 3:** Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false` — passes.

**Step 4: Smoke test** (this subtree is the riskiest — real-time chat):
On `http://localhost:8200`, signed in: open study-group bar, open StudyHall drawer, send a chat message, open a thread, open DMs, tag a user with `@`. Verify typing indicators and unread badges still update (socket events → `window` listeners → appController functions — untouched, but confirm end-to-end).

**Step 5: Commit**

```bash
git commit -am "refactor(context): Study/chat subtree reads appController from context (collapses 14-hop drilling)"
```

---

## Task 5: Migrate the app shell (Header, Sidebar, PopUp, Drawer, Commentary, Group, BottomNav, UserAvatar)

**Files:**
- Modify: `frontend/webapp/src/views/_Common/Header.js` — `Header`, `MobileHeader`, `Notifications`, `NotificationList`.
- Modify: `frontend/webapp/src/views/_Common/Sidebar.js` — `Sidebar`, `UserInfo`, `SearchBox` (all three also read `appController.activeLeafCursorController.states.activeAudio` — unchanged semantics, the hook returns the same object).
- Modify: `frontend/webapp/src/views/_Common/PopUp.js` — `PopUp`, `Loading`, `LegalNotice`, `Person`, `Place`, `ObjectPopUp`, `Relationships`, `ReferenceList`, `History`. ⚠️ `History` (~:790) passes `pageController={appController.activeLeafCursorController}` into `Comments` — KEEP that expression, sourcing appController from the hook (hazard H1; Comments keeps accepting the prop until Phase 3 and beyond).
- Modify: `frontend/webapp/src/views/_Common/Drawer.js` — `MobileDrawer`, `DrawerContent`, `CommentaryDrawer`, `ProgressDrawer`, `HistoryDrawer`, `Person`, `Place`, `PFilter`, `LeaderBoard`, `MobileChatThread`.
- Modify: `frontend/webapp/src/views/_Common/Commentary.js` — `Commentary`. ⚠️ Same H1 note at ~:431.
- Modify: `frontend/webapp/src/views/_Common/Group.js`, `frontend/webapp/src/views/_Common/BottomNav.js` (`BottomMenu`), `frontend/webapp/src/components/UserAvatar.js`.

**Step 1:** Apply recipe R1 per file. Header/Sidebar receive `{...props}` from Main — after removing the `appController` destructure they'll simply ignore the still-passed prop until Task 12.

**Step 2: Grep gate:** `grep -rn "appController={" frontend/webapp/src/views/_Common/ frontend/webapp/src/components/ | grep -v Study/ | grep -v Main.js` → expected empty.

**Step 3:** Full test suite passes. Smoke: header notifications bell, sidebar audio pause, open a Person/Place popup, open the mobile drawer, open Commentary popup and its comment section.

**Step 4: Commit**

```bash
git commit -am "refactor(context): app shell (Header/Sidebar/PopUp/Drawer/Commentary) uses useAppController"
```

---

## Task 6: Migrate the User family

**Files (all under `frontend/webapp/src/views/User/`):**
`User.js` (+`ProfileItems`), `MobileUser.js` (+`MobileProgressBox`), `EditProfile.js`, `Profile.js` (+`ProfilePicture`), `PictureWithOverlay.js`, `ImageChanger.js`, `Preferences.js` (+`Publications`), `ProgressBox.js` (+`ProgressDetails` pass-through, `ProgressPanel`), `History.js` (`StudyHistory`, `HistoryList`), `Invitation.js`, `Password.js` (`ChangePassword`), `SignIn.js`, `SignUp.js`, `SocialSignIn.js`, `Victory.js`.

**Step 1:** Recipe R1 per file, leaves first (SocialSignIn/SignUp → SignIn → ProfileItems → User).

**Step 2: Grep gate:** `grep -rn "appController={" frontend/webapp/src/views/User/` → empty.

**Step 3:** Tests pass. Smoke: sign out, sign back in (Google social button renders), edit profile, change preferences (dark mode toggles the `body.dark` class — that's read in Main, unaffected), view progress box.

**Step 4: Commit**

```bash
git commit -am "refactor(context): User family (sign-in, profile, preferences, progress) uses useAppController"
```

---

## Task 7: Migrate Home/Feed/Welcome — includes the H2 data-embedding fix

**Files:**
- Modify: `frontend/webapp/src/views/Home/Home.js` — `Home`, `HomeSignIn`, `GroupBrowser`, `GroupCallToAction`; pass-through `GroupCard` (~:350).
- Modify: `frontend/webapp/src/views/Home/Feed.js` — `HomeFeed`, `HomeFeedItem`, `Comments`, `Comment`, `MyComment`; pass-throughs `HomeFeedBanner` (~:193), `ContentInFeed` (~:436).
- Modify: `frontend/webapp/src/views/Home/ReadingPlan.js`, `frontend/webapp/src/views/Welcome/Welcome.js`, `frontend/webapp/src/views/Welcome/pages/unshaken.js`, `frontend/webapp/src/views/Welcome/pages/showcase.js` (all pass-through or light consumers).

**Step 1 — the H2 fix (Feed.js):** At ~:637 the feed builds comment data objects with appController embedded (`{ ...comment, appController }`), unwrapped at ~:757 inside `Comment`. Restructure:
- Stop embedding: remove `appController` from the comment-object construction.
- `Comment` calls `useAppController()` and passes it explicitly where needed: `ParseMessage(text, appController)` (`models/Utils.js:655` keeps its argument signature — non-React code stays argument-passing).
- Grep gate for this fix: `grep -n "appController" frontend/webapp/src/views/Home/Feed.js` — every remaining hit is either the hook call or an explicit function argument, never object embedding.

**Step 2:** Recipe R1 for the rest.

**Step 3: Grep gate:** `grep -rn "appController={" frontend/webapp/src/views/Home/ frontend/webapp/src/views/Welcome/` → empty.

**Step 4:** Tests pass. Smoke: home feed loads, comment on a feed item, link previews render inside comments (exercises ParseMessage → LinkPreview chain), Welcome page community feed renders.

**Step 5: Commit**

```bash
git commit -am "refactor(context): Home/Feed/Welcome use useAppController; stop embedding controller in comment data"
```

---

## Task 8: Migrate remaining route components (incl. the only prop-fixture test)

**Files:**
- Modify: `frontend/webapp/src/views/Read/Read.js` (`ReadScripture` — pass-through + useMemo dep at ~:637), `frontend/webapp/src/views/Read/components/ChapterContent.js` (`ChapterContent`, `ScriptureBlock` — both `memo()`; note in a code comment that context makes the memo on this prop moot, same as before).
- Test: `frontend/webapp/src/views/Read/__tests__/Read.test.js` — currently renders `<ReadScripture appController={fixture} />` (~:41-47).
- Modify: `frontend/webapp/src/views/Search/Search.js` (pass-through), `frontend/webapp/src/views/Search/VerseResult.js`, `frontend/webapp/src/views/Analysis/Analysis.js` (pass-through), `frontend/webapp/src/views/Analysis/Names/Names.js` (`Container` pass-through), `frontend/webapp/src/views/People/People.js` (+`PeopleFilters`), `frontend/webapp/src/views/Places/Places.js` (+`PlaceFilters`), `frontend/webapp/src/views/Objects/Objects.js`, `frontend/webapp/src/views/Objects/ObjectsFilter.js`, `frontend/webapp/src/views/History/History.js`, `frontend/webapp/src/views/History/Witnesses.js` (pass-through → `SingleWitness`), `frontend/webapp/src/views/Audit/Audit.js`.

**Step 1: Break the test first.** Apply R1 to `Read.js`/`ChapterContent.js`, then run:
`cd frontend/webapp && CI=true npx react-scripts test --watchAll=false -t "Read"`
Expected: FAIL — `useAppController() called outside <AppControllerProvider>` (proves the hook guard works in practice).

**Step 2: Fix the test** — wrap the render:

```jsx
import { AppControllerProvider } from "src/contexts/AppControllerContext";
// ...
render(
  <AppControllerProvider appController={appController}>
    <ReadScripture /* other props unchanged, appController prop removed */ />
  </AppControllerProvider>
);
```

Run again → PASS.

**Step 3:** Recipe R1 across the remaining files.

**Step 4: Grep gate:** `grep -rn "appController={" frontend/webapp/src/views/ | grep -vE "Page/|Theater/|Map/|_Common/Main.js"` → empty.

**Step 5:** Full suite passes. Smoke: /search results open verses, People/Places/Objects filters work, Read view renders chapters and verse popups open.

**Step 6: Commit**

```bash
git commit -am "refactor(context): remaining route views use useAppController; Read test wraps provider"
```

---

## Task 9: Migrate the three controller-owner routes' appController intake (Page, Theater, Map)

These keep *embedding* appController into their own controllers (Phase 2/3 handles those) — this task only changes where they get it from.

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js` — `Page({ appController })` → hook; the embed `pageController.appController = appController` (~:216) and `setActiveLeafCursorController` registration (~:264-268) stay byte-identical. Also `MessageFooter`-style unwraps stay.
- Modify: `frontend/webapp/src/views/Page/PersonPlace.js` — `NarrationToolTip` receives `appController={pageController?.appController}` (~:103-106) → hook (keep the `global.preLoad` fallback at ~:175 exactly as is).
- Modify: `frontend/webapp/src/views/Theater/Theater.js` — `TheaterWrapper({ appController })` → hook; embed at ~:191-192 stays.
- Modify: `frontend/webapp/src/views/Map/Map.js` — `MapContainer({ appController })` → hook; embed at ~:129 stays.
- Modify: `frontend/webapp/src/views/Map/InfowindowContent.js` if it takes the prop directly (grep first).

**Step 1:** Apply R1 to the four intake points. Grep each file afterward: every remaining `appController` reference must be either the hook call or a carrier-object member (`pageController.appController`, `theaterController.appController`, `mapController.appController`).

**Step 2:** Tests pass. Smoke: open a scripture page (narration, comments, tooltips), open Theater and play a section, open the Map and click a place.

**Step 3: Commit**

```bash
git commit -am "refactor(context): Page/Theater/Map take appController from context (carriers unchanged)"
```

---

## Task 10: (buffer) sweep stragglers

**Step 1:** Run: `grep -rn "appController={" frontend/webapp/src --include="*.js" | grep -v __tests__ | grep -v "Main.js"`
Any hit outside `views/Page/` internals is a missed migration — apply R1 to it now. (Page-internal `pageController={...}` props are Phase 3; `appController={...}` should be gone everywhere.)

**Step 2:** Run: `grep -rn "props.appController" frontend/webapp/src --include="*.js"` → expected empty.

**Step 3:** Full test suite passes. Commit if anything changed:

```bash
git commit -am "refactor(context): sweep remaining appController prop sites"
```

---

## Task 11: Verify the memo + bridge behaviors still hold (no code — verification gate)

**Step 1:** Confirm the sendbird bridge: sign in on localhost:8200, open chat, send a message. The bridge (`appController.sendbird`, mutated by MessengerProvider) must still deliver — the context value is the same mutable object, so `.sendbird` mutations remain visible everywhere.

**Step 2:** Confirm dark-mode preference toggle re-renders the whole shell (dispatch → new object → new context value → all consumers re-render — same as before).

**Step 3:** Confirm `setStageClass` (runtime-injected function, `Page.js:598` → consumed by `Connection.js`/`PageLink.js`): navigate between page sections; stage transitions still animate.

No commit — checkpoint only. If any check fails, STOP and debug before Task 12 (superpowers:systematic-debugging).

---

## Task 12: Remove the drilling from Main.js (the payoff commit)

**Files:**
- Modify: `frontend/webapp/src/views/_Common/Main.js`

**Step 1:** Delete `appController={appController}` from: `Header` (~:142), `Sidebar` (~:146), `PopUp` (~:169), the route render `<x.component appController={appController} />` (~:174 — becomes `<x.component />`), `BottomMenu` (~:179). KEEP: the `useReducer` (~:35), `global._appDispatch` (~:40), all window listeners, and `MessengerProvider appController={appController}` (~:139), and the `AppControllerProvider` wrapper.

**Step 2: Final grep gate**

Run: `grep -rn "appController={" frontend/webapp/src --include="*.js" | grep -v __tests__`
Expected: exactly 2 hits — `AppControllerProvider appController=` and `MessengerProvider appController=` in Main.js.

**Step 3:** Full suite passes. Full smoke pass: home, sign-in, page view + comments, chat, theater, map, search, popups, mobile drawer (narrow viewport).

**Step 4: Commit**

```bash
git add frontend/webapp/src/views/_Common/Main.js
git commit -m "refactor(context): remove appController prop drilling from Main — Phase 1 complete"
```

---

# PHASE 2 — Theater & Map contexts (Tasks 13–16)

## Task 13: Fix the latent `theaterController.controls.pause()` TypeError

**Files:**
- Modify: `frontend/webapp/src/views/Theater/Theater.js` (~:1005)

**Step 1:** Locate `theaterController.controls.pause()` (grep `controls.pause`). The `controls` object is spread into the controller (`...controls` in the literal at ~:191-216) and never attached as a `controls` key — this line throws if the 100%-completion "victory" branch runs. Change to `theaterController.pause()`.

**Step 2:** Tests pass (no unit coverage exists for this 1,920-line file; verified by smoke in Task 14).

**Step 3: Commit**

```bash
git commit -am "fix(theater): victory branch called pause via nonexistent .controls key"
```

## Task 14: TheaterContext

**Files:**
- Create: `frontend/webapp/src/contexts/TheaterContext.js`
- Test: `frontend/webapp/src/contexts/__tests__/TheaterContext.test.js`
- Modify: `frontend/webapp/src/views/Theater/Theater.js` (only file that uses theaterController)

**Step 1: Failing test** (same shape as Task 1's — provider round-trip + no-provider throw; fixture `{ isPlaying: false, pause: jest.fn() }`; probe reads `useTheater().isPlaying`). Run, expect module-not-found FAIL.

**Step 2: Implementation** — identical pattern to `AppControllerContext.js`: `TheaterContext`, `useTheater()` (throws outside provider), `TheaterProvider({ theaterController, children })`. Run test → PASS.

**Step 3: Provider at the owner.** In `TheaterWrapper`, wrap the returned JSX:

```jsx
<TheaterProvider theaterController={theaterController}>
  {/* existing TheaterMainPanel / TheaterSidePanel JSX */}
</TheaterProvider>
```

**Step 4: Re-provide at the augmentation point (hazard H3).** `TheaterMainPanel` builds a richer controller (`theaterController = { ...theaterController, subCursorIndex, setSubCursorIndex, hasNextContent, canAutoPlayState, setCanAutoPlay }` at ~:393-399). Keep that expression, and wrap MainPanel's JSX in a second `<TheaterProvider theaterController={theaterController}>` — descendants under MainPanel see the augmented object (nearest provider), SidePanel descendants see the base one. This reproduces today's split exactly.

**Step 5: Migrate consumers.** Apply the R1 pattern with `useTheater()` for every `theaterController` prop in the file: TheatherMusicPlayer, TheaterQueueIndicator, TheaterStaticContent (pass-through — delete prop), TheaterQueueIntro, TheaterSectionIntro, TheaterCrossRoads(+Button), TheaterQueueOutro (pass-through), TheaterIdle, TheaterContent, TheaterMobileControls, TheaterMeta (pass-through), TheaterMetaContent, TheaterNarration, TheaterControls, TheaterProgressBar, PlaybackSettings, TheaterSidePanel (pass-through), TheaterPeoplePlacePanel, TheaterImagePanel, TheaterCommentFeed, CommentFeed (pass-through), Comment. Also `theaterController.setIsOutroActive = setIsOutroActive` (~:249) stays (mutation on the shared object, visible through context).

**Step 6: Grep gate:** `grep -n "theaterController={" frontend/webapp/src/views/Theater/Theater.js` → empty. `grep -c "useTheater()" ...Theater.js` → roughly the consumer count above.

**Step 7:** Suite passes. Smoke on localhost:8200: open Theater; play, pause, next, speed cycle, volume/music sliders, side-panel people/places/images/comments, queue intro/outro, mobile controls (narrow viewport). Let a section run to completion to hit the outro path.

**Step 8: Commit**

```bash
git commit -am "refactor(context): Theater uses TheaterContext with re-provided augmentation at MainPanel"
```

## Task 15: Hoist MapPanel's grafted state to MapContainer

**Files:**
- Modify: `frontend/webapp/src/views/Map/Map.js`, `frontend/webapp/src/views/Map/MapPanel.js`

**Step 1:** `MapPanel` currently mutates the parent's object: `mapController.selectedStory = selectedStory; mapController.setSelectedStory = setSelectedStory` (~MapPanel.js:232-233). Move the `useState` for `selectedStory` up into `MapContainer` (`Map.js`), add both to the `mapController` literal (~:121-146), and delete the graft lines in MapPanel (it now reads them off the controller like everything else).

**Step 2:** Suite passes. Smoke: open Map, select a story, step through moves — story panel and map markers stay in sync.

**Step 3: Commit**

```bash
git commit -am "refactor(map): hoist selectedStory state from MapPanel graft into MapContainer controller"
```

## Task 16: MapContext

**Files:**
- Create: `frontend/webapp/src/contexts/MapContext.js`
- Test: `frontend/webapp/src/contexts/__tests__/MapContext.test.js`
- Modify: `frontend/webapp/src/views/Map/Map.js`, `MapPanel.js`, `MapContents.js`, `MapTypes.js`, `InfowindowContent.js`

**Step 1: Failing test → implementation** — same pattern: `MapContext`, `useMap()` (throws outside provider — name it `useMapController` if `useMap` collides with react-leaflet's hook; **grep `from "react-leaflet"` imports in Map files first** and prefer `useMapController` if there's any overlap), `MapProvider({ mapController, children })`.

**Step 2: Provider in MapContainer** wrapping the returned JSX (`Map.js` ~:148-165).

**Step 3: Migrate consumers:** `MapTypes` (~MapTypes.js:35), `MapPanel` (~MapPanel.js:44) + `MapStoryPanel` (~:461), `MapToolTip` — ⚠️ receives `{...mapController}` spread (`Map.js:160`): change its signature to take no controller props and call the hook, delete the spread — and `MapContents` (~MapContents.js:28), `InfowindowContent`. The non-React Leaflet drawing closures inside MapContents keep referencing the `mapController` variable the component obtained from the hook — same object, no change to those functions.

**Step 4: Grep gate:** `grep -rn "mapController={\|{\.\.\.mapController}" frontend/webapp/src/views/Map/` → empty.

**Step 5:** Suite passes. Smoke: map renders tiles/markers, tooltips on hover, click marker → infowindow, story panel, zoom/center persistence, map-type switcher, URL updates on navigation.

**Step 6: Commit**

```bash
git commit -am "refactor(context): Map family uses MapContext; MapToolTip spread removed"
```

---

# PHASE 3 — Page family contexts (Tasks 17–20)

**Read hazard H1 before starting.** `activeLeafCursorController` (the live pageController registered onto appController) is consumed out-of-tree by `Commentary.js` and `PopUp.js`, which pass it INTO `Comments` as a `pageController` prop. The design: **prop overrides context** in `Comments`. The cursor registration itself is out of scope — it stays.

## Task 17: PageControllerContext + prop-override in Comments

**Files:**
- Create: `frontend/webapp/src/contexts/PageControllerContext.js`
- Test: `frontend/webapp/src/contexts/__tests__/PageControllerContext.test.js`
- Modify: `frontend/webapp/src/views/Page/Page.js`, `frontend/webapp/src/views/_Common/Study/Study.js`

**Step 1: Failing test.** Three cases: (a) provider round-trip; (b) hook returns `null` without a provider (NOT throw — out-of-tree consumers are legitimate here); (c) override precedence:

```jsx
function Probe({ pageController: pageControllerProp }) {
  const pageController = usePageController(pageControllerProp);
  return <div>{pageController?.id ?? "none"}</div>;
}

test("prop overrides context", () => {
  render(
    <PageControllerProvider pageController={{ id: "ctx" }}>
      <Probe pageController={{ id: "prop" }} />
    </PageControllerProvider>
  );
  expect(screen.getByText("prop")).toBeInTheDocument();
});
```

**Step 2: Implementation:**

```jsx
import React, { createContext, useContext } from "react";

export const PageControllerContext = createContext(null);

// Returns the override when given one (out-of-tree callers pass
// appController.activeLeafCursorController — see blast-radius audit H1),
// otherwise the nearest provider's controller, otherwise null.
export const usePageController = (override = null) => {
  const fromContext = useContext(PageControllerContext);
  return override || fromContext;
};

export function PageControllerProvider({ pageController, children }) {
  return (
    <PageControllerContext.Provider value={pageController}>
      {children}
    </PageControllerContext.Provider>
  );
}
```

Run tests → PASS.

**Step 3: Provider in Page.js** wrapping the rendered sections (`<PageControllerProvider pageController={pageController}>` around the JSX containing MuteButton/Floaters/Section list). The embeds and cursor registration stay untouched.

**Step 4: Comments override (Study.js):**

```jsx
function Comments({ pageController: pageControllerProp, /* other props */ }) {
  const pageController = usePageController(pageControllerProp);
  // ...body unchanged
```

`Commentary.js:431` and `PopUp.js:790` keep passing `pageController={appController.activeLeafCursorController}` — now flowing through the override path. In-tree callers (Section, Narration panels, TextContent) will stop passing it in Task 18.

**Step 5:** Suite passes. Smoke: page comments work from BOTH entries — in-page section comments AND the Commentary-popup comment panel (the out-of-tree path).

**Step 6: Commit**

```bash
git commit -am "feat(context): PageControllerContext with prop-override for out-of-tree cursor consumers"
```

## Task 18: Migrate pageController prop consumers

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js` (stop passing to MuteButton ~:618, Floaters ~:619, Section ~:627-632)
- Modify: `frontend/webapp/src/views/Page/Section.js` (pure pass-through — delete the prop entirely, ~:16-113)
- Modify: `frontend/webapp/src/views/Page/MuteButton.js`, `Floaters.js`, `Connection.js` (+`ConnectionLink`), `PageLink.js`, `PersonPlace.js` (`PersonLink`/`PlaceLink`)
- Modify: `frontend/webapp/src/views/Page/Narration.js` — `Narration({ rowData, pageController, addHighlight })` → `usePageController()`; the embed `narrationController.pageController = pageController` (~:287, :355) stays, now sourced from the hook.
- Modify: `frontend/webapp/src/views/Page/TextContent.js` — passes `pageController` to `Comments` (~:355): delete that attribute (Comments falls through to context — same object).
- Modify: Narration panels passing `pageController` into `Comments` (ImagePanel/FacsimilePanel ~:403-404 render trees): delete the attribute.

**Step 1:** Apply the R1 pattern with `usePageController()` (no argument) to each direct consumer; delete pass-only plumbing.

**Step 2: Grep gate:** `grep -rn "pageController={" frontend/webapp/src/views/Page/ frontend/webapp/src/views/_Common/` → only the two out-of-tree cursor sites (Commentary.js, PopUp.js) remain.

**Step 3:** Suite passes. Smoke: page loads, audio mute, floaters, connection links animate stage class, person/place tooltips, narration open/close rows, in-section comments, comment counts on bubbles.

**Step 4: Commit**

```bash
git commit -am "refactor(context): Page subtree reads pageController from context; Section pass-through removed"
```

## Task 19: NarrationContext (per-instance nested provider)

**Files:**
- Create: `frontend/webapp/src/contexts/NarrationContext.js` (+ test — same 2-case shape as Task 1; `useNarration()` throws outside provider, since narration consumers are never out-of-tree)
- Modify: `frontend/webapp/src/views/Page/Narration.js`, `frontend/webapp/src/views/Page/TextContent.js` (`TextItemCounters`), `frontend/webapp/src/views/Page/Annotations.js`

**Step 1:** Failing test → implementation → pass (pattern identical to Task 1).

**Step 2:** Provider wraps each Narration instance's JSX (`Narration.js` ~:400-415) — one provider **per mounted row**; nearest-provider-wins gives each panel its own row's controller, exactly like the prop did.

**Step 3:** Migrate consumers: ImagePanel, FacsimilePanel, PeoplePlacePanel, NotesPanel, ScripturePanel, TextContent (drops the `narrationController` prop; the embed `textContentController.narrationController` stays, sourced from `useNarration()`), TextItemCounters, and Annotations' bubbles (currently reach `textContentController.narrationController` — may keep doing so, or take `useNarration()`; prefer the hook only where the component already took narrationController as a prop — YAGNI).
⚠️ TextContent quote recursion (~:161-167): recursive `<TextContent>` renders inside the SAME Narration provider — correct, quotes belong to the same row. No change needed; just verify.

**Step 4: Grep gate:** `grep -rn "narrationController={" frontend/webapp/src/views/Page/` → empty.

**Step 5:** Suite passes. Smoke: open narration rows, image panel, facsimile panel, notes, scripture panel, a quote block inside text content.

**Step 6: Commit**

```bash
git commit -am "refactor(context): per-row NarrationContext replaces narrationController drilling"
```

## Task 20: TextContentContext + final verification

**Files:**
- Create: `frontend/webapp/src/contexts/TextContentContext.js` (+ test, same pattern; `useTextContent()` throws outside provider)
- Modify: `frontend/webapp/src/views/Page/TextContent.js`, `frontend/webapp/src/views/Page/Annotations.js`

**Step 1:** Failing test → implementation → pass.

**Step 2:** Provider wraps each TextContent instance's JSX — including the recursive quote instances, whose nested provider **shadows** the parent's (each quote block's bubbles see their own controller — matches today's prop behavior; verify a page with quoted text renders bubbles on both levels).

**Step 3:** Migrate: `CommentaryBubbles`, `ImageBubbles` (Annotations.js ~:57, :236 — drop the `textContentController` prop, use the hook; their internal reaches through `.narrationController.pageController` keep working on the same object). Delete the dead `FaxBubbleContainer` export (Annotations.js ~:10) and the unused `Comments` import (Narration.js ~:4) while here.

**Step 4: Final grep gates (the whole migration):**

```bash
grep -rn "Controller={" frontend/webapp/src --include="*.js" | grep -v __tests__
# Expected: ONLY Main.js (AppControllerProvider/MessengerProvider) and the two
# H1 cursor sites in Commentary.js / PopUp.js passing pageController.
```

**Step 5:** Full suite passes. Full smoke pass (all Phase 1/2/3 smoke lists). Update the blast-radius audit's Status line to "migrated — see docs/plans/2026-07-13-controller-context-migration.md".

**Step 6: Commit**

```bash
git commit -am "refactor(context): TextContentContext completes the controller→context migration"
```

---

## Out of scope (deliberately — do not "improve" these during execution)

- `global._appDispatch`, `global.preLoad`, `models/routeHistory.js` singleton — the reducer's non-React plumbing stays.
- `appController.sendbird` bridge and its 78 call sites — separate migration track (useMessenger adoption).
- `activeLeafCursorController` registration/cycle — kept, served via prop-override.
- Argument-passing in `models/Utils.js`, `models/MessengerController.js`, `models/BoMOnlineAPI.js` — non-React code keeps explicit arguments.
- Embedded cross-references inside controller objects (`pageController.appController`, `narrationController.pageController`, `textContentController.*`) — reducers dispatch outside React and need them.
- Misnamed reducers (`setUser`/`setStudyGroup`), context-value memoization/splitting for render performance — real improvements, separate efforts.
