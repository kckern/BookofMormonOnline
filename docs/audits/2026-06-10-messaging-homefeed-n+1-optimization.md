# Messaging homefeed/community — N+1 performance audit & fix

**Date:** 2026-06-10
**Trigger:** `homefeed` took **9.5s** for a user in 31 channels.
**Outcome:** **9523ms → ~440ms (~21×)**, all 137 backend tests green.

## Diagnosis: indexes were fine; the cost was round-trip count

EXPLAIN on every hot query showed an optimal index hit:

| Query | Index used |
|---|---|
| messages by channel, newest | `idx_channel_created (channel_url, created_at)` + backward scan |
| members by channel | PRIMARY `(channel_url, user_id)` |
| my channels (members by user) | `idx_user_id` |
| thread replies | `idx_parent_message_id` |
| reactions / highlights by message | PRIMARY / `idx_message_id` |

Each query is sub-millisecond. The latency was **thousands of sequential round-trips** to the remote MySQL — a classic N+1, nested three levels deep:

```
homefeed
 ├─ getPublicChannels  → assembleChannelDTO  per channel ─┐
 ├─ getMyChannels(31)  → assembleChannelDTO  per channel ─┤  members + getMessages(1)
 └─ allMessages: getMessages(30) per channel ─────────────┘     ↳ assembleMessageDTO per message:
                                                                    user + highlights + reactions
                                                                    + thread-info (+ loadUser per replier)
```

`assembleMessageDTO` fired **4–7 queries per message**. Across ~57 channels × 30 messages that was **~10,000 queries** for one homefeed.

## Fix — two batching passes (no schema/index change needed)

**Pass 1 — `assembleMessages(rows[])` (messages.ts).** Replaced the per-message
assembler with one that takes a set of message rows and does a CONSTANT ~5 queries:
one bulk fetch each for highlights, reactions, and thread replies (`message_id IN …`),
plus a single `getUsers()` for all authors + repliers. `getMessages`/`getThread`/
`getMessage` all route through it.
→ homefeed **9523 → ~1400ms (6.8×)**. Bonus: authors now resolve display names via
`getUsers` (the bom_user thin-row coalesce), fixing `?`-nickname feed items.

**Pass 2 — batch the channel level.**
- `getMessagesForChannels(urls, N)` (messages.ts): one **windowed** query
  (`ROW_NUMBER() OVER (PARTITION BY channel_url ORDER BY created_at DESC)`, `rn ≤ N`)
  for N messages across every channel, assembled in a single batched pass.
- `getChannelMembersBulk(urls)` (members.ts): one members query + one `getUsers` for
  every member across all channels.
- `assembleChannels(rows[], viewer)` (channels.ts): builds the whole channel list from
  the two bulk maps + parallel unread; `getMyChannels`/`getPublicChannels` use it.
- `homefeed` fetches its feed via `getMessagesForChannels(allUrls, 30)` (one query) instead
  of `getMessages` per channel.
→ homefeed **~1400 → ~440ms** (total **~21×**); homegroups my_groups 852 → 262ms;
public homefeed 2775 → 228ms.

## Before / after (31-channel user, warm)

| Operation | Before | After |
|---|---:|---:|
| homefeed (token) | 9523 ms | ~440 ms |
| homegroups my_groups | 852 ms | 262 ms |
| homefeed (public, no token) | 2775 ms | 228 ms |
| homefeed (single channel) | 311 ms | 141 ms |

## Remaining headroom (diminishing returns, not pursued)

- Per-channel `getUnreadCount` in `assembleChannels` is still one query/channel (parallelised).
  Batchable into a single grouped query if the channel list grows large.
- `homefeed` fetches 30 messages/channel for the feed then filters most out via
  `feedAlgorithm`; a tighter pre-filter in SQL would shrink the working set.
- `getFeaturedChannels` + `getMyChannels` overlap is de-duped in memory after both assemble;
  could be unioned before assembly.

The principle going forward: **assemble collections in bulk (`…ForChannels` / `…Bulk` / a
single `getUsers`), never per-item in a loop or `Promise.all(map(perItemFetch))`.**
