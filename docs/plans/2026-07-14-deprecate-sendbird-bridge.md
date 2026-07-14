# Deprecate the `appController.sendbird` bridge → `useMessenger()` + rename

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task.

**Goal:** Retire the misnamed `appController.sendbird` compatibility bridge. React views read the messenger from `useMessenger()`; the remaining non-React / above-provider references are renamed `appController.sendbird` → `appController.messenger`. Sendbird the service was already replaced by the custom `MessengerController` — this removes the last of the vestigial naming and the prop-bridge for view code.

**Architecture:** `MessengerProvider` (already mounted in `Main.js`, inside `AppControllerProvider`) owns the `MessengerController` lifecycle. Two consumers of the messenger exist: (1) **React views** (58 call sites) — migrate to `useMessenger()`; (2) **non-React code + Main's above-provider loading gate** (`models/appController.js` reducers, `models/MessengerController.js`, `Main.js` window handlers + Loader gate) — these can't use a hook, so they keep a reference on the appController object, renamed to `appController.messenger`. To make `useMessenger()` a safe drop-in for the `appController.sendbird?.…` optional-chained calls, the context value becomes never-null (`controller ?? noopController(userId)`).

**Tech Stack:** React 17, react-app-rewired build, Jest + @testing-library/react 11.

**Companion:** the controller→context migration (`docs/plans/2026-07-13-controller-context-migration.md`) established the `useMessenger()`/`MessengerContext` this builds on. `MessengerContext.js` already exports `noopController` and `useMessenger`.

