# Witness Money-Quote Attribution — Data Model Design

**Scope:** data model only. The `metadata` JSON contract, the backend plumbing that lifts it
(loader → schema → resolver → query), and the rewrite of the 405 existing quotes.
The witness tile render is a **follow-on** and is deliberately not specified here
(see *Out of scope*).

**Status:** design validated 2026-07-23. Data rewrite complete and pending execution —
`witness_attribution.sql` in the BoMOnlineWorkspace repo, 405 rows. Backend plumbing and the
tile follow-on are not yet implemented.

---

## The problem

Every money quote on the witness source card renders inside quote marks with the witness's
name beneath it, and 236 of them additionally carry an "In his own words" badge. The data
does not support that claim.

`frontend/webapp/src/views/History/Witnesses.js:334,362-379`:

```js
const firsthand = !!doc.quote_is_witness_voice;
…
<blockquote className='thumb_money_quote'>
  &ldquo;{doc.money_quote}&rdquo;
  <footer className='money_quote_attribution'>
    {firsthand
      ? `— ${doc.witness_label || doc.principal}`
      : `— ${doc.witness_label || doc.principal}${doc.reporter_label ? `, as recorded by ${doc.reporter_label}` : ''}`}
  </footer>
</blockquote>
…
{firsthand && <div className='firsthand-badge'>In his own words</div>}
```

The witness is hardcoded into the attribution slot on **both** branches. There is no code path
that can name anyone else as the speaker. Two failure classes follow.

**`firsthand === true` (236 rows).** The stored string frequently contains the reporter's
narration. `1901-03-19-joseph-f-smith-david-whitmer` renders today as:

> "I asked him if he and the other witnesses each signed their own name to their testimony, and
> he unhesitatingly replied, 'Yes, we each signed our own name.' Then I said…"
> — David Whitmer
> **In his own words**

That is Joseph F. Smith's prose, in quote marks, under Whitmer's name, badged as Whitmer's own
words. Whitmer's actual contribution is six words nested inside it.

**`firsthand === false` (169 rows).** Renders `— David Whitmer, as recorded by William McLellin`
for `1880-09-14-william-mclellin-david-whitmer`, whose text is:

> "I saw him June 1879, and heard him bear his solemn testimony to the truth of the book…"

McLellin said that, about Whitmer. "As recorded by" implies Whitmer supplied the wording.

**Additionally:** the badge string is hardcoded masculine and 23 firsthand rows have female
principals — Lucy Mack Smith (8), Emma Smith (7), Katherine (4), Elizabeth Ann Whitmer Cowdery,
Mary Salisbury Hancock, Sarah Fowler Anderick, Mary Adeline Noble.

---

## The governing principle

What the archive owes a reader is correct attribution of **utterance** — who said these words.
It does not owe adjudication of **truth**. If McLellin misremembered a date or misreported what
Whitmer told him, that is carried by putting McLellin's name on the quote; the reader weighs it
from there.

This reframe promotes the 169 non-witness-voice rows from second-class to first-class. They are
quotes with a different speaker, not degraded witness quotes.

**Consequence:** money quotes become editorially prepared display text rather than raw
transcript substrings. Ellipses for elision, square brackets for referent resolution, and
trimming for impact are all permitted, provided the words that remain are the speaker's.

---

## Why one boolean cannot work

`quote_is_witness_voice` flattens two independent axes:

1. **Whose words** are in the quote.
2. **Whether the witness's own speech appears** anywhere inside it.

Evidence from the 405 quoted rows:

| case | n | example slug |
|---|---|---|
| A — witness authored the document | 90 | `1875-12-08-david-whitmer-to-james-n-seymour` |
| B — witness quoted inside another's document | 146 | `1888-01-07-angus-m-cannon-david-whitmer` |
| C — reporter's own first-person account | 68 | `1880-09-14-william-mclellin-david-whitmer` |
| D — third-person narration, no first-person speaker | 101 | `1886-05-13-nathan-a-tanner-jr-david-whitmer` |

The flag says `true` for A + B and `false` for C + D. 97 rows contain inner quote marks (62 of
them in B), which is the signature of the mixed reporter-frame-plus-witness-speech string.

---

## Data model

Three keys on `bom_xtras_history.metadata`. Flat scalars, matching the existing convention —
the loader's only extraction helpers are `metaString()` and `metaBool()`, so a flat shape costs
zero plumbing. A nested `quote: {}` object would require a `metaObject` helper, a new GraphQL
type, and codegen regeneration for no display gain.

```json
{
  "money_quote": "I saw [David Whitmer] June 1879, and heard him bear his solemn testimony to the truth of the book—as sincerely and solemnly as when he bore it to me in Paris, Ill. in July 1831.",
  "quote_speaker": "William McLellin",
  "quote_is_witness_voice": false,
  "quote_contains_witness_speech": false
}
```

