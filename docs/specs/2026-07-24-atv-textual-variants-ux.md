# Textual Variants (ATV) — parsing rewrite + facsimile integration

**Date:** 2026-07-24
**Status:** Proposal — adversarially reviewed 2026-07-24, corrections applied (§10)
**Surfaces:** `views/_Common/ATV.js`, `views/_Common/Commentary.js`, `views/Home/tiles/CommentaryTile.js`
**Depends on:** `docs/specs/2026-07-24-db-derived-fax-version-list.md`, `docs/bugs/2026-07-23-fax-1920-wrong-source-scan.md`

---

## 1. The idea in one sentence

Royal Skousen's sigla — `0`, `1`, `A`–`T` — name the same printed editions we already
scan, index at verse level, and can crop on demand via `/fax/render`. A reader hovering
the reading `is BCDEFGHIJKLMNOPQRST` should be able to see the 1837 page where that
reading first appears, not a semicolon-run of twenty years.

---

## 2. Current state

### 2.1 The data

Skousen's *Analysis of Textual Variants* lives in `bom_xtras_commentary` as sources
**161–166** (`skousen-atv-1` … `-6`, all `source_rating='G'`, `source_lang='en'`).
**4,528 entries** carry a variant apparatus, spanning **3,160 distinct verses**.

Each entry's `text` opens with a `div.source` block holding the apparatus, followed by
`div.analysis` with the prose:

```html
<div class='source'>
  and I know that the record which I make
  [<em>to be</em> &gt; js <em>is</em> 1|<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST]
  <em>true</em>
</div>
<div class='analysis'>…</div>
```

Grammar, as far as the data actually goes:

- `[` … `]` — one variation unit
- `|` — separates competing readings
- each reading ends in a **sigla run** (`[A-Z01]+`) naming its witnesses
- `NULL` or empty reading content = that witness omits the text
- `>` + code (`>js`, `>jg`, `>+`, `>–`, `>%`, `>p`, `>b`, `>+–`) = an in-document
  correction, i.e. the reading changed *within* that one witness
- `𝒪①`/`𝒪②` (`&#120034;&#9312;`) mark supralinear insert layers in the manuscripts

Measured across all 4,528 entries with a **balanced-bracket** scan and the discrimination
rule in §6.1.1: **4,861 variation units in the header block, 3,483 more in the prose
body, 11,207 readings in the header.**

> **Two counts appear in the history of this document.** An earlier pass reported 4,866
> units / 11,212 readings. That was the *current buggy parser's* output — `ATV.js`'s
> non-greedy `/\[([^]+?)\]/g`, which mis-splits the nested-bracket entry and over-counts
> by 5. Every figure in this spec now comes from the balanced scan. Where a number
> describes today's broken behaviour (P1, P2, P5) it says so explicitly.

### 2.2 Surface A — the commentary popup

`Commentary.js:301-304` pulls the first `.source` element out of the entry, strips it
from the body, and hands it to `ATVHeader` (`Commentary.js:423`), which renders above
the prose. `ATV.js` turns each reading into a `<span class="atv-string" data-tip="…">`
pill and mounts one `<ReactTooltip id="atv-tooltip">` for the block.

### 2.3 Surface B — the home sampler tile

`CommentaryTile.js:27` does:

```js
const text = stripTags(data?.text || data?.preview);
```

`stripTags` (line 12) replaces every tag with a space. So an ATV entry sampled into the
home feed renders the apparatus as **unstyled plain text** — no pills, no tooltips, and
even the `<em>` that distinguishes a reading from surrounding prose is gone:

> and I know that the record which I make [to be > js is 1|to be A|is BCDEFGHIJKLMNOPQRST] true For the second (1837) edition, Joseph Smith replaced…

This is not rare. The sampler's gate is `rating='G' AND lang='en' AND is_note != 1 AND
CHAR_LENGTH(text) > 500`, which ATV entries pass. **4,419 of the 29,095 eligible
commentaries are ATV — 15.2%.** Roughly one commentary tile in six.

---

## 3. Problems, ranked

Everything below was verified against the live database by replaying `ATV.js`'s own
parsing over all 4,528 entries.

### P1 — Two entries crash the app

`ATV.js:58` does `i.match(/[A-Z01]+$/)[0]` with no null guard. Two entries return null:

| id | apparatus | why |
|---|---|---|
| `1080616101` | `[thing &gt;js NULL 1 \|thing A\| BCDEF…]` | trailing space before the `\|`, so the anchored regex misses |
| `1610416602` | `[Benjamin 1ABCDGHK\|Mosiah EFIJLMNOQRT\| Benjamin [Mosiah?] P\|…]` | **nested brackets** — the non-greedy `/\[([^]+?)\]/g` closes on the inner `]` |

There are **no error boundaries anywhere in the app** (no `componentDidCatch` /
`getDerivedStateFromError`), so either one blanks the entire page, not just the header.

### P2 — 136 readings render corrupted text

`ATV.js:59` strips the sigla with `i.replace(indexes, "")` — a **string** argument, so
`replace` kills the *first* occurrence, not the trailing one. 136 readings
contain their own sigla substring earlier in the content:

| id | reading | renders as |
|---|---|---|
| `1022316101` | `" And it came to pass that A"` | **"nd it came to pass that A"** |
| `1005916101` | `"&#120034;① ∅ >– &#120034;② of the Lord 0"` | entity mangled → `&#12034;` |

The `𝒪①/𝒪②` manuscript-layer entities break every time the sigla run is `0`.

### P3 — The apparatus is invisible in the home tile

Section 2.3. 15.2% of sampled commentary.

### P4 — Mid-prose apparatus gets no treatment at all

