# MessengerProvider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move messenger-controller lifecycle out of appController dispatch functions into a React context provider that owns create/disconnect, with a compatibility bridge on `appController.sendbird`.

**Architecture:** New `MessengerContext.js` exports a provider mounted in `Main.js` whose single effect (keyed on `[social user_id, token]`) creates the controller on sign-in, disconnects on identity change/sign-out/unmount, runs the `getStudyGroups` bootstrap, and assigns `appController.sendbird` so all 84 existing references work unchanged. The three sign-in dispatch functions become pure state updates.

**Tech Stack:** React 17 (createContext/useEffect), jest + @testing-library/react (already in repo), CRA dev server on the `bom-dev` systemd unit.

**Spec:** `docs/specs/2026-06-11-messenger-context-provider.md`

**Working notes for the implementer:**
- Frontend tests run from `frontend/webapp/`: `CI=true npx react-scripts test --testPathPattern '<pattern>'`
- jsdom host is `localhost`, so `isMessengerEnabled()` is true in tests.
- `Main.js` renders a `<Loader/>` while `appController.states.user.user && appController.sendbird === null` — the bridge must therefore be reset to the **no-op stub**, never `null`.
- `appController` is recreated by spread on every dispatch; mutating `appController.sendbird` carries through (this is how the dispatch functions do it today).

---

### Task 1: MessengerContext module — guest behavior

**Files:**
- Create: `frontend/webapp/src/contexts/MessengerContext.js`
- Test: `frontend/webapp/src/contexts/__tests__/MessengerContext.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// frontend/webapp/src/contexts/__tests__/MessengerContext.test.js
import React from "react";
import { render, act } from "@testing-library/react";
import {
  MessengerProvider,
  useMessenger,
  noopController,
} from "../MessengerContext";

// Minimal appController fixture. social: null = guest.
const makeApp = ({ social = null, token = "tok-1", user = null } = {}) => ({
  states: { user: { user, token, social } },
  functions: { setStudyGroups: jest.fn() },
});

// Probe component records what useMessenger() returns each render.
let lastCtx;
function Probe() {
  lastCtx = useMessenger();
  return null;
}

const renderProvider = (app, factory) =>
  render(
    <MessengerProvider appController={app} createController={factory}>
      <Probe />
    </MessengerProvider>,
  );

beforeEach(() => {
  lastCtx = undefined;
});

test("guest mount: no controller created, context is null, bridge untouched", () => {
  const app = makeApp();
  const factory = jest.fn();
  renderProvider(app, factory);
  expect(factory).not.toHaveBeenCalled();
  expect(lastCtx).toBeNull();
  expect(app.sendbird).toBeUndefined();
});

test("noopController has the legacy stub surface", async () => {
  const stub = noopController("u1");
  expect(stub.disconnect).toBeInstanceOf(Function);
  expect(stub.updateUserState).toBeInstanceOf(Function);
  expect(stub.getCurrentUser()).toMatchObject({ userId: "u1" });
  expect(stub.sb.currentUser.userId).toBe("u1");
  await expect(stub.getStudyGroups()).resolves.toEqual([]);
  await expect(stub.loadUnreadDMs()).resolves.toEqual({});
  await expect(stub.loadThreadedMessages()).resolves.toEqual({
    parentMessage: null,
    threadedMessages: [],
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern 'contexts/__tests__/MessengerContext'`
Expected: FAIL — `Cannot find module '../MessengerContext'`

- [ ] **Step 3: Write the module (guest path + stub only)**

