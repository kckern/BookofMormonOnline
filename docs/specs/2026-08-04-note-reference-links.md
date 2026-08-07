# Spec: note-reference (`<ref>n`) links → sibling note

**Date:** 2026-08-04
**Status:** Reviewed & revised (grouchy-review pass 2026-08-04: B1 guard added, source no longer derived from id, jest prerequisite dropped as stale, multi-note promoted to first-class, examples re-pulled from live data)
**Related:** `docs/audits/2026-08-04-crossref-marker-chaining.md` (the cross-reference-marker work that surfaced this)

## Motivation

Notes in `bom_xtras_commentary` (`is_note=1`) use a shorthand where a scripture
reference suffixed with **`n`** means *"see the note on that reference, in this
same publication"* — an intra-source **note pointer**, not an LDS footnote label
and not the verse text. Example, inside a source-193 note:

> "…the Lord had commanded him to depart (see 1 Nephi 2:13n)."

Today these render wrong: `detectReferences` treats `1 Nephi 2:13n` as a plain
scripture ref, links `1 Nephi 2:13` to the **verse-text** popup, and drops the
`n`. The reader is sent to scripture instead of the cross-referenced note, and
the "note" signal is lost.

### Coverage (measured 2026-08-04, live DB)

| metric | tokens | share |
|---|---:|---:|
| total `<ref>n` tokens across all notes | 449 | |
| resolve to a verse | 443 | 98.7% |
| **have a dst note in the SAME source** | **440** | **98.0%** |
| malformed (bad chapter, e.g. `Jacob 22.30n`) | 6 | 1.3% |
| resolve but no note exists (e.g. `Mosiah 1:11`) | 3 | 0.7% |

