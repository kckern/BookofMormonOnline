# E2E tests

End-to-end tests for the deep-link init pipeline. Powered by Playwright (Chromium).

## Quick start

```bash
# Unconditional tests only (no fixture IDs required)
npm run e2e:unconditional

# All tests (requires fixture IDs — see "Populating fixtures" below)
npm run e2e:all
```

## File layout

```
e2e/
├── README.md                          this file
├── playwright.config.js               Playwright config (baseURL, timeouts, etc.)
├── fixtures.js                        Shared test fixtures + getFixture() loader
├── fixtures.json                      Committed seed file with REPLACE_ME sentinels
├── local-fixtures.example.json        Template for the local override
├── local-fixtures.json                YOUR LOCAL OVERRIDE — gitignored
├── deeplink-notfound.spec.js          Unconditional — runs without fixture IDs
├── deeplink-commentary.spec.js        Requires commentaryId, nestedCommentaryId
├── deeplink-image.spec.js             Requires imageId
├── deeplink-renavigation.spec.js      Requires commentaryId, secondCommentaryId
├── scrollto-callback.spec.js          Requires commentaryId
└── smoke.spec.js                      Requires commentaryId
```

## Populating fixtures

The env-gated specs need real backend IDs to run against. The easiest way to populate them:

1. Start the dev frontend (`systemctl --user status bom-dev` to confirm running).
2. Open `http://localhost:8200` in a browser.
3. Browse to any scripture page and click a commentary bubble in the margin. Note the URL the popup pushes (e.g., `/commentary/12345`) — that's your `commentaryId`.
4. Repeat to find a commentary inside a nested quotation block — that's your `nestedCommentaryId`. (If you can't find one, leave `nestedCommentaryId` equal to `commentaryId`; the "nested ordering" test will then skip.)
5. Find a second, distinct commentary ID — that's `secondCommentaryId`.
6. Click an art panel — the URL becomes `/art/<imageId>`. That's `imageId`.
7. Copy `local-fixtures.example.json` to `local-fixtures.json` and fill in the four IDs.

```bash
cp e2e/local-fixtures.example.json e2e/local-fixtures.json
# Edit e2e/local-fixtures.json with the IDs from steps 3-6.
```

`local-fixtures.json` is gitignored — your IDs stay local.

Values can be strings or numbers; the `example.json` uses string-typed IDs for consistency with what the URL-bar shows.

## Env-var override

Each fixture key also has an environment-variable equivalent (highest precedence, useful for one-off CI runs without committing to a fixture choice):

| Fixture key | Env var |
| --- | --- |
| `commentaryId` | `E2E_COMMENTARY_ID` |
| `nestedCommentaryId` | `E2E_NESTED_COMMENTARY_ID` |
| `secondCommentaryId` | `E2E_SECOND_COMMENTARY_ID` |
| `imageId` | `E2E_IMAGE_ID` |

Resolution order: **env > local-fixtures.json (if present) > fixtures.json**. Env vars override file values.

> Note on `secondCommentaryId`: previously this fixture used `E2E_COMMENTARY_ID_B` (back when each spec read env vars directly). The auto-mapping in `getFixture` derives `E2E_SECOND_COMMENTARY_ID` from the JSON key name. If you have `E2E_COMMENTARY_ID_B` exported in your shell from before, it's silently ignored now — rename to `E2E_SECOND_COMMENTARY_ID` or just populate `local-fixtures.json`.

## Running in CI

This repo does NOT currently have a GitHub Actions workflow. When you add one:

- For PRs against any branch, run `npm run e2e:unconditional`. This works without secrets — it hits hardcoded invalid IDs (`/commentary/999999999`, `/image/999999999`) and asserts the not-found UI renders.
- For the dev branch, add the four fixture keys as repo secrets (env-var names from the table above) and run `npm run e2e:all`. The workflow also needs to either start a dev frontend (which requires Infisical access for backend secrets) or hit a staging URL via `E2E_BASE_URL`.

## Observability

The specs assert on the `window.__deepLinkEvents` instrumentation channel rather than timing. Tests use `waitForEvent(page, "initPageItem:callback")` etc. to await pipeline checkpoints. See `frontend/webapp/src/utils/deepLinkInstrument.js` for the recorder.

The instrumentation is a no-op unless `window.__deepLinkInstrument === true`. The `instrumentedPage` fixture in `fixtures.js` sets that flag automatically; specs using the default `page` fixture won't capture events.

## Updating fixtures when they go stale

Commentary and image IDs are stable identifiers in the BoM DB — they don't typically change. If a test starts failing because an ID was removed (e.g., a publication was withdrawn), pick a new one and update `local-fixtures.json` (and update `local-fixtures.example.json` if you want the team's default to change).
