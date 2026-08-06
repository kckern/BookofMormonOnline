# Home Tiles — Two-Layer CTA Audit

**Date:** 2026-08-05
**Scope:** `frontend/webapp/src/views/Home/tiles/`
**Question:** Every card should expose two CTA layers — **(L1)** an in-place *reveal* (expand / accordion / modal, stays on page) and **(L2)** a *deeplink* into the associated content page, with L2 ideally surfaced only **after** L1 is triggered. Which tiles are missing which layer?

## Layer definitions used

- **L1 (in-place reveal):** `ExpandableText`/`readMorePill`, `CommentaryTile setExpanded`, `openScripture(...)` popup, `ScriptureExcerpt refAsPopup`, `MapStoryTile` play/pause/step, `ReadingPlanTile setChooser`. All keep the user on the Home page.
- **L2 (deeplink):** any `<Link to="/...">` into the content section (`tileMoreLink` "see in context" / "view more" / "view all" pills, whole-tile links, per-item links).
- **Strength:** ✓ = strong/discrete affordance; ~ = incidental only (e.g. a `RefPill` scripture popup but no way to expand the tile's *own* body); ✗ = absent.

## Per-tile matrix

| Tile | L1 in-place | L2 deeplink | L2 gated behind L1 | What's missing |
|---|---|---|---|---|
| **CommentaryTile** | ✓ read-more expand + ref popup | ✓ discrete "see in context" pill | ✗ | Only the sequencing. **This is the reference implementation** — its own comment states the intent: "Read-more expands the DOM in place (not a nav); 'See in context' is the separate action into the app." |
| ImageArtTile | ✓ ref popup | ✓ `view_in_context` pill | ✗ | sequencing |
| NotesTile | ✓ ref popups | ✓ `view_in_context` pill | ✗ | sequencing |
| MapStoryTile | ✓ play/pause/steps + ref popup | ✓ `view_more` pill | ✗ | sequencing |
| PeopleTile | ✓ ExpandableText bio + ref chips | ✓ view-all card + face links | ✗ | sequencing |
| ContentsTile | ✓ ExpandableText desc | ✓ outline links + head | ✗ | sequencing |
| PersonProfileTile | ✓ ExpandableText bio | ~ name/img links only | ✗ | discrete L2 pill; sequencing |
| PlaceProfileTile | ✓ ExpandableText desc | ~ place/map links only | ✗ | discrete L2 pill; sequencing |
| FaxVerseTile | ✓ ref popup | ~ per-edition row links | ✗ | discrete L2 pill; **dead `scripture_link` ref (no onClick)** |
| FaxTile | ✓ ref popup | ~ per-page/edition links | ✗ | discrete L2 pill; sequencing |
| PlacesTile | ~ ref popup only | ✓ view-all + place/map | ✗ | **strong L1** (no info expand); sequencing |
| ChiasmusTile | ~ ref popup only | ✓ `view_in_context` pill | ✗ | **strong L1** (MiniChiasm is static); sequencing |
| BiblePhrasesTile | ~ ref popups | ✓ `view_in_context` pill | ✗ | **strong L1** (passages are static); sequencing |
| NarrationTile | ~ per-beat ref popups | ~ per-beat links | ✗ | discrete L1 + discrete L2 pill |
| TextTile | ~ delegated to `TextInFeed` | ~ heading link only | ✗ | discrete L1 + L2 pill |
| MapTile | ~ interactive map | ✓ `view_more` pill | ✗ | L1 text reveal (arguably n/a — map is the interaction) |
| ReadingPlanTile | ✓ chooser toggle | ~ `start_reading`→/contents | ✗ | discrete deeplink to a plan detail page |
| **CommunityTile** | ✗ none | ✓ many links | n/a | **Layer 1 entirely** — every element navigates away; no modal/expand |
| **HistoryTile** | ✗ none (static teaser+bullets) | ✓ whole-tile link | n/a | **Layer 1 + discrete L2 CTA** — the entire card is one `<Link>` |
| **WitnessTile** | ✗ none (quote hard-clamped to 60 words) | ✓ whole-tile link | n/a | **Layer 1 + discrete L2 CTA** — the entire card is one `<Link>` |

## Findings

### 1. Missing Layer 1 (no in-place reveal at all)
- **CommunityTile** — pure navigation grid; nothing reveals in place.
- **HistoryTile** — `parseTeaser` cuts a 50-word lead + 4 bullets (`clampWords`), all static; no expand.
- **WitnessTile** — the money quote is `clampWords(..., 60)`, permanently truncated with no expand.

These three are the primary gap.

### 2. Weak Layer 1 (only an incidental scripture popup, no expand of the tile's own body)
- **ChiasmusTile, BiblePhrasesTile, PlacesTile, NarrationTile, TextTile.** The `RefPill`/`ScriptureExcerpt` popup is technically a modal, but there is no "show me more of *this tile*" affordance.

### 3. Missing a *discrete* Layer 2 CTA (the deeplink is the whole card, or only a per-item link)
- **HistoryTile, WitnessTile** wrap the entire card in one `<Link>` — no separate "see in context" pill.
- **TextTile, NarrationTile, PersonProfileTile, PlaceProfileTile, FaxTile, FaxVerseTile** rely on item/name links; no consistent tileMoreLink CTA like the sibling tiles have.

### 4. Missing the sequencing (L2 revealed only after L1) — **universal**
**No tile** currently gates its deeplink behind its expand. Even CommentaryTile (the reference) shows `tileMoreLink` unconditionally in its aside. If "L2 appears after L1" is the target UX, it is a folder-wide gap and wants a shared pattern rather than 20 one-offs.

### Structural note for implementation
`HistoryTile` and `WitnessTile` make the **entire card** a `<Link>`. You cannot nest an in-place `<button>` expand inside an anchor. To add Layer 1 they must be restructured to a `<div>` outer with inner anchors — exactly the pattern `ContentsTile` already documents ("Outer element is a div (not a Link): the outline carries its own nested anchors").

## Existing visual vocabulary (already two glyphs — good foundation)
- **L1** uses `.readMorePill` (inbox/down-arrow glyph, centered).
- **L2** uses `.tileMoreLink` (exit-bracket arrow glyph, right-aligned).

The two layers are already visually distinguished where both exist; the work is (a) adding the missing layer to the tiles above, (b) standardizing both into one shared component, and (c) optionally implementing the L2-after-L1 gating once, centrally.