**All `<ref>n` notes are in sources 193 (336) and 192 (1)** — measured — so the
convention is publication-specific. The ~2% that don't land define the
graceful-fallback requirement, and split into two render-time classes:
- **Malformed** (verse doesn't resolve): real example, host note id `1147719302`
  → `"See 1 Ne 19.24n; Jacob 22.30–31n."` — `Jacob 22:30` is invalid (Jacob has 7
  chapters), so it must render as plain text (this is what the B1 guard protects).
- **Resolves but no sibling note** (verse valid, no note there): `Mosiah 1:11`,
  `3 Nephi 26:6`, `3 Nephi 26:9` — renders as a `note_ref` that, on click, finds
  nothing and falls back to the verse text.

(A `HC 1:297n`-style page citation is *not* a scripture ref and only appears in
long-form commentary, `is_note=0`, which is out of scope — the notes panel never
renders it. It's kept only as an illustration of the B1 guard, not an in-scope
case.)

## Terminology

- **note-ref** — a scripture reference in a note's text suffixed with `n`
  (`1 Nephi 2:13n`, book-less `5.21n`, range `2.5–7n`). Separators `:` and `.`
  both occur; `.` dominates this dataset.
- **host note** — the note whose text contains the note-ref.
- **sibling / dst note** — the note the note-ref points at: same `source` as the
  host note, at the referenced verse.
- **implied book** — for a book-less note-ref (`5.21n`), the book comes either
  from an earlier book mention in the same note text (scripture-guide resolves
  this) or, failing that, from the **host note's own `verse_id`** (we seed it).

## Requirements

### Functional

1. In the Page-view notes panel (`SingleNoteItem`, `Narration.js`), a note-ref
   renders as a **distinct link** — its own CSS class (`note_ref`) and color,
   visibly different from `scripture_link` — with the trailing `n` removed.
2. Clicking a note-ref opens the **sibling note** (same source, referenced verse)
   **inline**, rendered the same way as a note-panel item (source cover + focus
   title + linkified body), so nested note-refs keep working.
3. A book-less note-ref resolves its book from (a) an earlier book mention in the
   same note text, else (b) the host note's `verse_id`.
4. Resolution reuses scripture-guide's context-aware detection; the resolved
   `verse_id` (not the rendered anchor text) is the click target.
5. Plain scripture references in the same note continue to render as
   `scripture_link` and open the verse-text popup, unchanged.

### Non-functional / fallback

6. **No dead links.** A note-ref is only emitted when a verse resolves. If, on
   click, no sibling note is found (the ~0.7% + non-scripture cases), fall back
   to opening the **verse text** (`setActiveScripture`) — never a broken note
   link.
7. Malformed refs (bad chapter, ~1.3%) that don't resolve to a verse are left as
   **plain text** (current behavior for an unrecognized ref), not linkified.
8. Backward compatible: no change to any other detection seam or to
   `lookupReference`.

## Architecture

### Data flow

```
note.text ──▶ resolveNoteRefs(text, hostVerseId, source)
                 │  (findReferences contextAware + `n`-suffix test
                 │   + host-book seed for leading-bare tokens)
                 ▼
        [{start,end, verseId, source, rawText}]   note-refs
                 │
   token-mask ──▶ emit <a class="note_ref" data-source data-verse>…</a>
                 │   (strip trailing `n`); run existing detectReferences
                 │   over the REMAINING text for scripture_link refs
                 ▼
        rendered note body (renderPersonPlaceHTML)
                 │  click .note_ref
                 ▼
        notesForRef(source, verseId)  ──▶  [sibling note(s)]
                 │  found?  yes ──▶ render inline via <SingleNoteItem/>
                 │           no  ──▶ setActiveScripture(ref)  (verse text)
```

### Backend changes (`backend/`)

1. **Expose `verse_id` AND `source` on notes.** Both are needed client-side:
   `verse_id` seeds the implied book; `source` keys the sibling fetch.
   - ⚠️ **Do NOT derive source from `id.substr(5,3)`.** `source` is a
     `varchar(100)` and is *not* zero-padded, but the id segment is: a source-`21`
     note has id `10002021...` → `substr(5,3)` = `"021"`, and
     `notesForRef("021", …)` matches zero rows. (The cover image keeps using the
     padded `substr`/`padStart(3,0)` form — that's the asset naming — but the
     fetch key must be the real `source` column.) Today every `<ref>n`-bearing
     note happens to live in 3-digit sources 193/192, so the bug is latent, but
     the API must return real `source` regardless.
   - **Backend surface is five touchpoints, not one** (the `notesByText` loader
     currently selects only `['id','title','text','location_guid']` and its
     mapping lambda re-narrows to `{id,title,text}`): (a) add `verse_id`,`source`
     to the loader's `.select([...])`, (b) add them to the mapping lambda, (c)
     the `NoteRow`/note TS interface, (d) the SDL `Note` type (introspection
     confirms it enumerates exactly `{id,title,text}` today), (e) regenerate
     codegen (`codegen/graphql.*`, imported by `resolvers.ts`).
   - Frontend selection: `GraphQLQueries.js:~287` `notes { id title text }` →
     add `verse_id source`.

2. **New fetch `notesForRef(source, verse_id)`.** Returns the note row(s)
   (`is_note=1`) at `verse_id` in `source`, shaped `{id,title,text,verse_id}`
   with **`id` as a String** (`SingleNoteItem` calls `item.id.substr(5,3)`; the
   DB `id` is `int` and would crash the recursion render otherwise — mirror
   `notesByText`'s existing `id: String(r.id)` mapping).
   - New batched loader over `bom_xtras_commentary WHERE is_note=1 AND source=?
     AND verse_id=?`. **A verse commonly holds >1 note in a source** (1,520 such
     (source,verse) pairs; worst case 8) — return **all**, ordered by `id`.
   - Exposed as a GraphQL query field consumed by a new `GraphQLQueries.js`
     entry + `BoMOnlineAPI` call, following the existing `commentary: (ids)`
     request pattern.

### Frontend changes (`frontend/webapp/`)

1. **New module `src/views/Page/noteRefs.js`:**
   - `resolveNoteRefs(text, hostVerseId)` → array of `{start, end, verseId,
     rawText}`.
     - Run `findReferences(text, { chainAcrossMarkers:false })` → matches with
       `{start,end,verse_ids}`. A match is a note-ref iff `text[end] === 'n'` and
       `text[end+1]` is a boundary (non-alphanumeric or EOL). Target verse =
       `match.verse_ids[0]`.
     - Leading-bare pass (guarded): for `(\d+)[:.](\d+)(?:[-–]\d+)?n` spans that
       do **not overlap** any `findReferences`-covered `[start,end)` range,
       host-seed the book — BUT only when the span is *truly* bare. Look back
       from the span start, skip whitespace and any leading cross-reference
       marker (`see`/`see also`/`cf`/`compare`/`cited at`), and:
       - if the immediately preceding token is an **alphabetic word** (i.e. an
         explicit book name that `findReferences` already tried and rejected as
         invalid — e.g. `Jacob 22.30n`, `HC 1:297n`), **do NOT host-seed**; drop
         it (renders as plain text). Seeding the host book here would fabricate a
         wrong link (`Jacob 22:30` invalid, but the host's book might have a
         chapter 22 verse 30 → a live, wrong note-ref). This is the guard that
         makes AC4 hold.
       - otherwise (preceded by punctuation / whitespace / start-of-string, e.g.
         `see 5:21n`), derive the host book via `generateReference(hostVerseId)`
         and `lookupReference(\`${book} ${ch}:${vs}\`)`. Emit only if it resolves.
     - **Overlap semantics:** the two passes never double-count — a regex span
       intersecting a `findReferences` match is skipped (that ref is already a
       note-ref-or-not by pass one).
     - Return note-refs sorted by `start`; drop unresolved (leaves them as plain
       text downstream).
   - Pure and unit-testable; no React, no network.

2. **`SingleNoteItem` (`Narration.js`):** replace the single
   `detectReferences(...)` call with a **token-mask transform** (mirrors
   `detectScripturesPreservingTokens`):
   - Compute note-refs via `resolveNoteRefs(text, item.verse_id)`.
   - Replace each note-ref span with `<a class="note_ref"
     data-source="{source}" data-verse="{verseId}">{visibleRefText}</a>` (trailing
     `n` stripped), masking it from scripture detection.
   - Run the existing `detectReferences(rest, scriptureLinks,
     {chainAcrossMarkers:false})` on the remaining text.
   - Render via `renderPersonPlaceHTML` (which only special-cases
     `scripture_link`/`person`/`place` anchors and passes an `<a class="note_ref">`
     through inert). **Click mechanism = container-level event delegation:**
     `SingleNoteItem` puts an `onClick` on the note wrapper, checks
     `e.target.closest('.note_ref')`, and reads `data-source`/`data-verse`. This
     keeps all logic in `Narration.js` and **does not touch `PersonPlace.js`**
     (no new replacer branch).
   - **Inline placement:** on click, fetch via `notesForRef` and render the
     result as a dismissable **accordion block directly beneath the host note
     item** (default; avoids the floating-popup positioning `ScripturePanelSingle`
     needs). **Multiple sibling notes are common** (M4) — render **all** returned
     notes stacked, each via `<SingleNoteItem item={fetched}/>` so nested
     note-refs recurse. Clicking the same note-ref again, or a close affordance,
     collapses the block.
   - **Fallback target:** when `notesForRef` returns empty, call
     `setActiveScripture(generateReference(verseId, determineLanguage()))` so the
     verse-text popup opens on the resolved verse (we hold a `verseId`, not a ref
     string).

3. **CSS:** add `.note_ref` styling (distinct color + affordance) alongside the
   notes-panel styles; ensure dark-mode parity.

## Edge cases

- **Ranges** (`2.5–7n`): link the whole range; target verse = first verse_id.
- **Multiple notes at the target verse in a source:** `notesForRef` returns all;
  the accordion stacks them. **Common** — 1,520 (source,verse) pairs have >1
  note (worst case 8), so this is a first-class presentation case, not an edge.
- **Recursion:** a fetched sibling note may itself contain note-refs — rendering
  it through `SingleNoteItem` handles this; depth is bounded by user clicks.
- **Explicit-but-invalid book (`Jacob 22.30–31n`, `HC 1:297n`):** `findReferences`
  can't resolve it and the B1 guard refuses to host-seed (an alphabetic book word
  precedes it) → left as plain text (req 7). `HC …` only occurs in `is_note=0`
  commentary anyway (out of scope).
- **Book-less at note start (`see 5:21n`):** findReferences can't resolve (no
  in-text book) → host-book seed path (req 3b).
