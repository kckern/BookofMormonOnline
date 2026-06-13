# Study-Group Adversarial QA Loop — FINAL SUMMARY (2026-06-13)

Standalone executive summary of the 6-iteration adversarial test-and-fix loop over the
study-group features (`frontend/webapp/src/views/Home/`, `.../views/_Common/Study/`, plus the
green-field backend messaging layer). Full per-iteration detail:
`docs/audits/2026-06-13-study-group-adversarial-loop.md` (Iteration 7 = final verification).

## What the loop accomplished

A tester agent (logged in as Staff, driving the real UI on `http://localhost:8200`, DB-verifying
writes) and fixer agents alternated for 6 iterations, then a 7th holistic verification pass. The
loop **converged** on the study messaging core with zero outstanding P0/P1 on that core.

### Bugs found and fixed, by severity

**P0 — critical (study layer non-functional):**
- **Messenger socket timeout → silent degrade to read-only "Guest".** Root cause: the Next.js
  front door (`:8200`) can't proxy a WebSocket upgrade via `NextResponse.rewrite`. Fixed (dev) by
  pointing the socket at the WS-capable backend origin (`REACT_APP_API_URL=http://localhost:5006`
  in gitignored `.env.development.local`). Composers/comments/likes now render; header shows
  "Staff". *(Prod must route `/messenger` to a WS-capable origin — standing infra note.)*
- **Study Hall post did nothing** (same socket root cause) — now sends, renders, persists.
- **New solo group didn't hydrate `myRole=operator`** → operator never saw the Admin tab without a
  reload. Fixed by re-fetching the full channel (with members) after create. Empty hall now shows a
  real "Start the conversation" empty-state.

**P1 — high:**
- **DM channel duplication / orphaning** (`isDistinct` not deduping; render-body `createChannel`
  with a forced random `md5()` URL created 3–4 channels per DM-open; prod had 188 DM channels for
  141 distinct pairs, one pair with 28). Fixed: create moved to a one-shot `useEffect`, random URL
  dropped, client distinct-lookup corrected, and **authoritative server-side dedup**
  (`findDistinctChannel` + `isDistinct` through resolver/schema). New DM-opens now create 0 orphans;
  reopen lands in the same channel. Covered by 4 new backend unit tests.
- **React correctness warnings** (real bugs): `key`-as-prop, `class` (not `className`) dropping
  scripture-link styling, `threadHash` leaked to the DOM, missing/duplicate keys, app-wide
  setState-in-render + unmounted-component leaks (Page/Contents/Read/Feed/Home/ReadingPlan/
  StudyHall/StudyGroupSideBar/StudyChat/DirectMessages/InviteLink). All targeted classes now fire
  **zero** times on `/`, `/study`, and Page routes.
- **Thread re-render flash** — posting a reply into an expanded thread tore down + rebuilt all
  replies (and double-appended via optimistic+echo). Fixed to append-only with messageId dedup.

**P2 — medium:**
- **Future-dated timestamps ("in 7 hours").** Root cause: mysql2 default `timezone:'local'` read
  UTC DATETIME as local (+7h). Fixed by pinning the pool to `timezone:'Z'` in `db.ts`. Now reads
  "a few seconds ago". *(Prod DB driver must carry the same.)*
