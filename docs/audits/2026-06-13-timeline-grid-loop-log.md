# Timeline grid — adversarial iteration log

Started 2026-06-13 09:08 on branch feat/timeline-grid.

## Iteration 1
**Adversarial verdict:** MATERIAL ISSUES REMAINING: yes
**Top findings → fixes applied:**
- BLOCKER: battle markers advertised clickability but were dead → made non-interactive decorative markers in red circular chips (no false affordance, fixes white-box look too).
- BLOCKER: zero keyboard/ARIA on ~143 interactive divs → clickable events now real `<button>` w/ `aria-label`, focus-visible ring; non-clickable events are plain divs.
- MAJOR: white labels overflowing onto light bg illegible → thin 4-way dark text outline.
- MAJOR/MINOR: off-white bars → wrap background now `#fff` (crisp white bars, better contrast).
- MAJOR: right-edge/bottom clipping with no scroll cue → inset edge shadows on scroller.
- MINOR: modal lacked a11y → `role=dialog`, `aria-modal`, `aria-labelledby`, Escape-to-close, focus close button on open.
- NIT: `cornerRadius` returned `undefined` → returns `{}`.

**Deferred:** mobile/responsive strategy (MAJOR #6), ~3238 DOM nodes perf (MINOR #9), "Jersualem" data typo (NIT), browser back/forward selection sync (NIT).

## Iteration 2
**Adversarial verdict:** verified all 7 pass-1 fixes landed (no regressions). MATERIAL ISSUES REMAINING: yes
**Top findings → fixes applied:**
- MAJOR: no visible time axis — rows had no meaning → added a **sticky date/era gutter** (col 2 of the sheet extracted to `dateAxis`; 35 entries 600s BC→420s AD), rendered as a sticky left column; content tiles shifted +1 col.
- MINOR: `document.title` was " | " (empty label lookups) → literal fallbacks ("Timeline | Book of Mormon Online").
- MINOR: place labels tiny brown 9px, no outline over bands → 10px, darker (#5a4a1f), white text-outline.

**Deferred (still):** mobile responsiveness + narrow-width label collisions; ~3238 DOM perf; modal focus-trap/restore (NIT); "Jersualem" data typo (NIT).
**Note:** adversarial flagged my color legend wording (maroon=Lamanites, blue=Nephites) — rendering uses the sheet's actual colors regardless.

## Iteration 3 (proactive: cleared deferred items, then review)
**Fixes applied:**
- MAJOR (mobile + right-edge clipping): added map-style **zoom controls** (CSS `zoom` on the grid, −/reset/+; clamp 0.4–2) + `touch-action: pan-x pan-y` + a `max-width:640px` media query with smaller base cells. Lets users zoom out to see the whole timeline / zoom in for detail on any device.
- NIT: modal now traps Tab within the dialog and restores focus to the opener on close.
- NIT: "Jersualem"→"Jerusalem" (and "Abinadai"→"Abinadi") via TYPO_FIX in build_tiles.py.

## Iteration 4
**Adversarial verdict (pass 3):** MATERIAL ISSUES REMAINING: yes — two pass-3 additions were broken.
**Fixes applied:**
- MAJOR: mobile media query was dead (placed before base rule, equal specificity) → replaced CSS media query with JS initial zoom (`window.innerWidth<=640 ? 0.6 : 1`).
- MAJOR: date gutter wasn't a continuous opaque column (only ~35 dated rows had a cell) → added a single sticky full-height `.tg-gutter-bg` backing (grid-row 1/-1) so column 1 masks content on every row during h-scroll; covers the Jaredite top too.
- MAJOR: Jaredite era had no scale (void above 600s BC) → synthetic accurate anchor "~3100 BC" at the top of dateAxis.
- MINOR: CSS `zoom` was fragile with sticky → zoom now drives a `--scale` custom prop scaling cells + fonts (layout-correct, sticky-safe).
- MINOR: zoom control overlapped row 1 → grid padding-top 52px.

## Iteration 5 → 6
**Adversarial pass 5 (CDP DOM measurement):** verified ALL pass-1..4 fixes hold (sticky gutter masking, --scale zoom of cells+fonts, mobile 0.6 default, row alignment, full modal a11y, no column-shift regressions). One material issue:
- MAJOR M1: browser Back/Forward didn't close the modal — app has two `createBrowserHistory()` instances, so in-app `history.push` didn't update the Router's `match.params`.
**Fix applied (iteration 6):** Timeline now uses the Router's own `useHistory()` and derives modal state from the URL (`markerSlug`), so Back/Forward sync automatically. Removed the second-history-instance import.
**Remaining after fix:** only nits (N1 gutter divider doesn't extend into the 52px top padding — purely cosmetic; N2 untestable-via-synthetic-events note).

## Iteration 7 — CONVERGED (loop stop)
**Adversarial final convergence pass (CDP):** MATERIAL ISSUES REMAINING: **no**.
- Verified Back→closes, Forward→re-opens, ×/Escape close + update URL (9/9 checks pass).
- Regression sanity: 105 button events w/ aria, 38 battle chips, sticky gutter + "~3100 BC" anchor, --scale zoom (mobile 0.6, clamps 0.4–2), deep-link modal — all hold.
- Only remaining note: the unrelated pre-existing CRA 400 dev overlay (another app query; timeline data still renders). Out of scope.

**Loop result:** stopped early at iteration 7 of 10 — adversarial agent found no material issues.
Commits: 3ae92c5, c28bdfa, 8ff8848, 74079ee, 8ebeea6 (on feat/timeline-grid).

# Loop run 2 (raised bar: fidelity / polish / perf / content)

## Iteration R2-1
**Adversarial (deeper bar) verdict:** MATERIAL ISSUES REMAINING: yes
**Findings → fixes:**
- MAJOR: visible "Zarahelma" typo on a place marker (place labels render JSON text with no GraphQL override) → added Zarahelma→Zarahemla, Remant→Remnant, "lead by"→"led by" to TYPO_FIX.
- MAJOR: static grid gated behind a full-screen `<Loader/>` on every load incl. deep-links → grid now renders immediately from static `tilesData`; only the modal waits on the API (shows an in-modal loader; loaded-but-unknown slug renders nothing).
- MINOR: 9 dead non-clickable events incl. major figures → wired "Lehi and Sariah" → `lehite-family` (override 16,6); truly label-less ones (Jared/Shiz/Sam/East/West) stay non-interactive.
- MAJOR (fidelity): dropped world-history gutter context column → documented as intentional v1 scope-cut (open-questions #10), consistent with BoM-only scope.
**Praised (no action):** band color palette matches reference exactly (13 colors); corner-radius is a cleaner reinterpretation of the glyphs; no label overlaps at default zoom; invalid-slug deep-link degrades gracefully.

## Iteration R2-2 — CONVERGED (loop run 2 stop)
**Adversarial verification pass:** MATERIAL ISSUES REMAINING: **no**.
- Verified: no Zarahelma/Remant/"lead by" in JSON or DOM (correct forms render).
- Verified: static grid renders even though the timeline API 400s in dev (3054 fills, 36 date cells, 32 places, 106 clickable events) — no full-screen loader gating; unknown slug → no modal, grid intact.
- Verified: "Lehi and Sariah" → clickable button → opens modal ("Lehi's Family", slug lehite-family).
**Loop run 2 result:** stopped early at R2-2 — no material issues. Raised-bar pass improved fidelity (typos), UX (instant grid), and content (wired dead tile).
Run-2 commits: 4b9af6b, + info-box loading style.
