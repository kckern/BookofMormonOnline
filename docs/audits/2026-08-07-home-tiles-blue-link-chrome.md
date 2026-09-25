# Home sampler tiles — stray blue link text & chrome

**Date:** 2026-08-07
**Scope:** `frontend/webapp/src/views/Home/` (CRA sampler tiles)
**Symptom:** Blue text and blue chrome (focus/tap outlines) on many home tiles.

## Root cause (systemic)

The sampler stylesheet never establishes a **base link color**, and there is no
global `a { color }` anywhere in the webapp (`grep` across all `*.css` finds only
scoped rules). `.samplerTileInner a` sets only `text-decoration: none`
(`Sampler.css:140`) — never `color`.

Consequently every `<Link>`/`<a>` rendered inside a tile inherits the **browser
default**: `#0000EE` blue text, `#551A8B` purple when `:visited`, plus the UA
focus ring and (on touch) the default `-webkit-tap-highlight-color`. A tile only
looks correct where a *more specific* rule happens to set `color`:

- `.tileHeading a { color: inherit }` (`Sampler.css:155`) — heading links OK
- `.scripture_link { color:#323b4daa }` — ref pills OK
- `.contentsOutlineSections a { color:#9a9a9a }` — contents links OK
- links whose text lives in a child span that sets its own color

Wherever that per-element rule is missing, blue leaks through. The design is
"opt-in color per element" with no safety net, so every new/un-classed link is
blue by default.

## Confirmed blue-TEXT offenders

| Tile | Element | Why blue |
|---|---|---|
| **FaxVerseTile** | `.faxEditionRow` → `.faxEditionRailTitle` | link has no color; title span has no color (multiple rows → several blue lines per tile) `FaxVerseTile.js:59,64` |
| **FaxVerseTile** | `.faxEditionRailRef` | `.scripture_link` sets slate, but the surrounding title text is blue |
| **PeopleTile** | `.peopleFaceCard` face-card names (`.peopleFaceName` / `.peopleFaceTitle`) | span has no color, inside an un-colored `<Link>` |
| **NarrationTile** | `.narrationItem` → `.narrationText` | `#c4c4c4` (near-invisible on light theme — separate contrast bug, not blue, but same missing-base-color family) |

Traced-and-safe (do **not** show blue): all `.tileHeading` header links,
`.contentsOutlineSections a`, `.communityMessage` (child spans `.communityMsgUser`
#2a2a2a / `.communityMsgText` #666 carry color), any `RefPill`/`.scripture_link`.

## Blue-CHROME offenders (focus ring / tap highlight, no visible text)

These links wrap images only, so no blue *text*, but they have **no custom focus
style** — the default UA focus ring (blue in Safari/Firefox) and mobile tap
highlight apply. No `:focus`/`:focus-visible` rule exists for `.samplerCard` /
`.samplerTileInner` / `.peopleFaceCard`, and no `-webkit-tap-highlight-color`
reset anywhere:

`.peopleFeatureImgLink`, `.placeProfileImgLink`, `.historyTileThumbLink`,
`.imageArtFrame`, `.narrationArtLink`, `.peopleFaceCard`, `.contentsTileHead`,
`.witnessLeft`, `.communityMessage`.

## Incidental

- `Home.css:118` `border: 1px solid blue;` in `.Community .groupCard .groupContent`
  is immediately overridden by `border-color:#DDD` on the next line — dead/debug
  declaration, not visible, but should be removed.

## Recommended fix (one rule kills the text blue)

Mirror the existing `.tileHeading a` pattern with a baseline on all tile links:

```css
/* Sampler.css — baseline: tile links inherit, never UA blue/purple */
.samplerTileInner a,
a.samplerTileInner { color: inherit; }
.samplerTileInner a:visited { color: inherit; }
```

This is safe: every place that *wants* a specific link color already sets it with
a more specific selector, which still wins. It removes the blue/purple from
FaxVerse titles, People face-card names, and any future un-classed link at once.

For the **chrome**, add an intentional focus style + tap reset on the card
wrappers (accessibility: keep a visible focus indicator, just not the UA blue):

```css
.samplerTileInner a { -webkit-tap-highlight-color: transparent; }
.samplerCard:focus-visible,
.samplerTileInner a:focus-visible { outline: 2px solid #323b4d; outline-offset: 2px; }
```

Separately, fix `.narrationText` `#c4c4c4` for light theme (contrast) and delete
the dead `border: 1px solid blue` at `Home.css:118`.

## Verify after fix

Screenshot `http://localhost:8200` (per CLAUDE.md — `bom.kckern.net` serves a
CDN-cached bundle). Check FaxVerse, People, Narration tiles in both light and
dark themes; tab through tiles to confirm the focus ring is slate, not blue.
