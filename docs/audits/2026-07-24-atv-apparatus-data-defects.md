# ATV apparatus — data defects found by parser audit

**Date:** 2026-07-24
**Scope:** all 4,528 `bom_xtras_commentary` rows with a `<div class='source'>` apparatus block (sources 161–166)
**Method:** the shipping parser primitives (`ATV/parseATV.js` — `scanBrackets`, `trailingSigla`, `isApparatus`, `splitReading`) plus logical-integrity checks, run over untruncated `text`
**Result:** **15 entries** need attention. Everything else parses clean.

**Update (parser Task 5):** the full chain parser (`parseStates`) was later run over all
**11,208 readings** — 2,134 multi-state, max 4 states, **0 threw, 0 leaked codes**. It
surfaced three compound correction codes the vocabulary lacked (§6). No new entry
defects.

---

## Clean bill of health on structure

Zero occurrences across all 4,528 entries of:

- unclosed `[` or stray `]`
- unknown sigla (letters outside `0 1 A`–`T`)
- unbalanced `<em>` tags inside a unit
- empty `[]` units

The format is in far better shape than the old parser's failure rate suggested. Almost every historical breakage traced to parser bugs, not data.

---

## 1. Logically impossible — one witness, two readings (1 entry)

A single witness cannot attest two different readings of the same passage.

| id | unit | fix |
|---|---|---|
| `1446416502` | `[<em>a</em> 01ABCDEFHIJLMNOPQRST\| GHK]` | delete `H` from the first run |

**Confidence: high.** The second reading is `GHK`; the first lists `…EFHIJ…`. Dropping `H` from the first run makes the union exactly 22 witnesses with no duplication. No other edit produces a consistent unit.

```sql
-- 1446416502: 01ABCDEFHIJLMNOPQRST -> 01ABCDEFIJLMNOPQRST
```

---

## 2. Missing witnesses (6 entries)

Skousen's apparatus is exhaustive — every unit accounts for all 22 witnesses. 4,855 of 4,861 units do. These six do not.

**Note on siglum `0`:** 3,202 units omit the Original Manuscript alone. That is *expected* — the OM is only ~28% extant — and is excluded from this list.

### 2a. Confidently repairable

| id | unit | missing |
|---|---|---|
| `1337416402` | `[causes &gt; causeth 0\|causeth &gt;js causes 1\|causeth A\|causes CDEFGHIJKLMNOPQRST]` | **B** (1837) |

**Confidence: high, but confirm against the printed volume.** The Printer's Manuscript reads `causeth >js causes` — Joseph Smith changed it to "causes" while preparing the 1837 edition, which is exactly what siglum `B` is. So `B` almost certainly belongs with "causes":

```sql
-- 1337416402: causes CDEFGHIJKLMNOPQRST -> causes BCDEFGHIJKLMNOPQRST
```