```js
// frontend/webapp/src/contexts/MessengerContext.js
/**
 * MessengerContext — owns the messenger controller lifecycle.
 *
 * Step 1 of the appController→context migration (see
 * docs/specs/2026-06-11-messenger-context-provider.md). The provider creates
 * the controller when sign-in state appears, disconnects it on identity
 * change / sign-out / unmount, and assigns appController.sendbird as a
 * compatibility bridge for existing consumers (including non-React code).
 * New code should consume useMessenger() instead of the bridge.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import MessengerController from "src/models/MessengerController";
import { isMessengerEnabled } from "src/models/featureFlags";

const USE_MESSENGER = isMessengerEnabled();

// Signed-out / messaging-disabled stub. Same surface the legacy
// createChatController no-op branch exposed; also the bridge's value after
// teardown — Main.js shows a Loader when sendbird === null, so the bridge
// must never be null.
export const noopController = (userId) => ({
  connect: () => Promise.resolve({ user_id: userId, nickname: "User" }),
  getStudyGroups: () => Promise.resolve([]),
  loadGroupMessages: () => Promise.resolve([]),
  loadPreviousMessages: () => Promise.resolve([]),
  sendUserMessage: () => Promise.reject(new Error("Messaging unavailable")),
  updateUserState: () => {},
  updateUserSummary: () => {},
  fireStudyGroupAction: () => {},
  fetchRoomFromGroup: () => Promise.resolve(null),
  loadUnreadDMs: () => Promise.resolve({}),
  disconnect: () => {},
  updatePagePosition: () => {},
  updateTypingLocation: () => {},
  loadThreadedMessages: () =>
    Promise.resolve({ parentMessage: null, threadedMessages: [] }),
  getCurrentUser: () => ({ userId, metaData: {} }),
  sb: { currentUser: { userId, metaData: {} } },
  _currentUser: { user_id: userId, nickname: "User" },
});

const defaultFactory = (userId, accessToken, appController) =>
  new MessengerController(
    process.env.REACT_APP_API_URL || window.location.origin,
    userId,
    accessToken,
    appController,
  );

export const MessengerContext = createContext(null);
export const useMessenger = () => useContext(MessengerContext);

export function MessengerProvider({ appController, children, createController = defaultFactory }) {
  const [controller, setController] = useState(null);

  // The appController object is recreated by spread on every dispatch; keep a
  // ref so the effect always bridges onto the live object without re-running.
  const appRef = useRef(appController);
  appRef.current = appController;

  const socialUserId = appController.states.user.social?.user_id || null;
  const token = appController.states.user.token || null;

  // Lifecycle effect added in Task 2.

  return (
    <MessengerContext.Provider value={controller}>
      {children}
    </MessengerContext.Provider>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern 'contexts/__tests__/MessengerContext'`
Expected: PASS (2 tests). Note: importing MessengerController pulls socket.io-client into jsdom — it is import-safe (no connection until constructed). If the import itself throws in jsdom, mock it at the top of the test file: `jest.mock("src/models/MessengerController", () => jest.fn());`

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/contexts/
git commit -m "feat(messenger-context): context module skeleton + legacy no-op stub"
```

---

### Task 2: Sign-in lifecycle — create, bridge, bootstrap

**Files:**
- Modify: `frontend/webapp/src/contexts/MessengerContext.js` (the effect)
- Test: `frontend/webapp/src/contexts/__tests__/MessengerContext.test.js` (append)

- [ ] **Step 1: Write the failing tests (append to the test file)**

```js
const makeController = () => ({
  disconnect: jest.fn(),
  getStudyGroups: jest.fn().mockResolvedValue([{ url: "g1" }]),
});

test("sign-in: creates controller, bridges appController.sendbird, bootstraps groups", async () => {
  const app = makeApp({ social: { user_id: "abc123" }, user: "kc" });
  const ctrl = makeController();
  const factory = jest.fn(() => ctrl);
  renderProvider(app, factory);

  expect(factory).toHaveBeenCalledWith("abc123", "tok-1", app);
  expect(app.sendbird).toBe(ctrl);
  expect(lastCtx).toBe(ctrl);
  // bootstrap (getStudyGroups → setStudyGroups) moved here from the dispatch fns
  await act(async () => {});
  expect(ctrl.getStudyGroups).toHaveBeenCalled();
  expect(app.functions.setStudyGroups).toHaveBeenCalledWith([{ url: "g1" }]);
});

