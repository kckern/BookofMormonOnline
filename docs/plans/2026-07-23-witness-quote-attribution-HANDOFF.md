# Handoff: witness money-quote attribution

**For:** backend + frontend
**Design:** `docs/plans/2026-07-23-witness-quote-attribution.md`
**Data:** `witness_attribution.sql` in the BoMOnlineWorkspace repo — 404 UPDATEs, not yet run

---

## Why this is happening

The witness source card renders a quote as `SPEAKER: "quote"`. Today it hardcodes the **witness**
into the attribution slot on both branches of `Witnesses.js:362-379`, so a reporter's words get
displayed under the witness's name — 236 of them with an "In his own words" badge. Some of those
quotes were never spoken by the witness at all. Six rows were showing a stranger's line from the
road-to-Cumorah episode as David Whitmer's own testimony.

The fix is a `quote_speaker` field plus a second boolean, so the card can name whoever actually
said the words.

---

## The data contract

Four keys on `bom_xtras_history.metadata` (freeform JSON — no migration).

| key | type | meaning |
|---|---|---|
| `money_quote` | string | Display text. **Editorially prepared**, not a raw substring: `[...]` marks elision, `[Name]` marks a supplied referent replacing a pronoun. Render as-is. |
| `quote_speaker` | string | Who uttered the words. Goes in the `Name:` slot. |
| `quote_is_witness_voice` | bool | **Redefined.** True only when `quote_speaker` IS the witness. |
| `quote_contains_witness_speech` | bool | The witness's own direct words appear somewhere inside the quote. |

Invariants the emitter guarantees, so you don't need to defend against them:

- `quote_is_witness_voice` is **derived** by comparing the resolved speaker to the witness name,
  never taken from a model. 
- `quote_is_witness_voice ⟹ quote_contains_witness_speech`. There are zero rows with
  `voice=TRUE, speech=FALSE`.
- `quote_speaker` is non-empty on every updated row.

---

## Backend — six edits, all additive

| layer | file:line | change |
|---|---|---|
| loader type | `backend/src/data/loaders/searchhist.ts:44` | add `quote_speaker: string \| null` and `quote_contains_witness_speech: boolean \| null` to `HistoryRow` |
| loader map | `backend/src/data/loaders/searchhist.ts:479` | `quote_speaker: metaString('quote_speaker')`, `quote_contains_witness_speech: metaBool('quote_contains_witness_speech')` |
| schema | `backend/schema/BomNotes.graphql:80` | add both scalars to `HistoricalDocument` |
| resolver | `backend/src/graphql/resolvers/searchhist.ts:88` | two pass-through `?? null` lines |
| codegen | `backend/codegen/graphql.ts` | regenerate |
| query | `frontend/webapp/src/models/GraphQLQueries.js:646` | add both field names |

`metaString` / `metaBool` already exist and handle these shapes. Nothing else in the pipeline
needs to know.

---

## Frontend — three render cases

Replace the boolean branch at `Witnesses.js:362-379`. Branch on `quote_speaker` first, then on the
two booleans.

| case | condition | n | render |
|---|---|---|---|
| **A** | `quote_is_witness_voice` | 201 | Witness portrait. Quote in quote marks. Attribution `— {quote_speaker}`. Badge OK. |
| **B** | `!voice && contains_witness_speech` | 17 | `{quote_speaker}:` prefix **outside** the quote marks. Worth noting it quotes the witness. No witness portrait as the speaker. |
| **C** | `!voice && !contains_witness_speech` | 186 | `{quote_speaker}:` prefix. No portrait, no badge. |

The current code's `— {witness}, as recorded by {reporter}` string should go. It asserts the
witness supplied the wording, which is exactly the false claim in case C.

### Delete or replace

- **`"In his own words"` at `Witnesses.js:379` is hardcoded masculine** and 23 firsthand rows have
  female principals — Lucy Mack Smith, Emma Smith, Katherine, Elizabeth Ann Whitmer Cowdery, Mary
  Salisbury Hancock, Sarah Fowler Anderick, Mary Adeline Noble. Use neutral wording.
- `.historycard.is-firsthand`, `.firsthand-badge`, `.thumb_money_quote`,
  `.money_quote_attribution` in `Witnesses.css:440,451,499,518,522` and the dark-mode override in
  `assets/theme/scss/darkmode/_history.scss:41,46` will all need revisiting for the `Speaker:`
  prefix layout.
