# Community E2E suite

End-to-end tests for the **user + community/messaging** features, driving the real
React UI against the green-field backend. Unlike the read-only deep-link suite in
`e2e/`, these tests **write to bom_prd** (create groups, post comments) through the
live UI, then delete everything they create.

```bash
ALLOW_PROD_WRITES=1 npm run e2e:community
```

## Safety model

- **Preflight gate** (`global-setup.js` → `lib/preflight.js`): refuses to run unless
  `ALLOW_PROD_WRITES=1`, `backend/.env` points at `bom_prd`, and `SANDBOX=0`. With
  the backend read-only (SANDBOX=1) the UI writes would silently not persist, so the
  guard fails loudly instead.
- **Marker + leave-no-trace:** every artifact the tests create carries `__e2e__` in
  its name/text. `lib/cleanup.js` only ever deletes marker-tagged rows (with a hard
  cap), per-test teardown removes what each test made, and `global-teardown.js`
  sweeps any residue and asserts nothing marked remains.
- **Login:** the **regression** account (`tests/.env.test`), via the real SignIn
  form — no token injection. RW DB creds for teardown come from `backend/.env`.

## Host requirement

Runs against **`http://localhost:8200`**, not `10.0.0.10:8200`. The community UI is
gated by `featureFlags.isMessengerEnabled()`, which matches the hostname's first
label (`localhost` / `bom` / `staging`) — the bare IP renders "Coming Soon".
`localhost:8200` is the same dev server and bypasses the Cloudflare edge cache.

## Coverage

| Spec | Flow | Status |
|---|---|---|
| `login.spec.js` | SignIn form → /user study-progress + stat widgets | ✅ |
| `study-groups.spec.js` | enable study mode · create solo group · switch groups | ✅ |
| `study-hall.spec.js` | post a comment (write → DB) | ✅ |
| `study-hall.spec.js` | start a thread (reply) | ⛔ `fixme` |
| `study-page-comment.spec.js` | comment from a scripture page | ⛔ `fixme` |

The two `fixme` flows are blocked by a green-field display bug (the study-hall
message list doesn't render posted messages) — see
`docs/bugs/2026-06-11-greenfield-study-hall.md`, which also documents three shim
bugs this suite found and fixed (createMetaData, the currentUser race, and the
socket auth token).

## Files

```
e2e/community/
├── playwright.config.js      separate config (serial, write guards, sweep)
├── global-setup.js           preflight + sweep stale markers
├── global-teardown.js        final sweep + leave-no-trace assertion
├── lib/
│   ├── config.js             creds (tests/.env.test) + DB (backend/.env) + MARKER
│   ├── preflight.js          ALLOW_PROD_WRITES + SANDBOX=0 + bom_prd guards
│   ├── auth.js               signIn via the real form
│   ├── study.js              study-group UI helpers (+ createGroupViaApi for setup)
│   └── cleanup.js            guarded, marker-gated teardown
└── *.spec.js
```