test("guest → sign-in transition creates the controller", () => {
  const app = makeApp();
  const ctrl = makeController();
  const factory = jest.fn(() => ctrl);
  const { rerender } = renderProvider(app, factory);
  expect(factory).not.toHaveBeenCalled();

  const signedIn = makeApp({ social: { user_id: "abc123" }, user: "kc" });
  rerender(
    <MessengerProvider appController={signedIn} createController={factory}>
      <Probe />
    </MessengerProvider>,
  );
  expect(factory).toHaveBeenCalledTimes(1);
  expect(signedIn.sendbird).toBe(ctrl);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern 'contexts/__tests__/MessengerContext'`
Expected: 2 new FAIL (factory never called), 2 prior PASS

- [ ] **Step 3: Implement the effect (replace the `// Lifecycle effect added in Task 2.` comment)**

```js
  useEffect(() => {
    if (!socialUserId) return undefined;
    const app = appRef.current;

    if (!USE_MESSENGER) {
      app.sendbird = noopController(socialUserId);
      return undefined;
    }

    const ctrl = createController(socialUserId, token, app);
    app.sendbird = ctrl; // compatibility bridge for the 84 legacy references
    setController(ctrl);

    // Sign-in bootstrap, moved out of socialSignIn / setPreLoadData /
    // processSignIn — they are pure state updates now.
    ctrl
      .getStudyGroups()
      .then((list) => appRef.current.functions.setStudyGroups(list));

    return () => {
      try {
        ctrl.disconnect();
      } catch (e) {
        console.warn("Messenger: controller teardown failed", e);
      }
      // Never null: Main.js shows a Loader while user is set and
      // sendbird === null.
      appRef.current.sendbird = noopController(socialUserId);
      setController(null);
    };
    // createController is intentionally omitted: a stable factory is part of
    // the provider contract (tests pass a constant; prod uses defaultFactory).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socialUserId, token]);
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern 'contexts/__tests__/MessengerContext'`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/contexts/
git commit -m "feat(messenger-context): provider owns create/bridge/bootstrap on sign-in"
```

---

### Task 3: Teardown — identity change, sign-out, unmount

**Files:**
- Test: `frontend/webapp/src/contexts/__tests__/MessengerContext.test.js` (append)
- Modify: `frontend/webapp/src/contexts/MessengerContext.js` only if a test fails

- [ ] **Step 1: Write the tests (append)**

```js
const rerenderWith = (rerender, app, factory) =>
  rerender(
    <MessengerProvider appController={app} createController={factory}>
      <Probe />
    </MessengerProvider>,
  );

test("identity change: disconnect old, create new", () => {
  const appA = makeApp({ social: { user_id: "userA" }, user: "a" });
  const ctrlA = makeController();
  const ctrlB = makeController();
  const factory = jest.fn().mockReturnValueOnce(ctrlA).mockReturnValueOnce(ctrlB);
  const { rerender } = renderProvider(appA, factory);

  const appB = makeApp({ social: { user_id: "userB" }, user: "b" });
  rerenderWith(rerender, appB, factory);

  expect(ctrlA.disconnect).toHaveBeenCalledTimes(1);
  expect(factory).toHaveBeenCalledTimes(2);
  expect(appB.sendbird).toBe(ctrlB);
});

test("sign-out: disconnect, bridge resets to no-op stub (never null), context null", () => {
  const app = makeApp({ social: { user_id: "userA" }, user: "a" });
  const ctrl = makeController();
  const factory = jest.fn(() => ctrl);
  const { rerender } = renderProvider(app, factory);

  const guest = makeApp(); // processSignOut clears social
  rerenderWith(rerender, guest, factory);

  expect(ctrl.disconnect).toHaveBeenCalledTimes(1);
  expect(lastCtx).toBeNull();
  // cleanup bridges the stub onto the appController live at cleanup time
  expect(guest.sendbird).toBeDefined();
  expect(guest.sendbird).not.toBeNull();
  expect(guest.sendbird.disconnect).toBeInstanceOf(Function);
});

test("unmount disconnects", () => {
  const app = makeApp({ social: { user_id: "userA" }, user: "a" });
  const ctrl = makeController();
  const { unmount } = renderProvider(app, jest.fn(() => ctrl));
  unmount();
  expect(ctrl.disconnect).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run tests**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern 'contexts/__tests__/MessengerContext'`
Expected: PASS (7 tests) — Task 2's cleanup already implements this. If any fail, fix the effect (cleanup must use `appRef.current`, not a stale `app`).

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/contexts/
git commit -m "test(messenger-context): teardown on identity change, sign-out, unmount"
```

---

### Task 4: Wire into Main.js; strip controller creation from dispatch functions

**Files:**
- Modify: `frontend/webapp/src/views/_Common/Main.js` (~line 166, the main `return`)
- Modify: `frontend/webapp/src/models/appController.js` (three dispatch fns + dead factory)

- [ ] **Step 1: Wrap Main's layout with the provider**

In `Main.js`, add the import:

```js
import { MessengerProvider } from "src/contexts/MessengerContext";
```

Wrap the final `return` (the one returning `<div className={"body"...}>`, ~line 166; the `apiFailure` early return stays unwrapped):

```js
  return (
    <MessengerProvider appController={appController}>
      <div className={"body"+(lang ? " "+lang: "") + (isDev ? " dev" : "") + (isDarkMode ? " dark" : "")}>
        {/* ...existing children unchanged... */}
      </div>
    </MessengerProvider>
  );
```

(Only the wrapper element is added — no other JSX changes.)

- [ ] **Step 2: Make the three dispatch functions pure state updates**

In `appController.js`:

`socialSignIn` — replace:

```js
    if (appController.states.user.social?.user_id) {
      appController.sendbird = createChatController(
        appController.states.user.social?.user_id,
        appController.states.user.token || appController.states.user.social.access_token,
        appController
      );

      appController.sendbird?.getStudyGroups()
        .then((list) => appController.functions.setStudyGroups(list));
    }
    return appController;
```

with:

```js
    // Controller creation + getStudyGroups bootstrap now live in
    // MessengerProvider (src/contexts/MessengerContext.js), reacting to the
    // user.social state set above.
    return appController;
```

`setPreLoadData` — replace:

```js
      if (appController.states.user.social?.user_id) {
        appController.sendbird = createChatController(
          appController.states.user.social?.user_id,
          appController.states.user.token || appController.states.user.social.access_token,
          appController
        );

        clickyUser({ userid: appController.states.user.user, username: appController.states.user.social?.nickname })

        appController.sendbird?.getStudyGroups()
          .then((list) => appController.functions.setStudyGroups(list));
      }
```

with:

```js
      if (appController.states.user.social?.user_id) {
        // Controller creation + bootstrap moved to MessengerProvider.
        clickyUser({ userid: appController.states.user.user, username: appController.states.user.social?.nickname })
      }
```

`processSignIn` — replace:

```js
    if (user.social?.user_id)
      appController.sendbird = createChatController(
        user.social?.user_id,
        user.token || user.social?.access_token,
        appController
      );

    appController.sendbird?.getStudyGroups()
      .then((list) => appController.functions.setStudyGroups(list));
```

with:

```js
    // Controller creation + bootstrap moved to MessengerProvider.
```

- [ ] **Step 3: Delete the dead factory**

In `appController.js`, delete the whole `createChatController` function (lines ~14–59, including the teardown comment block) and the now-unused `import MessengerController from "./MessengerController.js";` (line 3). Keep `isMessengerEnabled`/`USE_MESSENGER` — still used elsewhere (e.g. `processSignOut`, `appInit`).

- [ ] **Step 4: Verify webpack compiles and the dev app boots**

Run: `journalctl --user -u bom-dev -f` (watch one HMR cycle after saving)
Expected: `webpack compiled with 19 warnings` (the pre-existing count), no `ERROR in`.
Then: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8200/` → `200`.

- [ ] **Step 5: Run the full frontend test suite**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false`
Expected: all suites pass (messengerShapes, narrationList, featureFlags, scroll, Page, Read, MessengerContext). Pre-existing failures unrelated to this change: none known — investigate anything red.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/_Common/Main.js frontend/webapp/src/models/appController.js
git commit -m "feat(messenger-context): Main mounts MessengerProvider; dispatch fns are pure state updates"
```

---

### Task 5: Manual verification on dev (spec success criteria)

**Files:** none (verification only)

- [ ] **Step 1: Watch sockets while exercising sign-in/out**

Run: `journalctl --user -u bom-greenfield -f | grep '\[realtime\]'`

In a browser on `http://localhost:8200` (or the LAN IP):
1. Sign in → exactly one `connected:` line, no second connect without a disconnect between.
2. Open a study group, send a message → appears exactly once in the UI.
3. Sign out → a `disconnected:` line appears (this is NEW behavior; today sign-out leaks the socket).
4. Sign back in → one disconnect/connect pair max; study groups list loads (bootstrap moved to provider).

- [ ] **Step 2: HMR check**

Touch any frontend file (add/remove a blank line) and save. Expected in the realtime log: `client namespace disconnect` followed by one `connected:` — never two live sockets.

- [ ] **Step 3: Feature smoke (bridge intact)**

Study bar renders members/bots; DM panel lists DMs (StudyGroupBar passes `customTypesFilter:["DM"]`); threads expand; presence dots update. These all go through `appController.sendbird` — any crash here means the bridge broke.

- [ ] **Step 4: Update the spec status + report**

Mark `docs/specs/2026-06-11-messenger-context-provider.md` status line to `Implemented (<commit>)`, commit:

```bash
git add docs/specs/2026-06-11-messenger-context-provider.md
git commit -m "docs(specs): messenger context provider — implemented"
git push origin dev
```
