# Bare-leaf textblock URLs (`/zoramites/1`) broke as aliases

**Date:** 2026-08-27
**Status:** Fixed (on `dev`)
**Surfaces:** SSR (`frontend/next/`) + CRA (`frontend/webapp/`)

## Symptom

Navigating to the bare-leaf textblock URL `/zoramites/1` (the short form of the canonical
`/reign-of-judges/zoramites/1`):
- **SSR (crawlers):** returned **404**.
- **CRA (browser):** the page rendered, but showed the `init_warning_verse_not_found` banner
  (`InitWarning.js`) and did not scroll to the verse.

Flagged from a client log: `init_warning_verse_not_found zoramites/1`.

## Root cause

The backend `text(slug:)` resolver is forgiving: it resolves a bare leaf (`zoramites/1`) to
the **full canonical slug** `reign-of-judges/zoramites/1`. Two consumers assumed the requested
(short) slug string instead of the resolved full slug:

- **SSR** — `getReadBlock`'s sibling: `lib/text.ts` `getTextBlock` keyed its row map on the
  *returned* slug (`reign-of-judges/zoramites/1`) but looked it up by the *requested* `cur`
  (`zoramites/1`) → miss → `null` → `notFound()` → 404. (The full-path form and top-level pages
  like `/lehites/64` worked only because their requested slug already equalled the returned one.)
- **CRA** — `usePageInit.js` `buildOpenList` searched the DOM for `[textid="zoramites/1"]`, but
  the rendered rows carry the full hierarchical `textid` → no match → `reason:"verseNotFound"`.

## Fix (resolve in place, canonical → full path — "treated as aliases")

- **`frontend/next/lib/text.ts`** — match rows by the numeric `link` (`byLink.get(id)`), not the
  slug string; siblings via `link ± 1`. The backend's full-slug expansion now resolves. Returns
  the full `block.slug`.
- **`frontend/next/app/[...path]/page.tsx`** (textblock branch) — build the canonical `path`
  and the JSON-LD/body `here` URL from `block.slug` (full path), so a bare-leaf alias canonicals
  to the full path and Google consolidates (no duplicate).
- **`frontend/webapp/src/views/Page/usePageInit.js`** — `buildOpenList` falls back, when the
  exact `[textid]` isn't found, to the row whose `textid` trailing leaf equals the numeric
  `textId` (`[textid$="/id"]` + exact-leaf check, so `/1` never matches `/11`); opens the
  element's own full `textid`.

## Regression tests

- `frontend/next/test/routes/scripture.test.ts` — `/zoramites/1` → 200 + canonical contains
  `/reign-of-judges/zoramites/1`; existing `/lehites/64` textblock cases still pass.
- `frontend/webapp/src/views/Page/__tests__/usePageInit.test.js` — `buildOpenList('zoramites','1')`
  resolves against a full-path `textid`; and the `/11`-not-matching-`/1` guard.

Full Next SSR suite 160 passed; CRA Page suite 53 passed.

## Not in scope
Enumerating bare-leaf textblock URLs in the sitemap (the sitemap already lists the canonical
full-path page/section slugs; aliases just consolidate to them).