| key | type | meaning |
|---|---|---|
| `money_quote` | string | Display text, editorially prepared. Elisions as `[...]`, referent resolution as `[Name]`. Every remaining word belongs to `quote_speaker`. |
| `quote_speaker` | string | Display name of whoever uttered the words. Always present. Drives the `Name:` prefix. May be an institution (`Richmond Democrat` is a real `author` value), so consumers must not assume a person. |
| `quote_is_witness_voice` | bool | **Redefined:** true only when `quote_speaker` *is* the witness. Same key name retained deliberately — see *Deploy ordering*. |
| `quote_contains_witness_speech` | bool | Whether the witness's own direct words appear anywhere inside the quote. |

Existing keys `witness_label`, `reporter_label`, and `transcript_is_stub` are unchanged.

### The two axes, resolved

| case | `quote_speaker` | `quote_is_witness_voice` | `quote_contains_witness_speech` |
|---|---|---|---|
| A self-authored | David Whitmer | `true` | `true` |
| B trimmed to inner speech | David Whitmer | `true` | `true` |
| B frame kept | Joseph F. Smith | `false` | `true` |
| C reporter first-person | William McLellin | `false` | `false` |
| D impersonal | Nathan A. Tanner, Jr. | `false` | `false` |

The two booleans are independent, which is precisely what the single flag could not express.

### Decisions taken

- **Case B is a per-row editorial call.** Trimming to the witness's words versus keeping the
  reporter's frame is decided per row, not by rule. The Angus Cannon row is stronger trimmed;
  the Joseph F. Smith row is stronger with the frame kept. `quote_speaker` follows from
  whichever is chosen.
- **`quote_speaker` falls back to the publication** when the author is unnamed. This affects
  4 rows: 2 with null/empty `author`, `Unknown` (`1833-11-06-unknown-hiram-page`), and
  `Unidentified Chicago Man` (`1888-01-26-unidentified-chicago-man-david-whitmer`).
  `source` is NULL on all 405 rows, so there is no field to derive this from; assign by hand
  from `citation`.

### Deploy ordering

The database is production and the frontend deploys separately. Retaining the
`quote_is_witness_voice` key under tightened semantics means a not-yet-updated frontend
degrades *toward* correctness: case-B rows flip from `true` to `false`, losing the false
"In his own words" badge and falling back to the "as recorded by" branch. Removing the key
instead would make every row read `false` and render the wrong reporter attribution on
case-A rows.

---

## Rewrite of the 405 existing rows

### Mechanically derivable — 259 rows

`quote_speaker = author` holds uniformly for A (where `author` already equals `principal`),
C, and D. Only the 4 unnamed-author rows need hand assignment.

### Requiring model judgment — all 405

The A/B/C/D bucketing above is itself derived from `quote_is_witness_voice`, the flag this
design exists to replace. `1901-03-19-joseph-f-smith-david-whitmer` sits in B only because the
old flag said `true`, and it is mostly Smith's words. **The bucketing is a sizing estimate, not
ground truth.** The rewrite pass must re-derive classification from the text, so every row goes
through it.

### Bracket resolution — 79 mandatory

79 quotes open with a bare pronoun and cannot stand alone once detached from their document
(D: 32, B: 25, C: 15, A: 7):

> "**He** affirmed his testimony as given in the Book of Mormon…"
> → "**[David Whitmer]** affirmed his testimony as given in the Book of Mormon…"

A further 201 rows carry a third-person pronoun later in the string, where resolution is a
judgment call about whether the referent is already clear from what precedes it.

### Tooling

A sibling to `_witness_quotes.mjs` in the BoMOnlineWorkspace repo, retaining its established
discipline: JSONL cache for resume, read-only against the database, emits reviewable `.sql`
for KC to execute. Per row it returns
`{speaker, is_witness_voice, contains_witness_speech, quote}`.

**Verification changes.** `isVerbatim()` currently splits the quote on elision markers and
requires each segment to appear in the transcript. Bracketed insertions such as
`[David Whitmer]` are absent from the transcript by construction and would fail every check.
It must strip `[…]` insertions before matching, the way it already splits on `[...]` elisions —
note these two bracket uses are syntactically similar and need disambiguating. It must also
reconcile with the existing `<…>` editorial-insertion convention that `stripHtml()` and
`cleanQuote()` already handle. Rows failing verification remain excluded from the emitted SQL.

---

## Rewrite outcome (2026-07-23)

404 of 405 rows rewritten, verified, and emitted to `witness_attribution.sql`. One row excluded:
`1829-08-lucy-mack-smith-mr-grandin`, whose entire transcript is a 20-word sentence fragment
beginning "and when they succeeded in making a contract with one E. B. Grandin". The antecedent
of "they" appears nowhere in the source and no sibling document supplies it, so the mandatory
referent bracket cannot be filled without inventing one. It needs a transcript backfill, not an
editorial decision.