- **Stored-XSS hygiene** — user message HTML was persisted verbatim (not currently executable, only
  saved by html-react-parser's incidental neutralization). Added **DOMPurify** strip-all render-time
  sanitization + server-side empty-reject; the only HTML rendered is the trusted URL/scripture/
  @mention anchors the app generates.
- **No message length cap** — added `MAX_MESSAGE_LENGTH=2000` (client maxLength + send-time slice +
  server truncate).
- **StudyHall / panel-switch unmount-setState leaks** — guarded the hall/DM async loaders + the
  `setOpening`/roster timers; `Placeholder` timer cleanup.
- **Admin "Edit profile" description not prefilled** — root cause: GraphQL `ChannelDTO` returned no
  top-level `description` though the schema/client selected it. Fixed in the DTO builders.
- **Study-scoped accessibility** — group selector / ⋮ menu / × close were keyboard-inaccessible
  icon `<div>`s; made real buttons with aria-labels + keydown; `aria-allowed-attr` fixed; composer
  aria-labels; alt text + study-scoped color-contrast to AA (scoped axe `.study`/`.groupList` → 0
  violations); re-enabled pinch-zoom (`meta-viewport`).

**P3 — low (polish):**
- Progress tab enabled with **real** per-member completion data (fake-data Highchart removed);
  dead Notebook tab removed; washed-out study title darkened; group dropdown widened/legible;
  reactions now show **faces** (avatars), not a name list; leave-group now has a confirm dialog;
  feed lazy-loads 20 + IntersectionObserver reveal (was 217 at once); TagList keyboard nav
  (arrow/Enter/Tab/Esc + type-to-filter), mid-text mention insert fix, missing key + debug-log
  removal; removed dead unreachable code in `ActionBubble`.

### By-design / not-bugs confirmed
- Reply "mis-threading" was a harness artifact (threading is composer-driven and correct).
- "Overlay on every comment add" was NOT reproducible — top-level adds patch in place.
- Double-submit is safe (DB has exactly 1 row); socket auto-recovers offline→online.

## Verification verdict (Iteration 7)

**GREEN.** All iter-1–6 fixes hold on a fresh Staff session, DB-verified where applicable. Full
happy path works and persists; zero targeted React warnings on core routes; **0 ESLint errors on
all 24 loop-modified source files**; the loop's DM-dedup backend suite is **25/25**. The loop
introduced **no** lint or test regressions, and **no secrets are committed**
(`.env.development.local` and `e2e/adversarial/env.sh` are gitignored; env.sh hardcodes nothing).

Pre-existing issues clearly distinguished (NOT loop-caused):
- 9 backend test failures in `readstate.test.ts` (8) + `presence.test.ts` (1 flaky) — fail on the
  clean `HEAD` tree too; test-fixture/env issues, unrelated to the loop's files.
- 4 frontend ESLint errors in untouched `__tests__/` files (testing-library/import-order rules).

## OPEN items needing product-owner decisions (none block the study work)

1. **bom_app DB password rotation** — backend was left RW (`:5006`, SANDBOX=0) for manual testing
   per MEMORY; rotate/secure before treating as steady-state, and confirm prod creds hygiene.
2. **~47 pre-existing duplicate prod DM channels cleanup** — real user data (one pair has 28
   channels, mostly 0-message). The dedup fix stops NEW orphans; cleaning the existing ones is a
   data-migration decision. Suggested safe approach: per member-pair keep the channel with the most
   messages, merge messages from empties, delete only 0-message duplicates, in a transaction with a
   dry-run report first. NOT done in the loop.
3. **App-wide accessibility pass** — study-scoped a11y is fixed, but the app-wide backlog remains:
   ×688 missing `image-alt`, global `color-contrast`, `nested-interactive` (reactstrap accordion),
   and the SweetAlert invite/leave modals lacking `role="dialog"`/`aria-modal`/focus-trap (Escape
   unreliable). Library-level / cross-app — a dedicated effort.
4. **Notification bell — wire or remove.** `Header.js` bell is a stub (hardcoded "no notifications",
   no data binding, no mark-as-read) on an unlabelled non-focusable `<div>`. Decide its fate.
5. **SweetAlert modal focus-trap** — part of (3); applies to the study invite + leave-confirm
   modals as well as app-wide.

## Recommendation

**Proceed to review and commit the study-group work.** The change set is coherent, well-tested, and
free of regressions and committed secrets. Suggested commit hygiene:
- Commit the frontend + backend source changes and the `dompurify` dependency together as the
  study-group fix set.
- Keep `.env.development.local` and `e2e/adversarial/env.sh` gitignored (they are).
- Track the prod infra notes (WS-capable `/messenger` route; prod DB driver `timezone:'Z'`) on the
  deploy ticket — the dev config fixes do not auto-apply to prod.
- File the 5 open product-owner items above as separate issues; none should hold this commit.