- **Separator normalization:** accept both `:` and `.`; scripture-guide already
  normalizes `.` → `:`.

## Testing

- **Unit (`noteRefs.test.js`):** qualified (`1 Nephi 2:13n`), in-context bare
  (`1 Nephi 3:7; see 5:21n` → 1 Nephi 5:21), host-seeded bare (`see 5:21n` with
  `hostVerseId` in 1 Nephi → 1 Nephi 5:21), range, malformed (`Jacob 22.30n` →
  dropped), non-scripture (`HC 1:297n` → dropped), separator `.`/`:`.
- **Render/interaction (`SingleNoteItem`):** note-ref gets `.note_ref` +
  `data-verse`; plain refs still `scripture_link`; delegated click triggers
  `notesForRef`; multiple results render stacked; empty result falls back to
  `setActiveScripture`.
- **No Jest ESM blocker.** Verified 2026-08-04: with `scripture-guide@1.0.95`
  (CJS `main` + exports map), react-scripts/jest resolves the CJS entry and
  suites importing `scripture-guide` pass unmocked (`proseBodyRender.test.js`
  → 7/7). The earlier "fails to transform" note predated the 1.0.95 upgrade and
  is no longer a prerequisite — do not add a `transformIgnorePatterns` override.

## Files touched

- Backend: `data/loaders.ts` (`notesByText` select + mapping: add
  `verse_id`,`source`; new `notesForRef` loader), `graphql/resolvers.ts`
  (`notesForRef` query resolver), the SDL/type defs (`Note` gains
  `verse_id`,`source`; new `notesForRef` field), regenerated `codegen/graphql.*`.
