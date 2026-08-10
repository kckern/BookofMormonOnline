# Audit: `MapStoryCard.js` — the beat caption card

**Scope:** `frontend/webapp/src/views/Home/tiles/MapStoryCard.js` (the two caption
cards rendered in `.mapStoryStage`, `MapStoryTile.js:311–326`). Usability +
effectiveness only. The broader tile/map behavior is covered separately in
`docs/audits/2026-08-08-map-story-tile.md`; this focuses on the text caption.

## What it does
- `MapStoryMoveCard` — caption for the current beat: numbered badge, `start → end`
  leg with place thumbnails, a meta row (scripture ref button, duration, "detached"
  pill), a 3-line-clamped description, and a "Traveling: …" people list.
- `MapStoryCompleteCard` — end state: ✓ badge, "Journey complete" heading,
  description, and a `{title} · N moves · M places` meta line.

---

## Finding 1 — Scripture-ref button fails minimum touch/click target *(High)*

`MapStoryCard.js:50–54` renders the ref as a `<button>`, and
`Sampler.css` styles it `padding: 0; font-size: 0.72rem; text-decoration: underline`.
The hit area is therefore just the glyph box — roughly **11px tall**, well under the
24×24 (WCAG 2.2 AA) / 44×44 (Apple HIG) minimum. On a Home feed that is heavily
touch-driven, this is the card's primary action and the hardest thing to tap. It
also sits inline in a `flex-wrap` meta row next to the duration text, so mis-taps
are likely.

**Fix:** give it real padding and a min-height (e.g. `min-height: 24px; padding: .15rem .3rem; margin: -.15rem -.3rem` to keep visual position), or promote it to a clearly tappable chip like the other tile CTAs.

## Finding 2 — "Detached" only explains itself on hover *(High)*

`MapStoryCard.js:56–60`: the detached state is a tiny uppercase pill whose only
explanation is `title={label("mapstory_detached_title")}`. `title` tooltips are
**invisible to touch and keyboard users** and are the sole carrier of what
"detached" means. The pill isn't focusable, so keyboard users can't reach the
tooltip at all, and mobile — the primary audience — never sees it.

This matters for effectiveness: "a sub-party split off from the main group" is real
narrative signal, and right now most users get an unexplained badge.

**Fix:** surface the meaning inline (short visible label, or an info affordance that
works on focus/tap), not via `title` alone.

## Finding 3 — Raw slugs leak to the UI *(Medium)*

`placeLabel = (name, slug) => name || slug` (`:6`) and
`travelerText` (`:23`, `person.name || person.slug`) both fall back to the machine
slug. When a place/person name is missing, the reader sees a database string like
`zarahemla-land` or `nephi-son-of-lehi` in the leg, the arrow row, the thumbnail
`title`, and the `aria-label`. This is user-facing and looks broken.

**Fix:** either humanize the slug (replace `-`, title-case) or omit the leg element
and let the thumbnail carry it. Prefer a guaranteed name upstream, but the component
shouldn't render a raw slug as a last resort.

## Finding 4 — The caption duplicates state the tile already shows *(Medium)*

Within one tile the same facts are stated several times:
- **Move number:** the badge (`:36`) + `mapStoryPlaybackStatus` "Move X of Y"
  (`MapStoryTile.js:258`) + this card's `aria-label` (`:34`).
- **Origin → destination:** the `MapStoryFooter` (`MapStoryTile.js:329`) and,
  on the last beat, the leg.
- **Travelers:** the map now animates the party (per the `:28` comment
  "the people themselves now move on the map"), yet the card re-lists up to 3 names.
- **Title:** header `mapStoryTitle` + repeated in `MapStoryCompleteCard` meta (`:82`).

For a *glanceable* Home tile this is a lot of repetition competing for the same small
space. Decide which surface owns each fact and thin the rest.

## Finding 5 — Per-beat `<section aria-label>` adds screen-reader noise *(Medium)*

`MapStoryMoveCard` returns a `<section>` with an `aria-label` (`:32–34`). A named
`<section>` is a **region landmark**, so assistive tech exposes a navigable region
that changes identity on every beat — while the parent already provides a proper
visually-hidden text equivalent (`MapStoryTile.js:224` `#…-summary`) and a move-state
label. The card's `aria-label` is redundant with that summary and turns a decorative
caption into landmark clutter.

**Fix:** drop the `aria-label` (and/or use a plain `<div>`); the parent's
`mapStoryTextEquivalent` is the intended a11y channel. Same applies to
`MapStoryCompleteCard`'s `aria-label="Journey complete"` (`:76`), which duplicates the
visible heading.

## Finding 6 — Inconsistent localization *(Medium)*

The file mixes `label()` lookups with hardcoded English:
- localized: `mapstory_detached`, `mapstory_detached_title`, `mapstory_meta`.
- hardcoded English: `"Traveling:"` (`:66`), `"Journey complete"` heading (`:79`)
  and the `aria-label`s (`:34`, `:76`).

Either everything user-facing goes through `label()` or the convention is explicit;
right now the same card is half-translated.

## Finding 7 — Smaller polish items *(Low)*

- **Image-error layout shift** (`:15`): `onError` sets `display:none`, so a failed
  thumbnail collapses and the name jumps left. Prefer `visibility:hidden` (keeps the
  28px box) or a neutral placeholder — the CSS already gives `.mapStoryPlaceThumb` a
  `background`, so a broken `src` mostly self-hides anyway.
- **Decorative red `●`** before "Traveling:" (`:65`) is colored `#96362f`, the same
  family as the active map marker — it reads like a legend key but means nothing.
- **`div` styled as a heading** (`mapStoryCompleteHeading`, `:79`) — not a real
  heading element; fine visually, but inconsistent with `tileHeading` elsewhere.
- **`travelerText` fallback** (`:22`) returns the raw `move.travelers` string, which
  is then wrapped in "Traveling: …". If that field is already a sentence, the label
  doubles up. Confirm the shape of `move.travelers` vs `move.people`.

---

## Priority summary
| # | Finding | Severity |
|---|---------|----------|
| 1 | Ref button below min touch target | High |
| 2 | "Detached" explained only via `title` (no touch/keyboard) | High |
| 3 | Raw slugs leak when names missing | Medium |
| 4 | Caption duplicates tile-level state (move #, O→D, travelers, title) | Medium |
| 5 | Per-beat `<section aria-label>` = landmark noise | Medium |
| 6 | Half-localized strings | Medium |
| 7 | Image-shift, decorative dot, div-heading, traveler fallback | Low |

**Quick wins:** #1 and #6 are pure CSS/string changes; #5 is deleting an attribute.
#2 and #4 need a small design decision about what the caption owns vs. the map/footer.
