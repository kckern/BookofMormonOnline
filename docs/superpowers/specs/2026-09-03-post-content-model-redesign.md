# Post content model redesign — anchor + canonical references

**Status:** design (brainstormed 2026-09-03)
**Supersedes the Sendbird-shaped model documented in** `docs/reference/post-scripture-reference-conventions.md`.

## Motivation

The current post↔content model was constrained by Sendbird's message shape: a
single `link_type`/`link_target`/`link_aux` (one reference per post), a `≤5-key`
metadata envelope with string-length limits, highlights in a side table, the
`"•"` empty-body sentinel for highlight-only posts, and `custom_type` doing
double duty (page-slug anchor **and** a `comment`/`formatted_comment` kind). We
now own the tables (no Sendbird), and generated (bot) posts currently reference
scripture as inline prose with **no** structured metadata, so they render as
plain comments with no content card, excerpt, or highlight.

We rethink this freed from Sendbird's limits: a **full content model** — multiple
references per post, non-scripture entities (people/places/objects), cross-refs,
and highlights — with references identified by **canonical id, resolved at
render**.

## The one hard constraint (verified in code)

`views/Page/` fetches a page's comments with a **single indexed SQL predicate**:
`getPageComments` → `getMessages(customTypes:[pageSlug])` → `WHERE custom_type =
pageSlug` (index `idx_custom_type`). Everything finer — which verse, which
commentary/image — is parsed **in-app** from the message's JSON (`commentIndex.js`
keys by `[link-type, id]`; backend `collectLinkIds`). There is **no** SQL
index/join on verse/com/img; comments on commentary/image are anchored to the
**page** and ride in on the page fetch.

**Therefore the page anchor must stay a real indexed column** (the queryable
spine); everything else can be JSON payload (parsed in-app, as verse/com/img
already are).

## The model

Two tiers on `messenger_messages`:

### 1. `anchor` — optional, indexed column (the spine)
- New column `anchor VARCHAR … NULL`, indexed. Holds the **page slug** a post
  attaches to (scripture page like `lehites`, or a person/place/object page —
  all have slugs). NULL for posts not attached to a page (pure group chat).
- **The single join-key.** `views/Page` keeps its one indexed query
  (`WHERE anchor = pageSlug`), unchanged in spirit.
- **Set on the root only.** Replies inherit context via `parent_message_id`
  (anchor NULL), exactly as `custom_type` behaves today.
- Retires `custom_type`'s dual role. `comment`/`formatted_comment` cease to be
  types — formatting is a body/envelope property, not a message kind.

### 2. `references` — JSON column (the rich payload)
An array of canonical references, parsed in-app (like today's `data.links`):

```jsonc
references: [
  {
    "type": "verse" | "commentary" | "image" | "section"
          | "person" | "place" | "object",
    "id":   <canonical id>,        // scripture-guide verse-id | com id | img id | entity slug | section slug
    "role": "subject" | "mention" | "highlight" | "quote" | "crossref",
    "span": { "text": "…" },       // highlight/quote: the highlighted text (+ optional offsets)
    "ordinal": 0                    // stable ordering / bucketing
  }
]
```

- **Canonical ids, resolved at render.** Scripture is a stable scripture-guide
  verse-id (not a page-internal ordinal); person/place/object are slugs;
  commentary/image are their ids. The page-slug + verse-ordinal needed for
  display is **derived at render** from the canonical id (see Resolution). Old
  refs never break when pages are reindexed, and a bot can compute a ref from a
  passage string trivially (scripture-guide gives ref → verse-id).
- **Multiple references per post.** A discussion post can cite several verses,
  a person, and a cross-ref at once.
- **Highlights fold in** as references with `role: "highlight"` and a `span`.
  The separate `messenger_highlights` table is retired (migrated into
  `references`). Verse-level counts/buckets come from parsing `references`, as
  they already do from `data.links`.
- **No `"•"` sentinel.** A highlight-only post is a post with an empty body and a
  `role: "highlight"` reference; the renderer derives "highlighted a passage"
  from that, not from a magic body string.

### Message metadata envelope (freed from ≤5 keys)
One structured JSON `metadata` column holds `references[]`, `mentions[]`,
`participant_role`, and display/format/preview hints. Reactions and read-state
stay in their own tables (unchanged). `references` may be its own column or a key
of `metadata` — implementation detail settled in the plan.

## Resolution layer (canonical id → display)
A single seam resolves a reference for rendering:
- scripture: `verse-id → (page slug, verse ordinal on page, verse text)` via the
  reading-plan/page structure + `scripture-guide` (`SlugResolver` already does
  `guid → page path`; the reverse `ref → verse-id` exists in scriptureBridge).
- commentary/image: id → location slug (existing `SlugResolver` path in
  `pagecomments.ts`).
- entities: slug → page.

`assembleHomeFeedItem`/`ContentInFeed` and the page-comment index consume the
resolved shape; the resolver is the only place that knows page layout.

## Bot conformance (the trigger for this)
A generated post: resolve `bom_ai_topic.passage_ref` (scripture-guide → verse-id)
→ set `anchor` = the passage's page slug, push a `reference`
`{type:"verse", id:verse-id, role:"subject"|"highlight", span:{text: verseText}}`,
and make the **body the commentary only** (no inline "Alma 32:21, …" citation).
It then renders exactly like an organic verse comment (content card + excerpt).

## Migration (we own the tables)
- `custom_type` (page-slug values) → `anchor`. Non-page `comment`/`formatted_comment`
  posts → `anchor` NULL (+ a `format` hint if needed).
- `link_type/link_target/link_aux` → a `references[]` entry (map `text→verse`
  after ordinal→verse-id lift, `com→commentary`, `img→image`, `section`, `fax`).
- `messenger_highlights` rows → `references[]` entries with `role:"highlight"`.
- Dual-read shim (accept both old `data.links` and new `references`) during
  cutover, then one-shot backfill; drop old columns/table after.

## Out of scope
Reactions, read-state, thread/membership models, the reader UI itself. Backlinks
("all posts about Alma 32:21 / about Nephi") are deferred — the JSON model
doesn't index them; add later via a generated column or the search index if
needed.

## Open questions for the plan
1. `references` as its own column vs a key inside `metadata`.
2. Exact `role` vocabulary (is `subject` vs `mention` worth distinguishing at v1?).
3. Whether the resolution layer memoizes verse-id → (slug, ordinal) or computes per request.
4. Migration ordinal→verse-id lift: is every legacy `text` link_target cleanly liftable?
