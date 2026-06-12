# Best-in-class study-group page comments: loading, placement, freshness

**Date:** 2026-06-11
**Status:** P0+P1 shipped; P2-P4 in progress
**Goal (KC):** excellent UX — not wasteful, no UI thrash, no conflicts with concurrent scrolling.

## Baseline (after today's P0)

Pipeline: page/group change → `messengerMessages(channelUrl, limit, customTypes:[pageSlug])`
(SQL-filtered as of `64dc6192`) → client indexes by verse → second GraphQL round trip
(`commentaryLocations`/`imageLocations`) → counts → bubbles render. Backend assembly is
fully batched (no N+1). Remaining costs: 2 sequential round trips cold; 2 `setPageComments`
dispatches (intermediate `counts: null` render); re-fetch on every page/group revisit;
placement can land mid-scroll.

## P0 — Correctness + payload (SHIPPED, `64dc6192`)

`custom_type` filtering moved into SQL. Fixes unreachable old comments (verified: 63/63
vs the handful inside the old 30-message window) and stops assembling users/reactions/
threads for messages that were discarded client-side.

## P1 — One round trip, one paint (SHIPPED)

1. **Server-side counts join.** New field `pagecomments(channelUrl, pageSlug)` returning
   `{ messages: [MessengerMessage], counts: [{ verse, com, img }] }`. The backend already
   has DataLoaders for commentary/image→location; resolving the verse mapping next to the
   messages removes the second client RTT and the client-side indexing pass.
2. **Single dispatch.** `setPageComments` fires once, with counts — no intermediate
   `counts: null` render, so bubbles paint exactly once.
3. **Skip-empty.** No com/img references in the messages → no counts work at all
   (currently the locations query still fires).

Acceptance: cold load = exactly 1 GraphQL request; React profiler shows one
comments-driven commit per page load.

## P2 — Layout stability under concurrent scrolling

Principle: **data may arrive at any time; layout change may not.**

1. **Reserved-space rendering.** Comment badges/bubbles render into space that exists
   before data arrives (fixed-size verse gutter / absolutely-positioned badges), so late
   counts change pixels, not geometry. Target: comments contribute 0 to layout shift.
2. **Scroll-manager gating for anything that must reflow.** If a placement genuinely
   changes document height, apply it through `src/scroll/` (campaign arbiter + settle
   detection): defer DOM placement while a scroll campaign is active or velocity is
   nonzero; flush on settle. Data loading stays concurrent — only the paint defers.
3. **Anchor compensation fallback.** For unavoidable shifts above the viewport, measure
   the delta and adjust scrollTop in the same frame (manual scroll anchoring), so the
   user's reading position is pixel-stable.

Acceptance: deep-link scroll campaigns (the `usePageInit` flows) complete to the correct
target with comments loading concurrently; no scroll-position jumps attributable to
comment placement (verifiable with the scroll e2e fixtures).

## P3 — Zero-waste freshness (cache + socket patching)

1. **Session cache** keyed `(groupUrl, pageSlug)` in MessengerController (same pattern as
   the channels Map): revisits render instantly from cache, no refetch.
2. **Socket-driven invalidation, in-place.** `message_received/updated/deleted` events
   whose `custom_type` matches a cached page patch the cached index and recompute counts
   locally — per the standing realtime directive: socket push + in-place cache patching,
   never polling, never refetch-on-event.
3. Cross-check: the unread-counts debounce pattern (500ms coalesce) applies if comment
   events arrive in bursts.

Acceptance: returning to a previously-viewed page issues 0 network requests and renders
in the same frame; a comment posted by another member appears via socket without any
GraphQL query.

## P4 — Perceived performance polish

1. **Idle prefetch** of the likely next page's comments (reading order / narration
   advance) via `requestIdleCallback`.
2. **Warm skeletons**: on revisit-while-revalidating (if we ever add revalidation),
   render cached bubbles immediately; never show the "Loading study group comments"
   notice when a cache entry exists.
3. Keep the 2.5s scroll-gate fallback (it's a safety net, verified working) but emit a
   deep-link instrumentation event when it fires so regressions are observable.

## Sequencing & risk

- P1 is backend+frontend, self-contained, biggest measured win (removes an RTT and a
  render). Risk: new SDL field — keep `messengerMessages` untouched for chat surfaces.
- P2 is frontend-only; coordinate with the scroll-manager owner docs (`docs/specs/`
  scroll spec; note the resolved-container remount caveat in scrollCampaign.js).
- P3 builds on the existing socket events — no new backend surface expected.
- P4 last; pure polish.

Each phase lands with tests (backend vitest for the new field; jest for cache/patching;
the existing scroll e2e fixtures for P2) and a manual two-tab check for P3.
