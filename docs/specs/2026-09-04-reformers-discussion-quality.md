# Reformers Discussion Quality — Rich Linking + Concise Replies + Observability

**Date:** 2026-09-04
**Status:** spec → implementing
**Trigger:** First operationalized threads exposed two first-class defects (KC): (1) an opener that *mentioned* scripture but attached no content card ("John Wesley" / jacob-2-marriage, `anchor=null`), and (2) replies far too long to read.

## Requirements (KC, first-class)

1. **Rich linking is the point.** Every discussion post should **link an actual text block from a page** (attached scripture-excerpt card), not merely mention a reference in prose. Openers MUST attach. Replies SHOULD be able to attach their own links (cite extra scripture / asset). The purpose is to showcase the system's rich linking into its own resources.
2. **Concise replies with controlled variety.** ~2 sentences by default. A **statistical length histogram** within set bounds — some shorter, some longer. Longer is *earned*: allowed only when a reply quotes itself or links something.

## Locked knobs (KC 2026-09-04)

- **Length histogram (target sentences/reply, sampled per turn):** 1→15%, 2→45%, 3→25%, 4→15%. Hard cap **4** normally; up to **6** when the reply quotes or links. Mean ≈ 2.4.
- **Reply rich-link frequency:** ~**1 in 3** replies attach their own content card (cite extra scripture / asset). Attaching unlocks the longer (≤6) bound.
- **Pause during rebuild:** scheduler disabled + queued turns cancelled (done 2026-09-04).

## Root cause (opener linking)

`resolveVerseDisplay(verseId)` matches `bom_text WHERE min_verse_id = verseId` — resolves ONLY when the verse is exactly a text unit's first verse. `buildTopicRefs` used the passage's first verse + this exact-match, so it linked a card **only by luck** (when the passage started on a unit boundary). It also stored a bare verse-id (no slug/ordinal, no span) and silently degraded `anchor` to null.

`bom_text`: `page` (guid), `link` (ordinal on page), `min_verse_id` (unit's first verse), `content` (HTML block). No `type` column. Page guid → slug via `bom_slug(type='PG')` / `SlugResolver`. **Containing-unit** = `WHERE min_verse_id <= firstVerse ORDER BY min_verse_id DESC LIMIT 1`.

## Design

### WS1 — Openers always link a page text block
- New `resolvePassageBlock(db, passageRef)` in `contentRefs.ts`: whole-range `refToVerseIds` → containing-unit lookup for the first verse → `{ pageSlug, ordinal, unitFirstVerseId, text }` or `null`.
- `buildTopicRefs` uses it → `anchor = pageSlug` (the page-comment join key; NOT `pageSlug/ordinal`), `references = [{type:'verse', id: unitFirstVerseId, role:'subject', slug: pageSlug, ordinal }]`. Returns "unresolved" when null.
- `runManagedDiscussion`: if the chosen topic doesn't resolve to a block, **skip it (log warn) and try the next least-recently-used topic**; never post a bare-mention opener. Backfill `bom_ai_topic.passage_slug` for determinism (follow-up).

### WS2 — Reply length histogram
- `sampleReplyLength()` → target sentence count from the histogram; `linking` flag raises the cap to 6.
- Inject `Respond in about N sentence(s).` into the per-turn instructions. Post-hoc: log target vs actual sentence count; if wildly over (>cap+2), log a `bots.turn.overlong` warning (no auto-regenerate in v1).

### WS3 — Reply rich-linking (~1/3)
- Per turn, `Math.random() < 0.33` → instruct the reply to bring in ONE additional supporting scripture and weave it in.
- After generation, parse the reply text for scripture refs (`detectReferences` callback) → for the first detected ref, resolve via `resolvePassageBlock` → attach `anchor` + `references:[{...role:'highlight'}]` to the `bot_comment` post so it renders a card. Linking turns get the ≤6 length bound.

### WS4 — Observability (structured logging)
- `src/bots/logger.ts`: thin structured logger (JSON to stdout → vector → VictoriaLogs). Component field `bots`; correlation via `rootMessageId`.
- Events: `discussion.start` (channel, topicId, kind, passageRef, opener, voices), `discussion.opener_posted` (rootMessageId, anchor, refCount, latencyMs), `discussion.turns_scheduled` (turns w/ dueAt), `generate.start` (botId, model, effort, msgCount, promptChars), `generate.done` (latencyMs, outputChars, sentences, tokensIn/Out if available), `generate.fail`, `turn.start`, `turn.posted` (messageId, latencyMs, lengthTarget, actualSentences, linked), `turn.skipped`/`turn.failed`, `topic.skipped_unresolved`. Full prompt + output logged (no secrets; env/keys never logged).
- `generateBotReply` gains an optional `ctx` (rootMessageId, botId label, phase) for correlation + logs prompt/output/timing/tokens.

## Verification
- Unit tests: `resolvePassageBlock` (boundary + mid-unit + unresolvable), `sampleReplyLength` distribution, `buildTopicRefs` (resolves + unresolved). Extend existing `topicRefs`/`contentRefs` tests.
- Live dry-run: regenerate the jacob-2-marriage opener locally, confirm `anchor=jacobs-address` + card-ready ref; run a full one-thread and eyeball reply lengths + a linked reply.
- Then re-enable schedule (`bom_bot_schedule.enabled=1`) + deploy.

## Out of scope (follow-up)
- Multi-block passage cards (link the whole 23–35 range as several blocks). v1 links the containing unit.
- Backfilling `passage_slug` on all `bom_ai_topic` rows.
- Cleaning up the already-posted long/card-less threads.
