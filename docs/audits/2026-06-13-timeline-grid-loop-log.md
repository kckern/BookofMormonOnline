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
