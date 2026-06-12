# MessengerProvider: context-owned messenger lifecycle (appController migration, step 1)

**Date:** 2026-06-11
**Status:** Implemented (6229e2a1..f28d9a9f) — plus review-driven additions: bootstrap cancellation guard, access_token fallback + test, `messengerBridgeChanged` dispatch so Main's Loader gate re-evaluates after post-commit bridge mutation, processSignOut's redundant disconnect removed.
**Scope decision:** Lifecycle + bridge only — zero consumer migration in this step.

## Why

This is the first baby step of the planned `appController`-prop → context-provider
migration, scoped to the messenger (`appController.sendbird`) because controller
lifetime is its highest-risk surface, proven by today's bugs:

- Shadow websockets: all three sign-in dispatch functions (`socialSignIn`,
  `setPreLoadData`, `processSignIn`) replace `appController.sendbird` without
  disposing the previous controller; HMR module re-evaluation leaks past even
  that. Three concurrent sockets per user were observed → every inbound message
  rendered N times. Patched defensively (`window.__messengerSocket` singleton +
  teardown in `createChatController`), but the architecture still permits it.
- `processSignOut` clears `user.social` and never disconnects — the socket
  stays connected as the signed-out user.
- Controller creation is a side effect inside reducer dispatch functions.

React's lifecycle ownership (effect + cleanup) makes these states unrepresentable
instead of defended against.

## What

### New: `src/contexts/MessengerContext.js`

- `MessengerContext` (React 17 `createContext(null)`)
- `MessengerProvider({ appController, children })`
  - Holds the live controller in component state; `null` for guests.
  - One `useEffect` keyed on `[appController.states.user.social?.user_id,
    appController.states.user.token]`:
    - `user_id` present → create controller (factory moved here from
      `appController.js`), set state, assign the **bridge**
      (`appController.sendbird = controller`), then run the sign-in bootstrap
      that previously chained in the dispatch functions:
      `controller.getStudyGroups().then(list => appController.functions.setStudyGroups(list))`.
    - Cleanup (identity change, sign-out, unmount): `controller.disconnect()`,
      reset `appController.sendbird` to the no-op stub.
- `useMessenger()` hook returning the context value — the seam future
  consumer migrations adopt; intentionally unused by app code in this step.
- The no-op stub controller (currently the `else` branch of
  `createChatController`) moves here and is also the bridge's signed-out value.

### Changed: `src/models/appController.js`

- `socialSignIn`, `setPreLoadData`, `processSignIn`: delete the
  `createChatController` calls and chained `getStudyGroups` bootstraps —
  they become pure state updates. The provider reacts to the state they set.
- `createChatController` and the `MessengerController` import move out
  (to the context module).

### Changed: `src/views/_Common/Main.js`

- Wrap the layout: `<MessengerProvider appController={appController}>…</MessengerProvider>`,
  immediately inside the existing `useReducer` scope.

## Bridge contract (compatibility)

`appController.sendbird` remains the access path for all 84 existing references
across 20 files, including non-React callers (appController functions,
MessengerController's own callbacks). Consumers already optional-chain
(`appController.sendbird?.…`). The render-tick gap between sign-in state landing
and the effect creating the controller is equivalent to today's async `connect()`
window. `window.__messengerSocket` stays as defense-in-depth (it also covers
HMR re-evaluation of the context module itself).

## Out of scope

- Migrating any consumer to `useMessenger()` (future steps).
- Any other `appController` surface (states, functions, dispatch).
- Removing the `window.__messengerSocket` guard.

## Testing

- Jest (`src/contexts/__tests__/MessengerContext.test.js`), controller factory
  injected/mocked:
  - creates controller when sign-in state appears; assigns bridge
  - disconnects + recreates on `user_id` change
  - disconnects + resets bridge on sign-out (social → null) and on unmount
  - guest mount creates nothing
- Manual on dev (`localhost:8200`): two-tab message send appears exactly once;
  sign-out drops the socket in `bom-greenfield` logs (`[realtime] disconnected`);
  HMR edit produces disconnect-before-connect pairs.

## Success criteria

- All existing messenger features work unchanged (study groups, DMs, threads,
  presence, calls UI).
- `[realtime]` logs never show overlapping connects for one user without a
  disconnect between.
- Sign-out produces a disconnect.
- The three dispatch functions contain no controller construction.
