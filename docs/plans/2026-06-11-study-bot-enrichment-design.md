# Study Bot Enrichment — Design

**Date:** 2026-06-11
**Status:** Approved (user validated schema choice, lang fallback, misc-bot classification)

## Problem

The "Plug in a study bot" picker shows everything flagged `is_bot=1` in
`messenger_users` — community bots (the reformers), junk rows (`148965`,
`undefined`), and synthetic users — alongside the real study bots. Pickability
is currently *inferred* from `metadata.welcome`, which is fragile and untyped.
Study bots also exist per language (StudyBuddy en, SchriftStudierBot de,
KasulatanBot tgl, Écritudiant fr, 스터디버디 ko, BotHọcKinhThánh vn) but the
picker ignores the site language.

## Decisions

1. **`bom_bot` becomes the bot registry (SSoT).** Two new columns:
   - `bot_class ENUM('study','community') NOT NULL DEFAULT 'community'`
   - `lang VARCHAR(12) NULL` — language scope for study bots; `NULL` = all languages.
2. **Bot classes:**
   - `study` — pluggable assistants users add to a study channel; shown in the picker.
   - `community` — fictional characters that converse with each other on a
     schedule (e.g. the reformers); never shown in the picker.
3. **Language scoping:** picker filters `lang = <normalized site lang> OR lang IS NULL`.
   English editions (`rlds`, `covoc`, `str`, `plain`, `easy`, `concise`)
   normalize to `en` for bot filtering, so StudyBuddy appears on all English
   editions. Other languages match exactly; a language with no study bot shows
   an empty picker.
4. **Backfill:**
   - 10 reformers (already in `bom_bot`) → `community`.
   - 6 language study bots → new `bom_bot` rows, `study` + their `metadata.lang`.
   - Help Desk + Linguist Agent → `study`, `lang NULL` (visible in every language).
   - Junk/synthetic `is_bot` rows get no `bom_bot` row → excluded from the picker.

## Changes

| Layer | File | Change |
|---|---|---|
| Schema | `backend/scripts/` (idempotent .mjs) | ALTER `bom_bot` + backfill |
| Types | `backend/codegen/db.d.ts` | add `bot_class`, `lang` to `BomBot` |
| Resolver | `backend/src/graphql/resolvers/community.ts` | `botlist` joins `bom_bot` (`bot_class='study'`, `enabled=1`, lang filter); drop `metadata.welcome` inference |
| Query | `backend/src/messaging/users.ts` | new `listStudyBots(db, lang)` join helper; `listBotUsers` untouched (other callers) |
| Scheduler | `backend/src/bots/scheduler.ts` | add `bot_class='community'` guard to the tag query |
| Guard | `backend/src/messaging/bots/registry.ts` | `addBotToChannel` additionally requires a `study` registry row |
| Tests | `backend/test/` | lang normalization + study-bot filter coverage |

No frontend change required: `BoMOnlineAPI` already prefixes requests with the
site language (`determineLanguage()`), which lands in `ctx.lang` server-side.

## Out of scope

- Cleaning up the junk `is_bot=1` rows in `messenger_users` (separate audit).
- Per-language community bot conversations (channel `lang` already drives prompts).