**1,028 of the 4,528 entries (22.7%)** carry additional apparatus inside `.analysis` —
**3,483 units**, up to 28 in a single entry —
Skousen quoting parallel passages, almost always in a `<ul><li>` cross-reference list.
Only the leading `.source` block is parsed. So within one popup the same notation gets
two completely different treatments, and the scripture reference above each untreated
example *is* linkified, which makes the raw brackets underneath look more broken.

### P5 — Tooltips are the wrong container

- 40% of readings (4,489 of the current parser's 11,212) produce a tooltip over 100
  characters. Longest is
  **176 chars, 22 witnesses** (`1282416301`): *"Original Manuscript (𝒪); Printer's
  Manuscript (𝓟); 1830; 1837; 1840; 1841; 1849; 1852; 1858W; 1874R; 1879; 1888; 1892R;
  1902; 1905; 1906; 1907; 1908R; 1911; 1920; 1953R; 1981"*
- No `multiline` prop, no `max-width` — not in react-tooltip v4's styles, not in
  `Main.css:388`, not in the dark-mode sheet. One unwrapped ~900px line, `place="top"`,
  anchored inside a **draggable** popup the user may have moved to a screen edge.
- A list of 22 years is a list, not a sentence.

### P6 — Tooltips likely go dead on tab switch

react-tooltip v4 binds once at mount via `document.querySelectorAll('[data-tip][data-for=…]')`
(`dist/index.js:2521`, `2600-2626`). New `[data-tip]` nodes need `ReactTooltip.rebuild()`.
Its MutationObserver only tracks *removal* to auto-hide. `Feed.js:199` and
`Community.js:429` both call `rebuild()`; **`ATV.js` never does**, and the
`<ReactTooltip>` stays mounted while the pills under it are replaced.

**1,008 verses have 2+ ATV entries** (one has 7), so tab-switching between two ATV
entries in the same popup is routine. Needs a browser check to confirm which cases
survive React node reuse, but the binding path is unambiguous.

### P7 — Two-thirds of the reference data is never rendered

`key[l][1]` — a full provenance paragraph for every witness — has **zero readers**.
So does every descriptive string in `changes`: `>js` and `>%` both collapse to a bare
`⮕`, losing "corrected by Joseph Smith" vs. "change w/ erasure of the original ink".

### P8 — Unguarded sigla lookup, and a worse failure than a crash

`key[l][0]` assumes every letter is in the table. The regex `[A-Z01]+` accepts `U`–`Z`,
which aren't keys, so an unknown letter is a TypeError.

Measured: **no entry uses `U`–`Z`**, so the crash is latent. But the real hazard once
the parser runs over prose brackets (P4) is *quieter*. A bracket like `[JST]` does not
crash — `J`, `S` and `T` are all **valid sigla** — it parses as an empty reading attested
by 1888, 1953R and 1981. A silent, confident misparse presented as scholarship, which no
"warn on unknown sigla" rule can catch.

That is why §6.1.1 discriminates on *shape* (every `|`-part must end in sigla) rather
than trusting individual letters. Verified against the corpus: 0 false positives in
header blocks, 13 in prose bodies — all genuinely non-apparatus, e.g. `<em>a|o</em>` in
entry `1023516101` (a spelling note, not a variation unit).

*(An earlier draft of this section cited `[sic]` and `[JST]` as examples found in the
data. Neither string occurs in any ATV entry — 0 hits for both. The hazard is real; those
illustrations were invented. Corrected.)*

### P9 — Theme inconsistency

`ATV.js` ignores `tooltipTheme()` from `utils/themeColors.js`, unlike `Community.js:233-235`
and `PersonPlace.js:103-105`.

Scope, measured: **19 files render `<ReactTooltip>`; only 4 consume `tooltipTheme`**
(`Community.js`, `Page.js`, `PersonPlace.js`, `TextContent.js`). So this is an
app-wide inconsistency that ATV happens to share, not an ATV-specific defect. Fix ATV's
new components properly; do not use this as a justification to touch the other 14.

---

## 4. What we already have to build on

30+ commits from 2026-07-18 in `backend/src/media/fax/`:

| Endpoint | What it gives us |
|---|---|
| `/fax/render/{version}/crop/w{width}/{selector}.jpg` | tight crop of a passage from that edition's scan, with exterior-notch paper-fill so neighbouring verses are erased (`4299a5c9`) |
| `/fax/render/{version}/page/w{width}/{selector}.jpg` | full page, dimmed except the passage (`fe68b958`) |
| `/fax/boxes/{version}/{selector}` | box coords as JSON (`8842db15`) |

Plus S3 write-back, request coalescing, 301 canonical redirects and rate limiting
(`92ff8fa1`, `bbf52e86`, `037be667`).

**The precedent component already exists.** `FaxVerseTile` stacks up to four
cropped-verse images of the same verse across different editions (`225111d1`,
`eb2bc3d6`):

```js
`${renderBaseUrl}/fax/render/${ed.version}/crop/w${CROP_WIDTH}/${selector}.jpg`
```

That is structurally the widget the ATV pill needs — driven by sigla instead of by a
sampler.

The join is clean: `bom_xtras_commentary.verse_id` ↔ `bom_xtras_fax_index.verse_id`.
All 3,160 ATV verses have box geometry in **every one of the 10 sigla-mapped editions**.

Note the narrower claim. Coverage is *not* universal across all 22 index versions:
`poetic` covers 6,597 of 6,604 verses and only 3,156 of the 3,160 ATV verses. It isn't
one of ours, but the invariant is a property of the data, not of the schema — see the
runtime rule in §6.5.

---

## 5. Siglum → facsimile edition map

| Siglum | Skousen | fax version | Geometry | Note |
|---|---|---|---|---|
| `0` | Original MS (𝒪) | — | ❌ | label-only — see §5.1 |
| `1` | Printer's MS (𝓟) | `printer` | ✅ | **not `1829`** — see §5.1 |
| `A` | 1830 Palmyra | `1830` | ✅ | |
| `B` | 1837 Kirtland | `1837` | ✅ | |
| `C` | 1840 Nauvoo | `1840` | ✅ | |
| `D` | 1841 Liverpool | `1841` | ✅ | |
| `E` | 1849 | `1849` | ❌ | scan exists, no index rows |
| `F` | 1852 | `1852` | ❌ | scan exists, no index rows |
| `G` | 1858W | `1858` | ❌ | scan exists, no index rows |
| `H` | 1874R | `1874r` | ❌ | scan exists, no index rows |
| `I` | 1879 | `1879` | ✅ | |
| `J` | 1888 Juvenile Instructor | `1888d` | ✅* | **placeholder** — `1888d` is the Deseret News printing (§5.2) |
| `K` | 1892R | `1892` | ❌ | scan exists, no index rows |
| `L` | 1902 Kansas City | `1902` | ❌ | scan exists, no index rows |
| `M` | 1905 Chicago | `1905` | ❌ | scan exists, no index rows |
| `N` | 1906 | `1906` | ❌ | scan exists, no index rows |
| `O` | 1907 vest-pocket (DSSU) | `1907` | ✅* | **placeholder** — `1907` is titled "Deseret News" (§5.2) |
| `P` | 1908R | `1908r` | ❌ | scan exists, no index rows |
| `Q` | 1911 Chicago | `1911` | ❌ | scan exists, no index rows |
| `R` | 1920 | `1920` | ⚠️ | renders, but wrong source scan — see `docs/bugs/2026-07-23-fax-1920-wrong-source-scan.md` |
| `S` | 1953R | `1953R` | ❌ | scan exists, no index rows |
| `T` | 1981 | `1981` | ✅ | |

**10 sigla renderable (2 as placeholders), 1 label-only, 11 have a scanned edition but
no boxes.**

### 5.1 `1829` is abandoned — use `printer` for siglum `1`

`1829` and `printer` are the **same printer's-manuscript scans**. Confirmed: pages
`001.jpg` and `050.jpg` return byte-identical `content-length` from
`media.bookofmormon.online` under both paths. They differ only in geometry, and `1829`'s
geometry is an **abandoned legacy pass** authored against an old microfiche capture
(confirmed by KC, 2026-07-24). It is superseded by `printer` and is not to be revived:

| version | recorded `pageWidth` (pp. 1 / 50 / 200) | served scan width | aligns? |
|---|---|---|---|
| `printer` | 2000 / 2000 / 2000 | 2000 | ✅ exact |
| `1829` | 2440 / 2569 / 2508 | 2000 | ❌ variable, 22–28% over |

`render.ts` maps authored coordinates to scan pixels with a single isotropic
`k = servedScanWidth / pageScale(700)`, which is only correct when the served scan
matches the authoring scan's aspect. `printer` matches exactly; `1829` was captured at a
variable width that no served asset has, so `/fax/render/1829/…` — live today via
`VERSION_SLUGS` — returns misaligned crops.

Consequences:

- Siglum `1` (Printer's Manuscript) → **`printer`**, never `1829`.
- Siglum `0` (Original Manuscript) → **label-only, no image.** `bom_xtras_fax.original`
  is 172 pages (the OM is ~28% extant), but its `indexRef` points at `1829` — 463 pages
  covering all 6,604 verses, which is printer's-manuscript territory. So anything that
  follows `indexRef` for the OM lands on abandoned geometry for the *wrong manuscript*.
  Do not follow `indexRef`; hardcode the witness map.
- **`1829` should leave the renderable set.** It is abandoned, not broken-and-fixable, so
  there is nothing to re-author. Note the conflict flagged in §5.3.

### 5.2 `J` and `O` ship as placeholders

Accepted: `1888d` (Deseret News) stands in for Skousen's 1888 Juvenile Instructor, and
`1907` (Deseret News) for the 1907 DSSU vest-pocket. Both are contemporaneous printings
of the same text, so the reading shown will almost always be the reading Skousen cites.

**Labelling rule:** the popover must caption the crop with the *scan's* actual title, not
Skousen's edition name. Showing a Deseret News page under the heading "1888 Juvenile
Instructor" would be a fabricated citation in a product whose whole value is
primary-source fidelity. Carry an `exact: boolean` on each witness-map entry; when
`exact === false`, the popover renders the siglum label as the heading and the scan title
beneath it as *"nearest available scan: 1888 Deseret News printing"*.

### 5.3 Prerequisites this map depends on

1. **`VERSION_SLUGS` blocks 9 indexed editions.** `1881, 1883d, 1885, 1888d, 1898,
   1907, 1918, 1921, 1923` have 63,829 geometry rows and return `400 unknown version`.
   `docs/specs/2026-07-24-db-derived-fax-version-list.md` already specs the fix. **This
   gates `1888d` and `1907`** — two of our ten.
2. **1920 serves the wrong scan generation** (aspect 0.715 vs. authored 0.667), so boxes
   drift 1–2 lines and bottom-of-page fragments land on the footnote band. One-value DB
   change, not applied.

3. **The db-derived allowlist rule would keep `1829` alive.**
   `docs/specs/2026-07-24-db-derived-fax-version-list.md` defines renderable as *"has
   rows in `bom_xtras_fax_index`"*, and its acceptance list requires (line 149) *"All 13
   previously-working versions still render, `1829` among them."* That spec was written
   before `1829` was known to be abandoned. Implementing it as written re-blesses an
   edition that renders misaligned. **Resolve before Phase 0:** either delete the 7,044
   `1829` rows from `bom_xtras_fax_index` (making the derivation rule correct as stated),
   or add an explicit deny-list and amend that spec's checklist. Deleting the rows is
   cleaner — it keeps "the geometry table is the registry" true with no exceptions.

   Not a blocker for the ATV work; nothing here references `1829`.

A guardrail worth adding while in this code: assert at boot that every renderable
version's `bom_xtras_fax_index.pageWidth` matches its served scan width. Two of the three
drift cases found so far (1920, 1829) would have failed loudly instead of shipping
crooked boxes.

Prerequisites 1 and 2 gate `1888d`, `1907`, and correct `1920` boxes — 3 of the 10
renderable sigla. The other 7 work today.

---

## 6. Proposed architecture

### 6.1 Split parsing from rendering

Today `ATV.js` builds an HTML string and hands it to `html-react-parser`. That is the
root of P1, P2 and P8: string surgery with no error surface and no test seam.

Replace with a pure parser module returning data:

```js
// views/_Common/ATV/parseATV.js  — no React, no DOM, fully unit-testable

parseApparatus(html) -> {
  ok: boolean,
  segments: Array<
    | { kind: 'text', text: string }
    | { kind: 'unit', readings: Reading[] }
  >,
  warnings: string[],           // never throws
}

Reading = {
  states: State[],              // >= 1; length > 1 means an in-document correction chain
  sigla: string[],              // ['B','C','D',…]
}

State = {
  content: string,              // HTML fragment; sigla and correction codes removed
  omitted: boolean,             // NULL / empty -> render ∅
  via: {                        // how this state was reached; null on states[0]
    code: string,               // '>js'
    label: string,              // 'corrected by Joseph Smith'
  } | null,
}
```

**A reading is a sequence of states, not a string plus a flag.** This is the correction
that matters most in the model. Measured over the header blocks: **2,001 readings carry
one correction code and 100 carry two or more.** Real examples:

```
of  >js  NULL  >js  of      1     present -> omitted -> present
NULL >+ read it >% read     1     absent -> 'read it' -> 'read'   (three states)
beheld > headed > NULL      1     ends in omission
```

A single `omitted: boolean` cannot express `of → ∅ → of`, and a single flat `content`
string gives the modal no split point to render `to be ⮕ is`. Both are things §6.4
promises to display and P7 promises to stop discarding, so the model has to carry them.
`states[0]` is the original reading; each later state records the code that produced it.

#### 6.1.1 Telling an apparatus bracket from an ordinary one

Required before P4 (prose-body units) can be parsed at all — prose contains brackets that
are not variation units.

> **Rule:** a bracket group is a variation unit iff it splits on `|` into **≥ 2 parts**
> and **every part ends in a run of characters drawn from `[01A-T]`**.

Shape, not letters — because `[JST]` is composed entirely of *valid* sigla and would
otherwise misparse silently (P8).

Verified against all 4,528 entries: the rule accepts 4,861 header units and 3,483 body
units, and rejects **0 piped brackets in header blocks and 13 in prose bodies**. All 13
are correctly rejected (e.g. `<em>a|o</em>` in entry `1023516101`, a spelling note).

**CI implication.** The invariant is *"zero warnings in header blocks"*, which holds at
0 today. It is **not** "zero warnings anywhere" — prose bodies legitimately contain
piped brackets that are not apparatus, and asserting zero there would fail the moment
Phase 2 widens scope. Assert the header count exactly; assert the body *rejection* count
against a recorded baseline of 13 so a regression in the rule shows up as a diff.

Other rules that fix the measured defects:

- **Never throw.** A reading with no trailing sigla becomes
  `{ sigla: [], warnings: [...] }` and renders as plain text. Fixes P1.
- **Strip sigla positionally**, not by `String.replace`: `part.slice(0, part.length - sigla.length)`.
  Fixes P2 (all 136).
- **Trim before matching**, so `"… 1 "` still parses. Fixes half of P1.
- **Balanced bracket scan**, not a non-greedy regex, so `[Benjamin [Mosiah?] P]` nests
  correctly. Fixes the other half of P1 — and is what the corpus counts in this spec were
  re-derived with.
- **Unknown sigla letters** are dropped with a warning rather than dereferenced. Fixes the
  crash half of P8; §6.1.1 handles the silent half.

Ship it with a fixture-driven test that replays **all 4,528 entries** and asserts the
header-warning count is 0 and the body-rejection count is 13, then guards both in CI.
That is how these defects were found; it should be how they stay fixed.

### 6.2 One renderer, both surfaces

```
views/_Common/ATV/
  parseATV.js          pure parser (above)
  witnesses.js         the sigla table + fax version map + provenance text + `exact` flag
  ATVApparatus.jsx     renders parsed segments -> pills; `variant` prop
  WitnessPeek.jsx      hover card, one crop (§6.4 tier 1)
  VariantCompare.jsx   modal, whole unit across editions (§6.4 tier 2)
  ATVApparatus.scss
  __tests__/
```

`ATVApparatus` takes `{ segments, verseId, variant }` where `variant` is:

| variant | Used by | Behaviour |
|---|---|---|
| `full` | `Commentary.js` header unit | pills, minimal hover peek + click-to-open modal (§6.4) |
| `inline` | `Commentary.js` prose-body units | same pills, tighter type, no border box; modal without crops until the cited ref is resolved (§6.4) |
| `compact` | `CommentaryTile.js` | leading unit only, pills, **no** peek or modal (§6.6) |

Gap handling (§6.5) is shared by all three.

This is what makes P3 and P4 the same fix rather than three fixes.

### 6.3 What a verse-level crop actually is — measured

Verse-level is what we have and what we ship. The design question is what container it
fits in, and that turns out to be an empirical question with a clear answer.

**Measured against the real render path, not against raw boxes.** A crop is not one box:
`toFragments` (`geometry.ts:81`) clusters a verse's boxes into columns and merges
vertical runs, `render.ts:129-137` downscales each fragment to the target width (never
upscaling), and `stitchVertical` composes them — so a crop's height is the **sum of its
fragments' rendered heights**, and merged runs span the gaps between boxes. Numbers below
come from replaying that pipeline over the 27,744 boxes covering the 3,160 ATV verses in
the 8 solid editions, yielding **25,280 crops** (verse × edition).

Median rendered height at `w400`:

| edition | median | p90 |
|---|---|---|
| `1879` | 62 px | 89 px |
| `printer` | 68 px | 103 px |
| `1830` | 79 px | 114 px |
| `1840` | 81 px | 124 px |
| `1841` | 82 px | 130 px |
| `1837` | 86 px | 136 px |
| `1981` | **161 px** | **270 px** |
| `1920` | **183 px** | **293 px** |

Pooled distribution:

| height | share |
|---|---|
| ≤ 60 px | 21.1% |
| 61–100 px | 41.4% |
| 101–160 px | 22.1% |
| 161–260 px | 12.1% |
| > 260 px | **3.2%** |

**62.5% of crops are ≤100px tall; 84.6% are ≤160px.** For the six single-column editions
these are horizontal strips — one to four lines of type, not page images.

**The two double-column editions are a different shape and must be designed for.** `1920`
and `1981` have median heights of 183px and 161px, with p90s near 300px, because the
column is half the page width. A hover card sized for `printer` (68px median) will not
hold a `1920` crop. Either the peek sizes to content up to a hard cap, or the two
double-column editions default to the modal.

For scale: the tooltip we're replacing renders a 176-character witness list as one
unwrapped line roughly **900px wide**. A 400×70 strip of the actual 1837 page is
*smaller than the text it replaces*, and answers a question the text can't.

That flips my earlier recommendation against hover — for six of the eight editions
cleanly, and for the other two with a size rule.

### 6.4 Hover is minimal; the modal is the drilldown

The division of labour, stated once and applied everywhere:

> **Hover shows one thing. The modal holds everything else.**

That covers three separate "what about the rest?" questions with one rule — the other
witnesses, the other readings, and the entry's secondary variation units all live in the
modal.

#### How much "rest" there is

Variation units per entry, measured over all 4,528:

| units in the `.source` header | entries | | units in the prose body | entries |
|---|---|---|---|---|
| 0 | 500 (11%) | | 0 | 3,500 (77%) |
| **1** | **3,406 (75%)** | | 1 | 389 (9%) |
| 2 | 494 (11%) | | 2 | 203 (4%) |
| 3–5 | 120 (3%) | | 3–5 | 256 (6%) |
| 6+ | 8 (<1%) | | 6+ | 180 (4%) |

**75% of entries have exactly one leading unit**, and 77% have no prose-body units at
all. So the leading unit is nearly always the whole story — which is what makes
"leading inline, rest in the modal" cheap rather than lossy.

The tail is larger than it looks, though: **1,028 entries (22.7%) carry 3,483 body units
between them, up to 28 in one entry.** Body units outnumber the header units in those
entries by roughly 3:1, so Phase 2's scope is set by this column, not the left one.

> An earlier draft reported 943 entries / 2,580 units / max 18 here, and 1,006 entries in
> P4. Both were undercounts from a corpus dump truncated at 4,000 characters — **929
> entries (20.5%) exceed that, the longest running 24,889 characters.** Re-derived on
> full text with the §6.1.1 rule. Any future measurement of this corpus must not truncate.

#### Tier 1 — hover peek (minimal)

One crop, one line of label, the reading. Nothing else. ~400px wide, ~90–150px tall.

```
┌────────────────────────────────────────────────┐
│ ┌────────────────────────────────────────────┐ │
│ │  [crop — 1837, w400, ~70px tall]           │ │
│ └────────────────────────────────────────────┘ │
│ 1837 Kirtland  ·  +18 later editions      ⤢    │
└────────────────────────────────────────────────┘
```

- **Which edition.** The **earliest witness with geometry** — where the reading enters
  the text.
- **No witness list.** "+18 later editions" is a count and an affordance, not an
  enumeration. This is what actually kills P5: the 900px line doesn't get wrapped, it
  gets removed from hover entirely.
- **No provenance paragraph, no correction detail.** Both are modal content.
- **Open delay** 250 ms; prefetch the unit's crops on first hover of any pill in it, so
  moving between readings is instant. Crops are S3 write-back-cached by the render
  pipeline, so this is cheap after first view.
- **Touch:** no hover tier. Tap opens the modal.
- **Aspect guard.** If the **stitched crop** is narrower than **2:1** — measured at
  **9.7% of the 25,280 crops**, concentrated in `1920` and `1981` — **show no crop**; the
  label line alone, with the expand affordance. Do not scale a tall crop to fit; do not
  `object-fit: cover` it, since the cropped-away region may contain the variant.

  *(An earlier draft put this at ~3%, having reused the ">260px" bucket as a proxy for
  the 2:1 threshold. Those are different thresholds. Roughly one peek in ten falls back
  to the label-only card, not three in a hundred — design the label-only state as a
  first-class case, not an edge case.)*
- **No geometry** (E, F, G, H, K, L, M, N, P, Q, S, `0`): label line only, no image, no
  empty frame. Degrade, don't apologise.

#### Tier 2 — the modal (everything)

Click any pill, or the expand affordance, to open the **whole variation unit** — all
readings, all witnesses with geometry, stacked chronologically — plus navigation to the
entry's other units.

```
┌──────────────────────────────────────────────────────────┐
│  1 Nephi 1:3                                          ×  │
│  ────────────────────────────────────────────────────────│
│  "to be"  /  "is"                                        │
│                                                          │
│  𝓟  Printer's Manuscript                                 │
│  [crop]                             to be  ⮕  is         │
│  Corrected in the manuscript by Joseph Smith             │  <- changes[] text, finally
│                                                          │
│  1830 Palmyra                                            │
│  [crop]                                        to be     │
│  The first edition, published in Palmyra, New York;      │  <- key[l][1], finally
│  printed by E. B. Grandin…                               │
│                                                          │
│  1837 Kirtland                                           │
│  [crop]                                           is     │
│  + 18 later editions follow 1837    [show all ▾]         │
│                                                          │
│                              View 1837 full page →       │
└──────────────────────────────────────────────────────────┘
```

This is the payoff: the reading changing across editions, in the primary sources, in one
view. It's the `FaxVerseTile` stack (`225111d1`) driven by sigla instead of by a sampler.

- **Opens scrolled to the clicked unit**; the entry's other units follow below in
  document order. One scrolling column, no pager, no tabs — the drilldown for the 25% of
  entries with more than one unit is just "keep scrolling".
- **Collapse runs.** Nineteen consecutive editions carrying the same reading render as
  one representative crop plus *"+ 18 later editions follow 1837"*, expandable. Never
  nineteen identical strips.
- **Provenance and correction text live here** — `key[l][1]` and the `changes` strings,
  both currently unrendered (P7). The modal is the only surface with room for them.
- **Tall and multi-fragment crops are fine here** — the modal scrolls. **216–424 ATV
  verses per edition (6.8–13.4%)** have multiple boxes where the verse spans a column or
  page break; `toFragments`/`clampPages` already stitch them. *(An earlier draft said
  437–787 / 12–23%; that counted multi-box verses across all 6,604 verses while
  expressing the result as a share of the 3,160 ATV verses.)*
- **Placeholder witnesses** (`J`, `O`) caption with the scan's real title per §5.2.

**Why not one tier.** Hover-only can't carry 22 witnesses or answer "when did it change?",
which needs the *other* readings. Modal-only puts a click in front of the 68% case where
one strip settles it.

#### Prose-body units resolve to a *different* verse

A trap worth naming. The 3,483 prose-body units are Skousen quoting **parallel passages
from other verses** — entry `1001316103` is about 1 Nephi 1:14 but quotes 1 Nephi 2:11,
16:22 and 16:35. Rendering a crop for those using the commentary's own `verse_id` would
show the **wrong scan** with total confidence.

So, staged:

- **Phase 2** styles prose-body units as pills — readable formatting, no crops. That
  alone discharges P4.
- **Crops for body units** need the cited reference resolved from the enclosing `<li>`
  text via `scripture-guide`'s `lookupReference`, the same path `useFaxHighlight` already
  uses. Feasible, but it needs its own accuracy pass before any image is shown. Until
  then body-unit pills open the modal **without** crops, showing readings and witnesses
  only.
- Never fall back to the entry's `verse_id` for a body unit. A wrong scan is worse than
  no scan.

**Container:** both tiers are React components — `WitnessPeek.jsx`, `VariantCompare.jsx` —
not react-tooltip. Sidesteps P5 and P6 entirely: React children, no DOM scan to rebuild.
The modal must render in a portal above the draggable commentary popup.

**Crop width:** `w400`, `w800` for retina `srcset`, both in `WIDTH_WHITELIST`.

**Selector:** for **header** units, the ATV entry's own `verse_id` → canonical selector,
same as `FaxVerseTile`. For **body** units, see the trap above — resolve the cited
reference or show no crop.

**Mitigating verse-level granularity:** put the reading's own text beside the crop (as in
the sketches above) so the eye knows what to hunt for in the strip. At one to four lines,
that's a short hunt.

### 6.5 Coverage gaps

#### The gap is never total — measured

Replaying the apparatus over all 4,861 header units against the 10 renderable sigla:

| | count | share |
|---|---|---|
| Units where **every** reading is illustrable | 3,351 | 68.9% |
| Units where **some** readings are illustrable | 1,510 | 31.1% |
| Units where **no** reading is illustrable | **0** | **0.0%** |
| Readings with a renderable witness | 9,649 / 11,207 | 86.1% |
| …dropping the `J`/`O` placeholders | 9,548 / 11,207 | 85.2% |

**No variation unit is ever completely dark.** That falls out of the source: Skousen's
apparatus is *exhaustive* — every unit accounts for all 22 witnesses — so `A`, `B`, `C`,
`D`, `I`, `R` and `T` each appear in essentially all 4,861 units, distributed across that
unit's readings. Whatever else is missing, something can always be shown.

So the design problem is never "this variant has no facsimile." It is always **"this
particular reading has no facsimile,"** inside a unit where other readings do. That makes
the answer a *row state*, not a special screen.

Also worth noting: only **101 units** depend on `J` or `O` for their only illustration.
If the placeholder decision (§5.2) is ever reversed, the blast radius is 101 units, not
thousands.

#### Four kinds of gap, four treatments

**1. Witness has a scan but no verse geometry** — the 11 sigla `E F G H K L M N P Q S`,
about 1,558 readings (13.9%). The edition is real and scanned; we just can't locate the
verse on the page.

> Render the reading and its witness list in its correct chronological slot, with the
> image slot **collapsed** — not an empty frame, not a placeholder graphic. One muted
> line: *"Not yet indexed for this edition."*

No deep link. `/fax/{version}/{ref}` needs geometry to find the page, and `pgoffset`
interpolation would be a guess dressed as a citation. Say nothing rather than guess.

**2. Siglum `0` — the Original Manuscript** — cited in **1,655 of 4,861 units (34%)**,
which tracks the manuscript being ~28% extant. When Skousen cites `0`, the leaf
*survives*; we simply have no boxes for `original`, and its `indexRef` points at
abandoned `1829` geometry for the wrong manuscript (§5.1).

This deserves its own copy, because "not indexed" and "does not survive" are different
claims and a scholarly reader will notice:

> *"Original Manuscript — reading attested; page image not yet indexed."*

Never imply the manuscript is lost at a point where Skousen cites it.

**3. Omission readings (`∅`)** — 2,306 readings (20.6%). **This is not a gap.** The
witness is often perfectly renderable; the reading is that the words *aren't there*.

> Show the crop. Caption it *"these words do not appear."*

The image is the evidence — the reader sees the line running straight past where the
phrase would be. Suppressing crops for `∅` readings would throw away one of the better
things this feature does.

**4. Runtime failure** — render 404/502, missing scan page, box clipped out of bounds.

> `onError` collapses the image slot, exactly as `CommentaryTile.js:86` already does
> (`e.target.style.display = "none"`). Fall through to treatment 1's muted line. Never a
> broken-image glyph, never a retry spinner in a hover card.

#### Principles behind all four

- **Absence of an image is not an error state.** No empty frames, no grey placeholder
  rectangles, no "image unavailable" iconography. The row just has no picture.
- **Never substitute.** No nearest-edition stand-in, no interpolated page number. The one
  sanctioned substitution is `J`/`O`, and it is labelled as such (§5.2).
- **Say why once, quietly, and only in the modal.** The hover peek shows a crop or shows
  nothing; it never explains itself in a 400px card.
- **Defend the coverage assumption at runtime.** This spec assumes each renderable
  version indexes all 6,604 verses — true today for all of ours, but `poetic` already
  covers only 6,597, so the invariant is not structural. Treat a missing box as
  treatment 1, not as an exception.

### 6.6 CommentaryTile — leading unit only

Same rule, tightest form: **the leading unit renders, nothing else does.**

1. Stop calling `stripTags` on ATV entries. Detect an apparatus (the parser's `segments`
   containing a `unit`) and render `<ATVApparatus variant="compact">` for the **first
   unit only**; plain excerpt for the rest of the entry.
2. Secondary and prose-body units are **dropped from the tile**, not truncated
   mid-notation. A half-rendered `[to be A|is BCDEF…` is worse than none.
3. If the entry has more units, the existing **"View in context"** link
   (`CommentaryTile.js:91` → `/commentary/{id}`) is the drilldown — it already opens the
   commentary popup, where the full apparatus and the modal live. Append a count to the
   label when it's more than one: *"View in context (3 variants)"*.
4. The tile's height-matching `useLayoutEffect` (`CommentaryTile.js:31-42`) measures
   `scrollHeight` against a clamp. Pills change line-height, so the clamp must be
   re-measured after the apparatus renders — add `segments` to the dep array.

**No hover peek, no modal on the tile.** It's a teaser in an infinite scroll; both live
where the reader has committed. This costs nothing in coverage — 75% of entries have
exactly one header unit, so the tile is showing the whole apparatus in three cases out of
four regardless.

---

### 6.7 Cross-cutting requirements

These were absent from the first draft. Each is a real obligation in this codebase, with
an existing pattern to follow.

**Accessibility.** Pills are currently `<span>` with a `data-tip` attribute — unreachable
by keyboard and invisible to a screen reader. The replacement must be focusable and
operable without a pointer:

- Pills are `role="button"` + `tabIndex={0}` + `onKeyDown` for Enter/Space, matching the
  existing precedent at `CommentaryTile.js:75`.
- The hover peek is `aria-hidden` decoration; **everything it shows must also be in the
  modal**, since keyboard and touch users never see it.
- The modal traps focus, closes on Escape, and returns focus to the originating pill. It
  renders in a portal above the draggable popup, so `aria-modal` and the focus trap have
  to account for the popup's own `onKeyDown` handler (`Commentary.js:337`), which already
  binds arrow keys and Tab for tab-switching — **the modal must stop propagation or the
  two will fight**.
- Crops carry real `alt` text: *"1837 Kirtland edition, 1 Nephi 1:3"* — not `""`, not
  "scan".

**Internationalisation.** Every new string goes through `label()` from `src/models/Utils`,
which `CommentaryTile.js:55,68,91` already uses two lines from the code being changed.
New keys: not-yet-indexed, reading-attested-image-missing, words-do-not-appear,
n-later-editions, nearest-available-scan, view-full-page, view-in-context-n-variants.
Note the pluralisation in "+18 later editions" and "(3 variants)".

The sigla table itself (`witnesses.js`) is **not** translated — edition names and
provenance are bibliographic citation. But `determineLanguage()` gates the whole
apparatus: ATV sources 161–166 are `source_lang='en'`, so a non-English reader never sees
these entries at all. Confirm that before building any localisation.

**Dark mode.** The dark sheet styles only today's `.atv` classes
(`darkmode/_read-page.scss:50-51`). New components need their own theme-aware styles —
pills, peek card, modal surface, and the crop frame. Scans are cream paper on white;
against a dark surface they need a border or a slight inset shadow to not float. Do **not**
filter or invert the scan image: it is a photograph of a primary source.

**Performance.** The modal can request many crops at once — a unit with readings across
several editions, times up to 28 units in an entry. Rules: lazy-load crops below the fold
(`loading="lazy"`, as `CommentaryTile.js:85` does), never request more than the visible
unit plus one, and cap concurrent in-flight crop requests. First view of an uncached crop
costs a `sharp` composite plus an S3 round trip on the backend, so a cold modal is not
free. Give the peek a skeleton and a timeout that collapses to the label-only card rather
than hanging.

**SSR.** `frontend/next/` exists. If any of these surfaces render server-side, the peek
and modal must be client-only (no hover on the server) and the parser must not touch
`document` — which the pure `parseATV.js` design already guarantees.

## 7. Sequencing

| Phase | Work | Unblocks |
|---|---|---|
| **0** | Implement `db-derived-fax-version-list` spec; apply the 1920 `format` fix | `1888d`, `1907`, correct `1920` boxes |
| **1** | `parseATV.js` incl. the §6.1.1 discrimination rule and the `states[]` model; fixture test over all 4,528 entries (header warnings = 0, body rejections = 13); swap `ATVHeader` to use it | P1, P2, P8 — crashes and corruption gone, no visual change |
| **2** | `ATVApparatus.jsx` + a11y/i18n/dark-mode per §6.7; wire `Commentary.js` header **and** the 3,483 prose-body units | P4, P9 |
| **3** | `WitnessPeek.jsx` + `VariantCompare.jsx` with fax crops; retire the react-tooltip instance | P5, P6, P7 — the actual feature |
| **4** | `CommentaryTile` compact variant | P3 |

Phase 1 is worth shipping on its own: it removes two live crashers and 136 corrupted
readings without changing a pixel.

**Phase 2 is bigger than the first draft implied.** It carries 3,483 prose-body units
across 1,028 entries (not the 2,580/943 originally stated), and it is where the
discrimination rule, the a11y work, and the i18n keys all land. Size it accordingly.

---

## 8. Open questions

### Resolved (KC, 2026-07-24)

- **`J` and `O`** — ship `1888d` and `1907` as placeholders, with the honest-labelling
  rule in §5.2.
- **`1829` vs `printer`** — `1829` is an abandoned legacy pass authored against an old
  microfiche scan. Use `printer`; siglum `0` is label-only. No bug entry: it is retired,
  not broken. Written up in §5.1, with the allowlist conflict in §5.3.
- **Verse-level granularity** — confirmed as final; no phrase-level geometry is coming.
  Measuring the boxes (§6.3) showed this matters far less than assumed: 68% of crops are
  ≤100px tall at `w400`. Design is the two-tier peek/compare in §6.4.

- **Scope of hover vs. modal** — hover is minimal (one crop, one label line); the modal
  carries all other witnesses, all other readings, and the entry's secondary units. The
  tile renders the leading unit only and drills down via its existing "View in context"
  link. §6.4, §6.6.
- **Modal navigation** — one scrolling column, no pager. Opens scrolled to the clicked
  unit; the entry's other units follow in document order.

### Still open

Nothing blocking. Two things to decide during implementation:

1. **Body-unit crops** — whether resolving the cited reference from the enclosing `<li>`
   is reliable enough to show images for prose-body units, or whether they stay
   text-only. Needs an accuracy pass on real data, not a decision up front.

---

## 9. Non-goals

- Phrase-level (sub-verse) box geometry.
- Re-wiring the fax viewer's DOM highlight overlay, reverted in `c965d87e` for a
  browser-only crash. Crop mode doesn't depend on it.
- Backfilling `bom_xtras_fax_index` for the 11 editions that have scans but no boxes.
- Re-authoring the abandoned `1829` geometry — it is retired, not repairable. *Removing*
  it from the renderable set is tracked as a §5.3 prerequisite conflict, not as work here.
- Any change to how ATV entries are selected, sampled, or ranked.
- Adding error boundaries app-wide — worth doing, but a separate piece of work.

---

## 10. Review log

Adversarial review, 2026-07-24. Six corrections applied; all re-verified independently
before acceptance.

| # | What was wrong | Root cause | Now |
|---|---|---|---|
| 1 | §6.3 crop sizes measured **boxes**, not stitched crops; §6.4 aspect guard said "~3%" | Ignored `toFragments`/`stitchVertical`; reused the `>260px` bucket as a proxy for the 2:1 threshold | Re-derived by replaying the real pipeline over 27,744 boxes → 25,280 crops. 62.5% ≤100px; **aspect guard fires at 9.7%**. Double-column editions called out as a distinct shape. |
| 2 | "437–787 verses per edition (12–23% of ATV verses)" multi-box | Counted across all 6,604 verses, reported as a share of the 3,160 ATV verses | **216–424 (6.8–13.4%)** |
| 3 | P4 said 1,006 entries; §6.4 said 943 / 2,580 / max 18 | Corpus dump truncated at 4,000 chars — 929 entries (20.5%) exceed it, longest 24,889 | **1,028 entries / 3,483 units / max 28**, full text, one stated rule |
| 4 | `Reading` model couldn't hold the data | `correction` singular, `content` a flat string | `states[]` sequence. **100 readings carry 2+ correction codes**; 2,001 carry one |
| 5 | 4,866/11,212 vs 4,861/11,207 used interchangeably | §2.1 characterised the corpus using the **buggy parser this spec condemns** | One balanced-scan measurement throughout; buggy-parser figures labelled where they describe current behaviour |
| 6 | "22 index versions cover all 6,604 verses"; "only tooltip ignoring `tooltipTheme`"; `[sic]`/`[JST]` examples | Overclaimed universals; invented illustrations | `poetic` = 6,597 noted; 19 files render `<ReactTooltip>`, 4 use `tooltipTheme`; both example strings have **0 occurrences** — replaced with the real `[JST]`-parses-as-valid-sigla hazard |

Also added: §6.1.1 apparatus-vs-bracket discrimination rule with its CI implication, and
§6.7 covering accessibility, i18n, dark mode, performance and SSR — absent from the first
draft.

Findings that survived scrutiny unchanged: the two crash entries and their mechanisms,
136 corrupted readings, the sampler share (4,419 / 29,095 = 15.2%), the `1829` geometry
mismatch, the §6.5 coverage table including **0% fully-dark units**, and every `file:line`
citation.

**Standing rule for future measurement of this corpus:** never truncate `text`; state the
parser used; and when quoting a share, state the denominator.
