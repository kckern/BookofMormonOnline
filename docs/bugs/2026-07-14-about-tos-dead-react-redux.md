# Dead react-redux imports in About.js / Tos.js

**Date:** 2026-07-14
**Status:** Open — flagged during the controller state migration (docs/plans/2026-07-15-controller-state-migration.md, Phase 4).
**Severity:** Latent — only bites if these views are rendered.

## Symptom
`frontend/webapp/src/views/About/About.js` and `frontend/webapp/src/views/About/Tos.js` both `import { useSelector, useDispatch } from "react-redux";`. But the app configures **no Redux store and no `<Provider>`** anywhere (grep: zero `createStore`/`configureStore`/`<Provider>` in `src`). `useSelector`/`useDispatch` throw "could not find react-redux context value" when called outside a `<Provider>`.

## Root cause
The `redux`/`react-redux`/`redux-persist`/`redux-thunk` packages are in package.json (legacy), but the app never wired up a store. App state lives in per-view controllers (immutable useReducer + context) and the appController context — not Redux. About/Tos's react-redux usage is vestigial.

## Impact
If About or Tos actually call `useSelector`/`useDispatch` on render, they throw. Verify whether these views currently render without error (they may guard the calls, or the calls may be dead code paths). Either way the imports are misleading.

## Recommended fix (needs owner decision — out of scope for the migration)
- Remove the `react-redux` imports + usages from About.js/Tos.js (replace with the appController context / props they actually need), OR
- If Redux is genuinely wanted, wire up a store + `<Provider>` — but the migration deliberately chose NOT to (per-instance controllers don't fit a global store; see the migration plan's "Why NOT Redux" decision record).
- Once removed, consider dropping the unused redux packages from package.json.

## References
- Migration plan: `docs/plans/2026-07-15-controller-state-migration.md` (Why-NOT-Redux decision record)
- Blast-radius audit: `docs/audits/2026-07-15-controller-state-migration-blast-radius.md`