Two counts below are easy to conflate, so both are given. `speaker_choice` is what the editorial
pass selected; `quote_is_witness_voice` is derived afterwards by comparing the resolved speaker
name to the witness name. They differ by 5 rows — self-authored documents where the pass chose
"author" and the author's name equals the witness's, which correctly resolves to witness voice.
**The flag that drives the tile badge is the derived one: 201 rows.**

| | old flag | after rewrite |
|---|---|---|
| `speaker_choice` = witness | — | 196 |
| `speaker_choice` = author | — | 190 |
| `speaker_choice` = third party | not representable | 18 |
| **`quote_is_witness_voice` TRUE** | **236** | **201** |
| `quote_is_witness_voice` FALSE | 169 | 203 |

The 18 third-party speakers are the category the old boolean could not express at all. Seven of
them are the road-to-Cumorah episode, where a stranger's line ("No, I am going over to Cumorah")
was being displayed as David Whitmer's own testimony; six rows carry that line verbatim.

**Open inconsistency in that episode:** the six rows name the same figure five different ways —
"the stranger on the road", "the messenger", "an unidentified traveler", "One of the Three
Nephites" (×2), and "Moroni". The last two are contradictory identifications, not just different
registers. Different reviewers resolved the same figure from different sibling documents. This
needs one editorial ruling before the tile ships, since the name is now reader-facing.

Others include a
patriarchal blessing spoken by Joseph Smith over Whitmer (`1835-david-whitmer`, whose `author`
column is wrongly filled with the witness's own name), and D&C 17 revelation text
(`2023-02-13-joseph-smith-jr`), which refers to "my servant Joseph Smith Jr" in the third person
and so cannot be Joseph speaking.

**Verifier limits worth knowing.** Bracketed insertions are treated as gaps, so the mechanical
check cannot detect a *wrong* bracket — `1882-03-01-david-whitmer` had `[David Whitmer] was
dressed in white` for a sentence describing the angel, caught only by human-level review. Two
verifier guards (a 25% insertion-ratio cap and a 20-character anchor floor) both misfire on very
short documents and are waived when the anchors cover ≥80% of the source, every bracket stays
name-sized, and the brackets together stay under half the quote.

An adversarial review of the harness found three guarantees weaker than the comments claimed;
all are fixed and pinned by tests in `_witness_attribution.mjs test` (16 cases):

- The in-order guarantee held *between* anchors but not *within* one. The OCR-tolerance path
  pinned only the first 8-word shingle, so a single long anchor could splice or even reverse
  passages far apart in the source. Each shingle now advances a cursor.
- The hit ratio alone could not separate OCR noise from a silent deletion, since one garbled word
  and fifteen dropped words both break roughly eight consecutive shingles. A span check now
  rejects a fuzzy anchor covering more than 1.25× its own length of source.
  `1843-06-15-j-b-newhall-hyrum-smith` had shipped at 21/26 = 0.81 while spanning 1.6×, silently
  dropping "preach, and conversed with him about his religion, its origin and progress; and we".
- The per-bracket size cap did not bound total fabrication: several ≤30-char brackets chain into
  an arbitrarily long invention. Total insertion is now capped under the waiver too.

The opening-pronoun gate was also case-sensitive, which let a lowercase "they" opener through.

## Backend plumbing

Six files, all additive. `metadata` is freeform JSON, so there is no database migration.

| layer | file | change |
|---|---|---|
| loader type | `backend/src/data/loaders/searchhist.ts:44` | add 2 fields to `HistoryRow` |
| loader map | `backend/src/data/loaders/searchhist.ts:479` | `metaString('quote_speaker')`, `metaBool('quote_contains_witness_speech')` |
| schema | `backend/schema/BomNotes.graphql:80` | add 2 scalars to `HistoricalDocument` |
| resolver | `backend/src/graphql/resolvers/searchhist.ts:88` | 2 pass-through `?? null` lines |
| codegen | `backend/codegen/graphql.ts` | regenerate |
| query | `frontend/webapp/src/models/GraphQLQueries.js:646` | add 2 field names |

---

## Out of scope

Deferred to the tile follow-on:

- The three render treatments the model enables (witness portrait with neutral badge;
  `Speaker:` prefix with a "quoting <witness>" note; plain `Speaker:` prefix).
- Replacing the hardcoded `"In his own words"` badge copy at `Witnesses.js:379` with
  gender-neutral wording.
- `.thumb_money_quote` / `.money_quote_attribution` / `.historycard.is-firsthand` styling.
- Test updates in `frontend/webapp/src/views/History/__tests__/Witnesses.render.test.js`.

Also not addressed: the `reception` archive (580 rows) has no `money_quote` at all and its
`metadata` is NULL throughout. The `quote_is_witness_voice` axis has no meaning there —
`principal` is NULL on every row — so extending this model to reception would need its own
design.