**Working conventions (every task):**
- Frontend root `frontend/webapp`. Tests: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false` (file-scoped: `--testPathPattern=…`, NOT `-t`).
- Build check: `cd frontend/webapp && npx react-app-rewired build 2>&1 | grep -E "Compiled|Failed to compile|Module not found"` — react-app-rewired (config-overrides.js provides `src` module resolution), NOT react-scripts.
- **Pre-existing red baseline** (do NOT fix): `src/models/__tests__/messengerShapes.test.js` (1) + `src/contexts/__tests__/MessengerContext.test.js` (7) fail on `dev` independent of this work. Gate every task on: ZERO NEW failures beyond these 8.
- One commit per task. Absolute imports `src/…`.

**Facts established during scoping:**
- 78 non-test `.sendbird` sites: **58 in `views/`** (React → hook), **~14 in `models/appController.js`** (reducers, non-React → rename), plus `models/MessengerController.js` (self-ref/comments) and `Main.js` (2 window handlers + the Loader gate at line 166).
- Object breakdown: 68 `appController.sendbird`, ~6 `pageController.appController.sendbird` (carrier, in views → hook), 1 `appController?.sendbird`.
- The provider today: `const [controller, setController] = useState(null)`; `value={controller}` (null when signed out). The bridge `app.sendbird` is set to `noopController` on sign-out (never null) — that asymmetry is why views use `?.`.
- Main's Loader gate (`Main.js:166`): `appController.states.user.user && appController.sendbird === null` → shows Loader while a signed-in user's messenger connects. Main is ABOVE the provider, so this must stay a bridge read (renamed), NOT a hook.
- `useMessenger()` currently has ZERO consumers.

---

## Task 1: Make `useMessenger()` never-null (noopController fallback)

**Files:**
- Modify: `frontend/webapp/src/contexts/MessengerContext.js`
- Modify: `frontend/webapp/src/contexts/__tests__/MessengerContext.test.js` (extend, don't break)

**Why:** views migrating to `useMessenger()` replace `appController.sendbird?.foo()` (bridge is noop-when-signed-out) with `messenger.foo()`. For that to be safe when signed out or mid-connect, the context value must never be null.

**Step 1 (test first):** Add a test to `MessengerContext.test.js`: render a probe calling `useMessenger()` under `<MessengerProvider appController={fixture}>` with a signed-OUT fixture (no `states.user.social.user_id`), assert the probe receives an object exposing `getStudyGroups`/`disconnect` (the noop shape), NOT null. Run `--testPathPattern="MessengerContext"` — expect the NEW test to FAIL (value is currently null), the 7 pre-existing failures unchanged.

**Step 2 (implement):** In `MessengerContext.js`, change the provider's rendered value from `value={controller}` to `value={controller || noopController(socialUserId)}`. (`socialUserId` is already computed in the provider; when fully signed out it's null → `noopController(null)` is still a valid stub.) Keep everything else — the `useState`, the effect lifecycle, the `app.sendbird` bridge assignments (those get renamed in Task 4, not here).

**Step 3:** Run `--testPathPattern="MessengerContext"` — the new test passes; confirm the 7 pre-existing failures are unchanged (they assert other things). Full suite still 2 failed suites / 8 failed tests? (The new passing test lives in the MessengerContext suite, which is already red from the 7 — so that suite stays red but with one more passing test; the COUNT of failures must not increase.) Paste the suite's pass/fail line and confirm no NEW failing test names.

**Step 4:** Build check → Compiled.

**Step 5:** Commit: `feat(messenger): useMessenger() returns noopController instead of null when disconnected`.

---

## Task 2: Migrate the Study/chat view call sites to `useMessenger()`

**Files (React views under `frontend/webapp/src/views/`):** every `.sendbird` site in the Study/chat surface — `_Common/Study/StudyChat.js`, `StudyHall.js`, `StudyGroupBar.js`, `StudyGroupAdmin.js`, `StudyGroupSelect.js`, `StudyGroupNotebook.js`, `DirectMessages.js`, `Study.js`, `Mobile/MobileStudy.js`, and any other Study file with `.sendbird`. (Grep to enumerate: `grep -rln "\.sendbird" frontend/webapp/src/views/_Common/Study/`.)

**Recipe per component that reads `.sendbird`:**
1. Add (once per file) `import { useMessenger } from "src/contexts/MessengerContext";`.
2. In each component that references `appController.sendbird` (or `pageController.appController.sendbird`), add `const messenger = useMessenger();` as a body line alongside the existing hooks (after `useAppController()`; before early returns — rules of hooks).
3. Replace `appController.sendbird` / `pageController.appController.sendbird` reads in that component with `messenger`. Drop now-redundant `?.` on the messenger itself (it's never null); KEEP optional chaining deeper in the path (e.g. `messenger.sb.currentUser?.metaData`).
4. Non-React helpers in these files that take appController as an argument and read `.sendbird` internally: pass `messenger` explicitly OR read from the appController arg — do NOT call the hook in a non-component. Prefer threading `messenger` as an argument from the calling component. Note any such helper in the report.

**Verification:** `grep -rn "\.sendbird" frontend/webapp/src/views/_Common/Study/` → empty. Full suite ZERO new failures. Build Compiled. Smoke reasoning: list any component where messenger is used before an early return to confirm hook order.

**Commit:** `refactor(messenger): Study/chat views read messenger from useMessenger()`.

---

## Task 3: Migrate the remaining view call sites to `useMessenger()`

**Files:** all non-Study `views/` files still containing `.sendbird` after Task 2 (grep to enumerate: `grep -rln "\.sendbird" frontend/webapp/src/views/ | grep -v __tests__`). Expected: notification/header surfaces, page comment loaders, and any `pageController.appController.sendbird` carrier reads in `views/Page/`.

**Recipe:** same as Task 2.

**Special: `views/_Common/Main.js` handlers.** `handleVisibilityChange` (lines ~54/56) calls `appController.sendbird?.updateUserState(...)` from a window-listener closure registered in Main (ABOVE the provider). Main CANNOT use `useMessenger()`. LEAVE these two as bridge reads — they get RENAMED in Task 4, not hook-migrated. Do NOT touch Main.js in this task.

**Verification:** `grep -rn "\.sendbird" frontend/webapp/src/views/ | grep -v __tests__` → only the two `Main.js` handler lines remain. Full suite ZERO new failures. Build Compiled.

**Commit:** `refactor(messenger): remaining views read messenger from useMessenger()`.

---

## Task 4: Rename the non-React bridge `appController.sendbird` → `appController.messenger`

Now that no view reads `.sendbird`, rename the property everywhere it still lives (the reference used by non-React reducers, MessengerController, and Main's above-provider gate/handlers).

**Files:**
- `frontend/webapp/src/contexts/MessengerContext.js` — the 3 bridge assignments (`app.sendbird = ctrl`, the two `noopController` assignments) → `app.messenger = …`. Update the comment ("compatibility bridge for the N legacy references" — the references are now the non-React holdouts). NOTE: this bridge stays null-until-connected (Main's gate depends on it); do NOT make the bridge itself noop-when-signed-out differently than today — only the CONTEXT value (Task 1) is never-null.
- `frontend/webapp/src/models/appController.js` — `sendbird: null` init (line ~155) → `messenger: null`; all reducer reads (`appController.sendbird.sb…`, `.loadNotifications()`, `.updateUserState()`, `.markNotificationRead()`, `.updateUserSummary()`, etc., ~14 sites) → `appController.messenger…`. Keep the existing `?.` guards. Update the comment at ~line 217.
- `frontend/webapp/src/models/MessengerController.js` — update the doc comment referencing `appController.sendbird` (line ~104) to `appController.messenger`. If it assigns/reads `this.appController.sendbird` anywhere, rename.
- `frontend/webapp/src/views/_Common/Main.js` — the two `handleVisibilityChange` calls (`appController.sendbird?.updateUserState`) → `appController.messenger?.…`; the Loader gate at line ~166 `appController.sendbird === null` → `appController.messenger === null`.

**Verification:**
1. `grep -rn "sendbird" frontend/webapp/src --include="*.js" | grep -v __tests__` → only expected residue: (a) `models/MessengerController.js` comments that describe history ("Replacement for SendbirdController", "match Sendbird SDK structure") — those describe the ORIGIN and may stay, but the `appController.sendbird` reference comment must be renamed; (b) nothing else. Paste output, account for every line — no live `.sendbird` property access remains.
2. `grep -rn "\.messenger" frontend/webapp/src/models/appController.js frontend/webapp/src/views/_Common/Main.js` → the renamed sites present.
3. Full suite ZERO new failures. Build Compiled.

**Commit:** `refactor(messenger): rename appController.sendbird bridge to appController.messenger`.

---

## Task 5: Update the MessengerContext test fixtures + final verification

**Files:**
- `frontend/webapp/src/contexts/__tests__/MessengerContext.test.js` — the 7 pre-existing failures are a SEPARATE pre-existing issue (a fixture missing `loadNotificationUnreadCount`); do NOT try to fix them as part of this task UNLESS they now fail differently because of the rename. Verify the rename didn't change WHICH tests fail. If any test referenced `app.sendbird`, update it to `app.messenger` to match.
- `frontend/webapp/src/models/__tests__/messengerShapes.test.js` — check for `.sendbird` references; rename if present (without altering the pre-existing `profileUrl` assertion failure).

**Final grep gates (paste all):**
1. `grep -rn "\.sendbird" frontend/webapp/src --include="*.js"` (INCLUDING tests) → only historical comments in MessengerController.js, zero property access.
2. `grep -rn "useMessenger()" frontend/webapp/src --include="*.js" | wc -l` → the count of migrated view consumers (should be substantial, was 0 before).
3. `grep -rn "appController.messenger\|app.messenger\|appController?.messenger" frontend/webapp/src --include="*.js" | grep -v __tests__` → the non-React holdouts + provider bridge, all accounted for.

**Full verification:** whole suite (confirm 2 failed suites / 8 failed tests baseline, or fewer if a `.sendbird` test rename made one pass); full `react-app-rewired build` Compiled.

**Commit:** `test(messenger): update fixtures for the messenger rename; finalize sendbird deprecation`.

---

## Out of scope (do not change)
- The `MessengerController` class internals, its socket/window-event wiring, `window.__messengerSocket`.
- Historical/descriptive comments naming the original Sendbird service ("Replacement for SendbirdController", "match Sendbird SDK structure") — these document lineage, not live coupling.
- The pre-existing 8 red tests' root causes (missing fixture methods) — a separate fix.
- The `global._appDispatch` / reducer ownership model — untouched.