| id | unit | missing |
|---|---|---|
| `1007116101` | `[<em>was</em> 0ABCEFGHIJKLMNOPQRST\|<em>with</em> D]` | **1** (Printer's MS) |

**Confidence: high.** `D` is the lone variant; the first run already carries `0` and every other printed edition. The `1` looks simply dropped:

```sql
-- 1007116101: 0ABCEFGHIJKLMNOPQRST -> 01ABCEFGHIJKLMNOPQRST
```

### 2b. Needs a human with the volume — do not guess

Four units omit **both manuscripts** while accounting for all 20 printed editions. That consistent shape suggests it may be deliberate (Skousen may not cite the manuscripts for a variant that is purely typographic or that arose after 1830) rather than four independent transcription slips.

| id | unit | note |
|---|---|---|
| `1171916201` | `[<em>or even I have not</em> ABCDEFGHIJKLMNOQ\|<em>Or even I have not</em> PS\|<em>nor even have I</em> RT]` | variant is partly **capitalisation** — manuscripts have no consistent capitalisation, so omission may be intentional |
| `1494216501` | `[<em>the</em> ABDEFIJLMNOPQRST\| CGHK]` | omission variant |
| `1567516602` | `[<em>it</em> ABCDEFGHIJKLMNOPQS\| RT]` | omission variant |
| `1633516601` | `[a more ABCDEFGIJLMNOPQRST\|an HK]` | |

If these turn out to be Skousen's convention rather than defects, the corpus-regression baseline (plan Task 8) should record them as known-and-accepted rather than being "fixed".

---

## 3. Single-reading units — **these will render as raw text** (5 entries)

A bracket with no `|` has no disagreement in it, so it is not a variation unit. The new parser's discrimination rule (≥2 parts, every part ending in sigla) correctly rejects them — which means they fall through to the text stream and **render literally in the popup**, e.g. the reader sees `[I 01ABCDEFGHIJKLMNOPQRST]`.

> **This is a behaviour change.** The old parser split on `|`, got one part, and rendered a single pill. The new one shows the raw bracket. Five entries regress visually until the data is fixed.

| id | unit | reading |
|---|---|---|
| `1140516202` | `[ 1ABCDEFGHIJKLMNOPQRST]` | empty content, 21 witnesses |
| `1282416301` | `[I 01ABCDEFGHIJKLMNOPQRST]` | all 22 witnesses — no variation at all |
| `1369916401` | `[requisite 1ABCDEFGHIJKLMNOPQRST]` | **see below** |
| `1489516501` | `[<em>both</em> 1ABCDEFGHIJKLMNOPQRST]` | missing a `0` reading |
| `1625216601` | `[ 01ABCDEFGHIJKLMNOPQRST]` | empty content, all 22 |

**`1369916401` has its own answer inside it.** The same entry contains the well-formed unit twice:

```
[requisites &gt;% requisite 0|requisite 1ABCDEFGHIJKLMNOPQRST]   <- correct
[requisite 1ABCDEFGHIJKLMNOPQRST]                                <- the 0 reading was dropped
```

So the fix is to restore the missing first reading:

```sql
-- 1369916401: [requisite 1ABC…] -> [requisites &gt;% requisite 0|requisite 1ABC…]
```

`1489516501` looks the same shape — it also has a sibling `[<em>both</em> 1A| BCDEFGHIJKLMNOPQRST]`, so the flagged unit is likely missing its `0` reading.

`1282416301` is the odd one: one reading, all 22 witnesses, i.e. universal agreement. Nothing to compare. Either the alternative reading was lost, or the brackets should not be there.

**Alternative to fixing the data:** teach the parser to accept a single-reading unit. Rejected — `[JST]` is also a single "reading" whose content is empty and whose trailing run is all valid sigla, so no rule separates the two without special-casing. Five data fixes are cheaper and more honest than a parser exception.

---

## 4. Malformed markup, already tolerated (1 entry)

| id | problem |
|---|---|
| `1610416602` | nested brackets: `[Benjamin 1ABCDGHK\|Mosiah EFIJLMNOQRT\| Benjamin [Mosiah?] P\|Benjamin {Mosiah?} S]` |

This is one of the two entries that **currently blank the entire app** — the old non-greedy regex closes on the inner `]`. The new balanced scan handles it correctly and no fix is required. Worth noting anyway: the fourth reading uses `{Mosiah?}` where the third uses `[Mosiah?]`, so the braces were presumably the intended convention and the square brackets are the typo.

Optional tidy: `[Mosiah?]` → `{Mosiah?}` in the third reading, making the entry consistent with itself and removing the nesting.

---

## 5. Latent hazard — content that could be eaten as sigla (2 entries)

`trailingSigla` is a pure shape rule: a trailing run of `[A-T01]` is read as witnesses. Any reading whose *content* ends in a bare capitalised word made only of those letters would be misparsed.

Neither instance below is currently broken — both parse correctly — but they show how close the format sits to ambiguity:

| id | reading | why it survives |
|---|---|---|
| `1247516301` | `THE BOOK OF ALMA / THE SON OF ALMA ABCDEFGHIJKLMNOPQRST` | "ALMA" is entirely valid sigla (A, L, M, A); only the real trailing run being separated by a space saves it |
| `1140516202` | `<em>10</em> IJLMNOPQRST` | content "10" is the two manuscript sigla; the `</em>` blocks the regex |

**No action needed.** Recorded so that whoever edits these entries knows that removing the `<em>` wrapper from `1140516202`, or the trailing sigla from `1247516301`, would silently produce a wrong parse rather than an error. The corpus regression (plan Task 8) is the guard.

---

## Repair summary

| priority | class | entries |
|---|---|---|
| **1** | renders as raw text today | `1140516202` `1282416301` `1369916401` `1489516501` `1625216601` |
| **2** | logically impossible | `1446416502` |
| **3** | missing witness, confident fix | `1007116101` `1337416402` |
| **4** | missing manuscripts, verify first | `1171916201` `1494216501` `1567516602` `1633516601` |
| — | tidy only, no impact | `1610416602` |
| — | latent, no action | `1247516301` `1140516202` |

Priorities 1–3 are eight entries with inferable fixes. Priority 4 needs someone with Skousen's volume.

## 6. Vocabulary gaps found by the chain parser

Running `parseStates` over every reading surfaced three **compound correction codes** not
in Skousen's glossed legend, each appearing once. The parser handled them correctly —
surfacing the code with a `null` label rather than mislabelling it — but an unglossed
correction is the P7 defect this refactor exists to prevent, so they were added to
`apparatus.js` with editorial wording (composed from the single-code glosses, marked
editorial like `%?`/`%+`):

| code | form in corpus | gloss (editorial) | count |
|---|---|---|---|
| `p–` | `&gt;p&ndash;` | correction in pencil, less ink | 1 |
| `–?` | `&gt;&ndash;?` | change w/ less ink, uncertain | 1 |
| `+?` | `&gt;+?` | change w/ more ink, uncertain | 1 |

Not a data defect — the codes are legitimate; the vocabulary was incomplete. Bare markers
followed by a word beginning with a code letter (`&gt; you`, `&gt; own`, `&gt; son`) are
correctly parsed as bare, not as codes, because the parser matches the whole
whitespace-delimited token, not a prefix.

## Reproducing this audit

The audit script is `scratchpad/audit.mjs` (session-local). It imports the shipping parser directly, so it stays honest as the parser evolves — re-run it after plan Task 6 lands `parseApparatus`, and fold the counts into the Task 8 corpus regression baseline. Requires an **untruncated** dump: 929 entries (20.5%) exceed 4,000 characters, the longest running 24,889.