- Fixtures in `views/History/__tests__/Witnesses.render.test.js` set `quote_is_witness_voice` under
  the old meaning; they need updating alongside.

---

## Edge cases that will bite you

**1. `quote_speaker` is absent on 40 of 444 rows.** 39 are stub transcripts with no quote at all.
One (`1829-08-lucy-mack-smith-mr-grandin`) has a *legacy* `money_quote` and a *legacy*
`quote_is_witness_voice` under the old semantics, because its transcript is a 20-word fragment
whose pronoun has no resolvable antecedent. **Treat `quote_speaker` as required to render the
attributed form.** If it's missing, fall back to `teaser` — do not render the quote with a guessed
speaker.

**2. `quote_speaker` is not always a person.** 16 rows have a publication in the slot — Chicago
Times, Deseret Evening News, Richmond Democrat, The Encyclopædia Britannica. Correct where the
paper's own narration is the quote. Don't look up a portrait by speaker name, and check how a
masthead reads in a `Name:` slot before shipping.

**3. `quote_is_witness_voice` changes meaning the moment the SQL runs.** The key name is retained
deliberately so an un-deployed frontend degrades toward correctness rather than away from it —
case-B rows flip to false and lose the wrong badge. But there is a window where the old frontend
renders new data. It's not harmful, just less right than it will be. Deploy order doesn't matter
much; running the SQL first is the safer half.

**4. Quotes contain brackets and ellipses by design.** `[David Whitmer]` and `[...]` are meaningful
editorial marks, not artifacts. Don't strip them. They may render in a lighter weight if you want,
but the text must stay.

**5. `quote_contains_witness_speech` is relative to the row's witness, not a property of the text.**
`1864-12-31-luke-johnson` and `1864-12-31-luke-johnson-three-witnesses` have identical quotes and
transcripts but opposite values, because the `witness` differs between the rows.

---

## One decision needed before the tile ships

Six rows carry the same stranger's line from the road-to-Cumorah episode, and they name that
figure **five different ways**:

- "the stranger on the road" — `1878-09-07-joseph-f-smith-david-whitmer`
- "the messenger" — `1878-11-16-orson-pratt-and-joseph-f-smith-david-whitmer`
- "One of the Three Nephites" — `1887-01-02-edward-stevenson-david-whitmer-5`, `1887-02-15-edward-stevenson-david-whitmer`
- "Moroni" — `1889-01-01-edward-stevenson-david-whitmer`
- "an unidentified traveler" — `1918-04-25-joseph-f-smith-david-whitmer`

"Moroni" and "One of the Three Nephites" are contradictory identifications, not stylistic variants,
and the name is now reader-facing. This wants one editorial ruling, then a small SQL update.

---

## Verification queries

```sql
-- coverage
SELECT COUNT(*) total,
       SUM(JSON_EXTRACT(metadata,'$.quote_speaker') IS NOT NULL) with_speaker,
       SUM(JSON_EXTRACT(metadata,'$.quote_is_witness_voice')=TRUE) voice,
       SUM(JSON_EXTRACT(metadata,'$.quote_contains_witness_speech')=TRUE) speech
  FROM bom_xtras_history WHERE archive='witnesses';
-- expect: 444 / 404 / 201 / 218

-- invariant: must return 0
SELECT COUNT(*) FROM bom_xtras_history
 WHERE archive='witnesses'
   AND JSON_EXTRACT(metadata,'$.quote_is_witness_voice')=TRUE
   AND JSON_EXTRACT(metadata,'$.quote_contains_witness_speech')=FALSE;

-- rows with a quote but no speaker (the legacy-semantics row) — expect 1
SELECT slug FROM bom_xtras_history
 WHERE archive='witnesses'
   AND JSON_EXTRACT(metadata,'$.money_quote') IS NOT NULL
   AND JSON_EXTRACT(metadata,'$.quote_speaker') IS NULL;
```

---

## What the mechanical check does and does not guarantee

Every quote was verified against its live transcript: each run of text between brackets and
elisions must appear in the source **in order**, with span and insertion-ratio caps against
fabrication. 401 exact, 3 fuzzy (OCR tolerance), 0 failures.

It **cannot** catch a *wrong* bracket. Brackets are treated as gaps, so `[David Whitmer] was
dressed in white` — describing the angel — passes mechanically. That one was caught by review, but
any similar error that survived review is invisible to the checker. If a bracket looks wrong on a
card, trust your eyes over the pipeline.
