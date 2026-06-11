# Theater "Failed to load theater" — missing `queue` resolver

**Date:** 2026-06-10
**Symptom:** `/theater` (and `/theater/:slug`) showed "Failed to load theater" on green-field.
**Status:** Fixed — theater loads and plays. Two secondary fields (`status`, `next`) still degrade.

## Root cause
The `queue(token, items): [TextBlock]` query (SDL `BomPage.graphql`) had **no resolver** in the
green-field — it returned `{}`/null. The frontend (`Theater.js:230`) sets `loadFailed` when the
queue is empty, so the theater never rendered.

## Fix
- **`backend/src/data/loaders/queue.ts`** (new) — port of legacy `lib.ts getBlocksToQueue()` and its
  helper chain (`buildQueueFromSection`, `getBlocksFromPage`/`Slug`/`TextBlock`/`Token`/`Reference`/
  `ReadingPlan`, `getBlocksByDefault`, `resolveQueueFromTextBlocks`, `loadCompletedBlocks`). Resolves
  an items[] selector (slug / reference / reading-plan / explicit blocks) — or token-based / default
  when none — into an ordered `[{ slug, blocks }]`. Read-only (legacy back-filled `queue_weight` and
  `sectionGuids`; we read what's there).
- **`scriptureread.ts`** — added the `queue` Query resolver: runs `getBlocksToQueue`, then fetches the
  `bom_text` rows for each `(slug, blocks)` in block order and returns them as `TextRow[]`. The core
  (`resolvers.ts`) + media `TextBlock` field resolvers handle content/heading/slug/people/places/
  narration/duration off each row's guid/page/link/section.
- **`media.ts`** — added `TextBlock.imgs` / `TextBlock.coms` (parse the block's `[i]`/`[c]` markers →
  `imageById` / `commentaryById` loaders). The page view only needed `imgIds`/`comIds`; the theater
  needs the full objects.

## Verified (token 717…, `/en`)
- Default `/theater`: 37 blocks; first block has slug/heading/content/duration.
- `/theater/lehites`: 28 blocks.
- Full frontend query (status/content/parent_page/parent_section/narration/heading/slug/duration/
  people/places/imgs/coms/next): **zero GraphQL errors**.
- `coms` resolve on 37/37 blocks, `imgs` on 4 (sample com: "A Word Unto Jacob" + preview).
- Browser: `/theater` and `/theater/lehites` render the theater wrapper, no fail screen, 0 page errors.

## Remaining (degraded, non-blocking — follow-up)
- **`TextBlock.status(token)`** → null. Per-block completion state (started/completed) for the user;
  needs a resolver over `bom_log` block credit (legacy `BomPage.ts` status resolver). Theater plays
  fine without it; progress ticks just don't render.
- **`TextBlock.next`** (`[NarrativePath]`) → null. The end-of-queue "what's next" navigation. Theater
  steps through the loaded queue via `cursorIndex`; `next` is only the cross-queue continuation prompt.

## Notes
- `queue_weight` is a numeric-valued varchar; ordered numerically (`queue_weight + 0`) to avoid
  lexical mis-ordering ("10" < "2").
- The default queue starts at the user's most-recent studied block (token path) or page
  `4becc77f2d75f` (anon/default), matching legacy.
