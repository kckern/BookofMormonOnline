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
