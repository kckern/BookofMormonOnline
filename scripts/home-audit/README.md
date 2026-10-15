# Home/Discover audit harness

Playwright scripts used for the Home/Discover tile audit
(`docs/audits/2026-10-15-home-discover-tile-audit.md`). They drive the human
(CRA/Vite) app, not the SSR front door.

- **Target:** `BASE` defaults to `http://localhost:8201`, the Vite dev server.
  - `localhost:8200` won't work: headless Chromium is classified as a bot and gets SSR, and the Next front door doesn't proxy `/graphql`.
  - Every script overrides the UA to desktop Chrome or iOS Safari.
- **Playwright:** imported from `frontend/next/node_modules`. From a git worktree without that directory, set `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs`.
- **Service workers are blocked** in every context. Requests made through the app's SW are otherwise invisible to `page.route()`.

| Script | What it does |
|---|---|
| `tileharness.mjs` | Library. Exports `open(vp, group, opts)` → `{ page, home(), tile(cls), shot(name, locator), scrollUntil(cls), resample(), cls(), errors, close() }`. `vp` is `desktop` (1440), `phone` (390) or `tablet` (820). |
| `pagepass.mjs` | Page-level pass. Covers cold/warm CLS timeline, infinite scroll, Back, tab round-trip, resample, and forced batch failure. Writes `pagepass.json` and screenshots to `OUT`. |
| `verify-back.mjs` | One Back from a tile link restores Home with the same tiles and scroll. `VP=phone`, plus `SEL` (CSS selector of links to pick from). |
| `verify-feedend.mjs` | Blocks infinite batches. Expects the end-of-feed terminus, then checks that Retry loads. |
| `rubric-blind.md` | The rubric alone (scoring, criteria, protocol), with no results. This is the only audit document a blind reviewer gets. |

Run: `node scripts/home-audit/verify-back.mjs` (env: `BASE`, `VP`, `SEL`, `OUT`).

## Privacy (public repo)

- Captures go to `docs/audits/home-discover-audit-2026-10-15/`, which is **gitignored**. Never commit screenshots.
- `.tile-community` and message rows are masked in every capture. Don't screenshot the Community tab or user pages.
- Never quote real user names, messages or note text in findings.
