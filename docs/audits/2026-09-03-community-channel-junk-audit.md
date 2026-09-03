# Community channel audit — junk/test channels in the public feed

**Date:** 2026-09-03
**Trigger:** `/home/feed` became the full public community (see [[reformers_live_channel_seeded]] / commit `ac6a8fe6`). All `public`/`open` channels now surface in the feed + group siderail. This exposed test/empty channels and buried legitimate ones.
**Scope:** all 28 `custom_type IN ('public','open')` channels in `bom_prd`.

## How featuring works (why junk matters)

- Featured groups = `getPublicChannels` → `custom_type IN ('public','open')`, filtered by `lang`, **ordered by `updated_at DESC`**, then policies with `enabled!=1 OR listed!=1` are removed (`getFeaturedChannels`).
- A channel with **no policy row is shown** (only explicit `listed=0`/`enabled=0`/`unlisted` hides it).
- The siderail (`homegroups`) caps featured at **6** (`community.ts:max=6`).
- Consequence: ordering is by *last touched*, not quality/activity. Empty, recently-updated test channels take the top slots and evict real groups.

### The Red Brick Store symptom
Red Brick Store (15 members, **323 roots**, healthy) sits at ~#13 by `updated_at` (2026-06-11), while **My Channel** and **Test Channel** (0 members, 0 messages) rank #2–#3 (2026-07-16). With a 6-group cap, Red Brick Store never renders.

## Classification

### HIDE — junk / test / dev artifacts (recommend `listed=0`)
| Channel | url | why |
|---|---|---|
| My Channel | `test_ch_YBkt-MUTmoOO` | test channel (url prefix `test_ch_`), 0 members, 0 msgs |
| Test Channel | `test_ch_2IkUKdPfkBn6` | test channel, 0 members, 0 msgs |
| t3 | `e5699c79c35b69e100f103d002f95bac` | junk name, 1 member, 0 msgs |
| Bot Farm | `a8d5d36bb1b8d4afb382bb60f17bd588` | bot test farm (10 bots), 2022 |
| Study Group Simulator | `b8447faf34476990bff5c3a3a697dfc8` | simulation/test artifact, 2022 |
| Hawthorne Seminary (Lawndale Bldg) | `6a8ce3a9364062b6bb50e607d779ae33` | empty; **duplicate** |
| Hawthorne Seminary (Lawndale Bldg) | `8c290309b9797a81c682782e7098f530` | empty; **duplicate of above** |

### HIDE-or-REVIEW — empty legacy groups (0 roots, 0 messages)
Real-looking names but no content; nothing to show in a feed. Members but never posted.
`서울남 스테이크` (17 members), `몰몬경 사랑`, `Hamlin Ward Seminary`, `Deaf ASL LDS Group`, `BOM studying`, `서울 동스테이크`, `Wes's Journey of Discovery` (2 msgs), `1 Nephi` (1 msg).
→ Recommend `listed=0` (keep reachable by direct link; just not featured).

### REVIEW — anomaly
| Channel | url | note |
|---|---|---|
| תלמידים ישו המשיח | `4f7002d41a94cc82c02f8ddb543f6894` | **970 roots / 1168 msgs but 1 member**, Hebrew, last 2025-08. Looks like a solo/import/scraped channel. Not `en` so excluded from the en feed today, but huge — confirm provenance before it's ever surfaced. |

### KEEP — legitimate groups
Reformers Discuss the BoM (`981706be…`, flagship), Hugh Nibley's Classroom (99 members, 126 roots), **Red Brick Store** (323 roots), Book of Mormon Perspectives Forum, Packets of Light, BSFriends, Reading the BoM as non-LDS, The Lloyd's Study Group, plus real language study groups with content.

## Recommendations

1. **Hide the junk now** — insert `messenger_channel_policy` rows with `listed=0, enabled=1` for the HIDE set (and the empty-legacy set). Removes them from featured/siderail; leaves them reachable by direct URL. Reversible.
2. **Fix the ranking (follow-up):** order featured by *activity* (recent message / live-root count), not `updated_at`. Otherwise any channel that merely gets touched jumps the queue and re-buries good groups. Alternatively raise/vary the 6-cap.
3. **Provenance check** on `תלמידים ישו המשיח` (970 solo roots) before any multilingual featuring.
4. Consider a **duplicate sweep** — the two identical Hawthorne Seminary channels suggest create-dupes elsewhere.

## Language backfill (DONE 2026-09-03)

All channels defaulted to `lang='en'`, so non-English groups were both polluting the English feed and hidden from their own host. Backfilled by content (not just name):
- **16 channels** corrected: 6 Korean community groups (+ Korean private/DM) → `ko`, `Étudiants francophones…` → `fr`.
- **Correction:** `תלמידים ישו המשיח` (`4f7002d4…`, 970 roots) has a Hebrew *name* but **English content** (≈31k Latin chars vs 357 Hebrew — chiasmus/scripture study). Left as `en`. It's a 1-member, 970-root English channel — still a REVIEW item (provenance) since it can dominate the en feed.

Lesson: detect channel language from **message content**, not the display name.

## "See more" is non-functional (same root cause as the buried Red Brick Store)

**Symptom:** clicking "See more…" in the group siderail does nothing visible; the link just disappears.

**Root cause:** the siderail shows ~6 groups and can't show more:
- `homegroups` returns only `max=6` in the default (unfiltered) view.
- Clicking see-more sets `queryFilter.grouping='featured_groups'` and refetches — which *does* return all featured groups (grouping-mode `max=60`, `getFeaturedChannels` limit 20 → ~20 of the 21 `en` groups). Verified: the refetch fires (homegroups call 1→2).
- BUT the left panel is **intentionally non-scrolling** and `useFitCounts` slices the list to whatever fits the panel height (~6). So the ~20 refetched groups are immediately capped back to ~6, and the see-more link is gone (`!queryFilter.grouping` false). Net: no visible change.

So **15 of 21 featured groups (incl. Red Brick Store) are unreachable from the siderail** — the fit-cap and see-more are in direct conflict.

**Secondary:** the click handler mutates React state in place (`setQueryFilter((q) => { q.grouping = grouping; return q })`) — a same-reference bail-out anti-pattern. It refetches only incidentally (the sibling `setSeeMoreLabel` forces the re-render). Fragile; should be `setQueryFilter((q) => ({ ...q, grouping }))`.

**Fix options:** (a) make the panel scrollable (or open a groups modal/page) when a grouping filter is active so all fetched groups show; (b) raise the `homegroups` default cap and let the panel scroll; (c) drop the fit-to-height design for the group list. Any of these also resurfaces Red Brick Store. Pair with recommendation #2 (rank by activity, not `updated_at`).
