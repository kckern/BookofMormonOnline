# Filter-panel row spacing: People vs Places vs Matters

**Date:** 2026-07-28
**Scope:** `.ppFilters` switch rows across the three views that render `FilterPanel`.
**Trigger:** Matters filter rows looked more cramped than People/Places.

## Method

- Confirmed all three views render the same shared component
  (`src/views/_Common/FilterPanel/FilterPanel.jsx`) — identical `<li class="item">`
  markup: `<BootstrapSwitchButton/>` + the option's `label` node.
- Grepped every stylesheet for item/row rules:
  `grep -rnE "\.ppColumns|li\.item|\.lihead|\.lifoot|li span img" People/*.css Places/*.css Matters/*.css`

## Findings

1. **No per-view spacing rules exist.** `People.css`, `Places.css`, and the Matters
   CSS contain *zero* `.item` / `.ppColumns` / `li` rules. 100% of row layout is owned
   by the shared `FilterPanel.css`. Markup + base CSS are identical across the three.

2. **The sole difference was the row icon.** `FilterPanel.css`:
   ```css
   .ppFilters li span img { height: 1.5em; width: 1.5em; margin-right: 1ex; margin-bottom: .5ex; }
   ```
   People and Places attach an `<img>` (color dot or type glyph) to *every* option
   label, so each row is ~1.5em tall. Matters attached **no** icon, so its rows
   collapsed to text height. The "missing gap" was the absence of icons, not a
   Matters stylesheet defect.

3. `--pp-row-gap` (added earlier this session to `.ppColumns li.item`) applies an
   equal explicit gap to all three, but the row-*height* delta only closes when
   Matters items also carry an icon.

## Resolution

Add icons to the Matters `era_culture` and `form_group` option labels (color dots /
repurposed glyphs), reusing the shared `.ppFilters li span img` sizing. This makes
those rows height-match People/Places by construction — same rule, same icon, no new
per-view CSS. (Prominence and the detail-column form rows remain icon-less by design;
they are numeric / secondary and were not in scope.)

## No action needed

- No shared-CSS change required for parity beyond the icons.
- No duplicate/override spacing rules to clean up — there were none.
