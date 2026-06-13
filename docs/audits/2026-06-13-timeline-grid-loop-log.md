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
