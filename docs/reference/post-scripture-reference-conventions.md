# Post ↔ scripture reference & highlight conventions

How an "organic" study post anchors itself to scripture content, and the gap the
Reformer-bot posts (e.g. Henry VIII) currently have. Evergreen reference for
making generated posts conform.

## The three levels of metadata

A properly-anchored post carries structured references, **not** an inline text
citation. The reference lives in three places:

### 1. Message columns (`messenger_messages`)
| Column | Meaning | Example |
|---|---|---|
| `custom_type` | **page slug** the post is anchored to (which reading page) | `lehites`, `ammon`, `alma-32` |
| `link_type` | content KIND being referenced | `text` (verse), `com` (commentary), `section`, `fax`, `img` |
| `link_target` | id/ordinal of that content WITHIN the page | `56` (verse ordinal on the page), a commentary id, a section slug |
| `link_aux` | optional extra (e.g. fax version) | usually null |

Distribution today: `text` 2242, `com` 332, `section` 81, `fax` 32, `img` 28, `null` 2352 (plain chat).

### 2. Highlights table (`messenger_highlights`)
Separate rows keyed by `message_id`: `{ ordinal, text }` — the actual highlighted
verse text span(s). This is what renders the scripture excerpt on the card and
drives the "highlighted a passage" affordance.

### 3. Assembled `data` JSON (read side, back-compat)
`buildDataString` composes the columns + highlight rows into:
`{ links: { [link_type]: link_target[.link_aux] }, highlights: [text, …], description }`.

## Authoring convention (the reader — `Study.js` sendMessage)
- `params.customType = pageSlug` (the current reading page).
- `params.data = { links: linkData, highlights: [...], description }` where
  `linkData` is e.g. `{ text: <verseOrdinal> }` / `{ com: <id> }` / `{ section: <slug> }`.
- **Empty body + highlight ⇒ `message = "•"`** → a highlight-only post ("X added a highlight").
- Body + link ⇒ a comment anchored to the verse ("X commented on a passage").

## Rendering (`assembleHomeFeedItem` + `ContentInFeed`)
- `link.key = link_type`; `link.val = ${pageSlug}/${link_target}` for text/section/fax.
- `determinAction`: `msg==="•"` → `highlighted_<key>`; else `commented_<key>`.
- `ContentInFeed` maps `link.key` → `TextInFeed`/`CommentaryInFeed`/`SectionInFeed`/
  `FaxInFeed`/`ImageInFeed`, resolving the bound content via a `linkedContent` lookup
  keyed by `${pageSlug}/${link_target}`.
- The general home-feed filter **requires a non-empty `custom_type`** — a post with
  no page slug is dropped (the Reformers beta only shows because we pass `unfiltered`).

## The Reformer-bot gap
Henry VIII roots have `custom_type=''`, `link_type=null`, `link_target=null`, **0
highlights**, and the reference is inline prose (`"Alma 32:21, where it speaks of
faith…"`). Result: no content card, no scripture excerpt, no highlight, renders as
a generic "posted a comment", and is only visible because of `unfiltered`.

### To conform, a generated post needs
1. **Resolve the passage** (`bom_ai_topic.passage_ref`, e.g. "Alma 32:21") → the
   **page slug** containing it (`custom_type`) + the verse's **ordinal on that page**
   (`link_target`), with `link_type='text'`. This resolution is the open question —
   it needs the page/reading-plan structure that maps a verse id → (slug, ordinal).
   (`scripture-guide` already gives ref → verse id; the reader's `pageData.slug` +
   per-page verse ordinals are the other half.)
2. Optionally insert a **highlight row** with the verse text so the card shows the
   excerpt and reads "commented on a passage".
3. Move the reference OUT of the prose — the body should be the commentary; the
   verse is shown by the content card, matching organic posts.
