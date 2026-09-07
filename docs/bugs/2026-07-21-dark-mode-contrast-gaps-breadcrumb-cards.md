# Dark-mode contrast gaps: breadcrumb trail, dropdown, card hover

**Date:** 2026-07-21
**Status:** Found, not fixed. Out of scope for the Witnesses UX-fix plan (`docs/plans/2026-07-18-witnesses-view-ux-fixes.md`) that surfaced them — these predate that branch and touch shared/older CSS, not code the plan introduced.
**Scope:** `frontend/webapp/src/views/History/Witnesses.css`, `.../darkmode/_history.scss`. Discovered during that plan's Task 17 verification sweep, which built a headless-Chromium reconstruction of the real CSS to check every color the plan touched — these are colors it *didn't* touch, left over from before it started.

---

## Summary

Two severe, two minor contrast failures in dark mode, all in code older than 2026-07-18:

| Selector | Origin | Dark-mode contrast | Severity |
|---|---|---|---|
| `.breadcrumb-current` (the current witness's name in the breadcrumb trail) | 2026-05-13 | **1.21:1** | Severe — effectively invisible at rest |
| `.breadcrumb-option` (every dropdown entry except the hovered/current one) | 2026-05-13 | **1.14:1** | Severe — 17 of 19 witness names in the dropdown are effectively invisible |
| `.breadcrumb-link` (breadcrumb trail links, resting state) | 2026-05-13 | 2.33:1 | Minor — visible but fails AA (4.5:1) |
| `.witness-sources-loading` / `.witness-sources-empty` | 2026-05-13 | 3.89:1 | Minor — visible but fails AA |

Plus one interaction-state bug, not a contrast number:

- **`.historycard:hover` produces zero visible change in dark mode.** The dark-mode override for the card's resting state (`html[data-theme="dark"] .single-witnesses .witness-sources .historycard`, added in the 2026-07-13 darkmode overhaul) has higher CSS specificity than the light-only `.historycard:hover` rule — both selectors tie on class count, and the `html[data-theme="dark"]` type selector breaks the tie. Confirmed empirically in headless Chromium: hovering a source card in dark theme shows an identical border-color and background to the resting state. Sighted dark-mode users get no hover feedback on cards at all.

## Why these weren't caught before

The 2026-07-13 darkmode-overhaul work covered `.historycard`'s resting state, the dropdown's container, and the hover/current *states* of dropdown options — but not the base/resting text color of options, nor the breadcrumb trail's non-hover link color, nor the loading/empty placeholder text, nor the card's `:hover` cascade interaction with the new dark override. jsdom-based tests (this codebase's only automated coverage) don't compute real cascade specificity or contrast ratios, so none of this was visible to the test suite — it took an actual browser rendering the real stylesheet to surface it.

## Recommended fix

Each is a small, independent CSS addition to `_history.scss`, following the file's existing token pattern (`--text-primary`/`--text-secondary`/`--text-muted`/`--surface-N`):

```scss
html[data-theme="dark"] {
  .single-witnesses .witness-breadcrumbs .breadcrumb-current { color: var(--text-primary); }
  .single-witnesses .witness-breadcrumbs .breadcrumb-link { color: var(--text-secondary); }
  .single-witnesses .witness-breadcrumbs .breadcrumb-option { color: var(--text-secondary); }
  .single-witnesses .witness-sources-loading,
  .single-witnesses .witness-sources-empty { color: var(--text-muted); }
}
```

The `.historycard:hover` specificity conflict needs a structural fix, not just a value: either raise the light-mode hover rule's specificity to match (e.g. qualify it the same way the dark override is qualified), or move the dark-mode hover state into its own explicit `html[data-theme="dark"] .historycard:hover { ... }` rule so it's declared instead of relying on the resting-state override's precedence to fall through correctly. The second option is more robust — it doesn't depend on which rule happens to win a specificity tiebreak.

## Verification method

All contrast numbers above were computed via the WCAG relative-luminance formula against the actual dark-theme token values in `_tokens.scss` (not estimated), and the `.historycard:hover` finding was confirmed by loading the real `Witnesses.css`/`_history.scss` output in headless Chromium and reading computed styles before/after a simulated hover — not derived from reading the CSS source alone.
