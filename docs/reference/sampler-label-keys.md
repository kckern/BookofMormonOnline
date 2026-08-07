# Sampler & Community Menu Label Keys

UI strings in the frontend resolve through the backend `labels` GraphQL query,
which is backed by a MySQL `labels` table (key → value per language). When a key
is missing, `label("key")` renders the raw key string as-is, so a missing label
degrades gracefully (it shows literal text like `latest_activity` rather than
crashing).

This file inventories the label keys introduced or consumed by the Home Sampler
redesign — the sampler shell (`src/views/Home/Sampler.js`), its tiles
(`src/views/Home/tiles/*.js`), and the new navigation menu entries in
`src/views/_Common/menuConfig.js`.

## Important: writing new keys

The dev DB user (`reader@%`) is **read-only**, so new keys cannot be inserted
from this environment. Someone with write access (the `bom_app` user in
the private workspace repo) must add the rows marked **new** below to the `labels`
table. Until they do, those strings render as their raw key.

## Status legend

- **exists** — the same key is already used via `label(...)` elsewhere in the
  frontend, so it is present in the DB.
- **new** — introduced by the sampler/menu work; only referenced by the new
  code. Must be inserted before it renders as English.
- **verify** — used by the sampler but not confirmed elsewhere as a `label(...)`
  call; no running backend was reachable to confirm membership. Check against the
  DB and insert if absent.

## Keys

| key | English value | status |
|---|---|---|
| `home_title` | (existing) | exists |
| `commentary` | (existing) | exists |
| `contents` | Contents | verify |
| `facsimiles` | (existing) | exists |
| `highlight_msg` | (existing) | exists |
| `people` | (existing) | exists |
| `places` | (existing) | exists |
| `sign_in` | (existing) | exists |
| `community` | Community | verify |
| `latest_activity` | Latest Activity | new |
| `members` | Members | new |
| `menu_home` | (existing) | exists |
| `menu_community` | Community | new |
| `mapstory_play` | Play journey | new |
| `mapstory_pause` | Pause journey | new |
| `mapstory_summary` | Story summary | new |
| `mapstory_move` | Move $1 | new |
| `mapstory_detached` | story resumes elsewhere | new |
| `mapstory_detached_title` | This movement begins a new geographic run | new |
| `mapstory_meta` | $1 moves · $2 places | new |
| `read_more` | Read more | new (2026-08-05, two-layer CTA) |
| `view_in_context` | See in context | new (2026-08-05, two-layer CTA) |
| `view_more` | View more | new (2026-08-05, two-layer CTA) |

## Notes

- `menu_home` already existed on the previous `home` menu entry; the redesign
  only removed its `requiresMessenger` gate (the sampler is now for everyone).
- `menu_community` is the label for the new gated `community` menu entry
  (`{ slug: "community", labelKey: "menu_community", requiresMessenger: true }`),
  which carries the messaging gate the old home entry used to have.
- `community` (used inside the sampler body, distinct from the menu key
  `menu_community`) and `contents` are marked **verify**: they are common enough
  words that a row may already exist, but neither is referenced through
  `label(...)` outside the sampler, and no backend was reachable to confirm.
- The `mapstory_*` keys back the map-story tile (`tiles/MapStoryTile.js`,
  `tiles/MapStoryCard.js`). `mapstory_move` and `mapstory_meta` use `$1`/`$2`
  insert placeholders (e.g. `label("mapstory_meta", [moveCount, stopCount])`).
  They are seeded by `backend/scripts/seed-sampler-labels.mjs`; until that runs
  against a writable DB they render as their raw keys.
- To confirm membership against a running backend:
  `curl -s http://localhost:5005/en -H 'content-type: application/json' -d '{"query":"{labels{key val}}"}'`