- Frontend: `views/Page/noteRefs.js` (new), `views/Page/Narration.js`
  (`SingleNoteItem` — token-mask + delegated click + accordion), notes-panel CSS
  (+ dark mode), `models/GraphQLQueries.js`, `models/BoMOnlineAPI.js`, tests
  (`noteRefs.test.js`). **`PersonPlace.js` is NOT touched** (click uses event
  delegation, not a new replacer branch).

## Acceptance criteria

1. `1 Nephi 2:13n` in a source-193 note renders as a `note_ref` (distinct color,
   no trailing `n`) and, on click, shows source-193's note on 1 Nephi 2:13 inline.
2. A book-less `5.21n` in a 1-Nephi note resolves to 1 Nephi 5:21 and links to
   that note.
3. A plain `Alma 5:14` in the same note still renders as `scripture_link` and
   opens the verse text.
4. A malformed ref (`Jacob 22.30–31n`, host book differs) renders as **plain
   text** — the B1 guard prevents host-seeding a wrong verse — no note link, no
   crash.
5. A note-ref whose verse resolves but has **no** sibling note (`Mosiah 1:11`)
   renders as a `note_ref` and falls back to the verse-text popup on click.
6. A verse holding **multiple** sibling notes shows all of them stacked in the
   accordion.
7. `lookupReference` and all other detection seams are unchanged.

## Non-goals

- Read-view `PassageNotes.js` (it excludes `is_note=1` entirely; out of scope).
- Backend-side note-ref parsing (approach ②) — resolution stays client-side.
- Preloading sibling notes with the passage (approach ③) — fetch is lazy.
- Cleaning the analogous dangling-`n` in long-form commentary (`is_note=0`, only
  2 rows) — negligible; not worth a code path.
