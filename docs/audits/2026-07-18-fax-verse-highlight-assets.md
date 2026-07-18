# Fax Verse Highlight Assets — What Exists

**Context:** `FaxVerseTile` renders a plain page thumbnail. The goal is to show
the page with the passage highlighted instead. This records what the media
server and database actually offer, gathered while scoping that change.

**Outcome:** parked. The existing highlight asset is too heavy for a home-feed
tile and is scoped to the wrong unit; a new API is planned to serve a better
one. This document is the input to that work.

## There is no verse-level highlight image

Two different things get called "the highlight asset". They are not the same.

### 1. Per-verse geometry — data, not an image

`bom_xtras_fax_index` (`backend/codegen/db.d.ts:593`) carries per-verse
bounding-box geometry:

```
version, page, verse_id, X, Y, W, H, TLW, TLH, BRW, BRH, pageScale, pageWidth
```

**Nothing in the live codebase reads any of it.** Grepping
`X/Y/W/H/TLW/BRW/pageScale` across `frontend/` and `backend/` returns only the
generated type definition and the dead Sequelize model in `_deprecated/`. The
column semantics are therefore unverified — no renderer demonstrates how
`TLW/TLH` and `BRW/BRH` relate to `X/Y/W/H`, or what `pageScale` normalizes
against.

This is the only genuinely *verse*-scoped highlight data that exists.

### 2. `/fax/text/{version}/{bookSlug}-{textId}` — a rendered image

Example: `https://media.bookofmormon.online/fax/text/1837/ammon-132`

A full page photograph with the passage in a bright band and the rest of the
page dimmed. Used today by `Narration.js:889` and `StudyInFeed.js:190`.

Two properties make it a poor fit for the tile as-is:

- **Section-scoped, not verse-scoped.** It is keyed to a narration text id, so
  the highlight covers a whole section — in the `ammon-132` sample, roughly
  three quarters of the page.
- **1.1 MB, 981×1500, no smaller variant.** The current page thumb
  (`/fax/thumb/{version}/{nnn}.jpg`) is 57 KB. `?w=400` is ignored — plain S3,
  no image resizing on the origin. Probed `fax/textthumb/…`,
  `fax/thumb/text/…`, `fax/text/thumb/…`, `fax/text/…/thumb`: all 404.

Weight matters here because `faxVerse` is weighted 30 in the infinite-scroll
sampler (`frontend/webapp/src/views/Home/Sampler.js:377`), so these tiles recur.

## Getting from a sampled verse to that asset

Should a future API keep the `{bookSlug}-{textId}` key, this is the join path:

```
bom_xtras_fax_index.verse_id
  → bom_lookup.verse_id → bom_lookup.text_guid
  → bom_text.guid → bom_text.link  (the numeric textId)
                  → bom_text.page  (page guid)
                     → slugPathByLink(page) → path; take the LAST segment
```

This mirrors how `TextBlock.slug` is built
(`backend/src/graphql/resolvers.ts:238-242`: `${path}/${t.link}`). The frontend
then reduces that slug to the asset key with
`slug.match(/([a-z-]+)\/(\d+)$/)` → `${m[1]}-${m[2]}`, e.g. `alma/ammon/132`
becomes `ammon-132`.

`sampleFaxVerse` (`backend/src/graphql/resolvers/homesampler.ts:196`) currently
selects only `version, page, verse_id` and exposes
`version title format page verseId ref` — neither the text id nor the page slug
is available to the tile today.

## For the new API

The gap a new endpoint would close: a **verse**-scoped, **tile**-sized
highlight image. The geometry in `bom_xtras_fax_index` is the raw material —
one row per verse with a box on a known page image — but its column semantics
need establishing first, since no existing consumer pins them down.
