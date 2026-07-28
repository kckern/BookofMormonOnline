# Fax Shadow Local QA Handoff

Date: 2026-07-27

This handoff summarizes the current local fax-shadow remediation state so a
different agent can pick up without redoing the same work.

## Goal

Build a local db/server/api with `faxindex` data and validate the data QA E2E
locally.

## Current state

The local shadow API is working, and the QA pipeline runs end-to-end against a
local shadow SQLite DB.

Working artifacts:

- Local shadow DB baseline: `backend/.shadow/fax-shadow.sqlite`
- Structurally clean 1879l candidate: `/tmp/fax-1879l-structural-clean-qa.sqlite`
- Updated 1879l working copy with whitespace repairs applied:
  `/tmp/fax-1879l-whitespace-applied.sqlite`
- Local shadow API server script:
  `backend/scripts/fax-shadow-server.mts`

Running server used for verification:

- `127.0.0.1:8355` served `/tmp/fax-1879l-structural-clean-qa.sqlite`
- `127.0.0.1:8356` served `/tmp/fax-1879l-whitespace-applied.sqlite`

## What has been verified

1. The local shadow API starts successfully with Node 22.
2. The exhaustive 1879l candidate QA runs to completion against the local
   shadow API.
3. The structural-clean 1879l candidate is structurally green:
   - 0 structural findings in the current structurally clean candidate audit
4. The 1879l exhaustive render/content QA is still not green:
   - 111 candidates
   - 9 pass
   - 31 warning
   - 71 failure
5. A conservative whitespace repair sweep was generated and applied to a
   working copy, but it did not change the QA summary.

## Important findings

The residual 1879l failures are not one bug:

- OCR-unreliable / scan-degraded items:
  - `2-nephi-5.20`, `2-nephi-5.27`, `2-nephi-5.28`, `2-nephi-5.32`
  - `2-nephi-18.4`
  - `mosiah-1.18`, `mosiah-2.2`
  - `alma-32.13`
  - `helaman-7.27`
  - `3-nephi-18.11` through `3-nephi-18.18`
- Likely geometry / ownership issues:
  - `mosiah-1.16`, `mosiah-2.6`, `mosiah-2.7`
  - `mosiah-11.1` through `mosiah-11.6`
  - `mosiah-14.9`, `mosiah-14.11`
  - `mosiah-23.26` through `mosiah-23.28`
  - `alma-18.7` through `alma-18.16`
  - `alma-52.12` through `alma-52.16`
  - `helaman-11.17`, `helaman-11.22`
  - `mormon-9.34`, `mormon-9.35`
- Cross-page / mixed cases:
  - `3-nephi-18.10`, `3-nephi-18.19`
  - `alma-27.10`
  - `alma-56.44`
  - `alma-61.18`

## Hueristics and code changes already made

### 1. Focused boundary recovery tightened

File:

- `backend/scripts/lib/fax-render-content-qa.ts`

Change:

- `assessFocusedBoundaryRecovery()` now requires the full crop’s boundary gap
  to be small as well as the focused strip token match.

Reason:

- This was meant to reduce acceptance of cases where the crop had snapped
  across a word boundary and the focused strip found an isolated token anyway.

Result:

- The residual 1879l QA summary did not change, which is expected for a guardrail
  hardening change.

### 2. Whitespace sweep made more conservative

File:

- `backend/scripts/fax-whitespace-sweep.mts`

Change:

- Added an explicit maximum movement cap to the acceptance rule.
- Vertical and horizontal adjustments now reject large jumps that could cross a
  word boundary or overshoot the true page/column edge.

Result:

- The script still generates repairs.
- Focused 1879l run produced 86 candidate repairs.
- The repairs applied cleanly to `/tmp/fax-1879l-whitespace-applied.sqlite`.
- The post-repair QA summary was unchanged.

Important detail:

- Only 4 of the 86 repaired verses overlapped the 111 QA candidates, so the
  no-op QA result was largely expected.

## Commands that matter

Start local shadow API:

```bash
/opt/homebrew/bin/node backend/node_modules/tsx/dist/cli.mjs \
  backend/scripts/fax-shadow-server.mts \
  --shadow /tmp/fax-1879l-whitespace-applied.sqlite \
  --port 8356 \
  --host 127.0.0.1
```

Run exhaustive 1879l QA:

```bash
/opt/homebrew/bin/node backend/node_modules/tsx/dist/cli.mjs \
  backend/scripts/fax-shadow-candidate-qa.mts \
  --shadow /tmp/fax-1879l-whitespace-applied.sqlite \
  --base http://127.0.0.1:8356 \
  --versions 1879l \
  --audit /Users/kckern/Documents/GitHub/BookofMormonOnline/docs/audits/fax-geometry/shadow/full-structural-normalized/audit.json \
  --candidate-report /Users/kckern/Documents/GitHub/BookofMormonOnline/docs/audits/fax-geometry/shadow/residual-reference-adjusted-1879l-perturb2-safe-round371/qa-report.json \
  --out /tmp/fax-1879l-postwhitespace-qa \
  --no-resume
```

Apply generated whitespace SQL to a working copy:

```bash
cp /tmp/fax-1879l-structural-clean-qa.sqlite /tmp/fax-1879l-whitespace-applied.sqlite
sed '/^START TRANSACTION;$/d;/^COMMIT;$/d' /tmp/whitespace-1879l.sql | \
  sqlite3 /tmp/fax-1879l-whitespace-applied.sqlite
```

## Files changed this round

- `backend/scripts/lib/fax-render-content-qa.ts`
- `backend/scripts/fax-whitespace-sweep.mts`
- `docs/audits/fax-geometry/shadow/1879l-remediation-queue.md`
- `docs/handoffs/2026-07-27-fax-shadow-local-qa-handoff.md`

## Likely next step

Stop broad sweep-based edits and target the residual failing families directly.
The best candidates for a first targeted pass are:

- `mosiah-1`
- `mosiah-2`
- `alma-52`
- `mormon-9`

These are the cleanest examples of repeatable ownership / leak / internal-span
problems. Several of the other failures are likely scan-degraded and should be
kept separate from geometry remediation.

## Cautions

- Do not claim the QA is green. It is not.
- Do not keep generating page-level whitespace sweeps and expect the current
  residual 1879l failures to move.
- The current post-repair QA baseline is still:
  - 111 candidates
  - 9 pass
  - 31 warning
  - 71 failure

