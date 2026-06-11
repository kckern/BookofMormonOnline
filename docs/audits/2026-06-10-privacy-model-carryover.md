# Privacy Model Carryover Audit — Green-field vs Legacy

**Date:** 2026-06-10
**Scope:** User public/private visibility, group privacy types (open/public/private/solo/DM),
and the privacy implications of each as carried from the legacy Apollo backend (`src/`) to the
green-field Yoga/Kysely backend (`backend/src/`).
**Verdict:** Green-field **faithfully carries over** the legacy privacy model. No privacy
regressions found. Three pre-existing design notes flagged for a product decision (not bugs).

---

## 1. The two privacy axes

### User visibility — `bom_user.visibility`
A user is treated as **public** iff `bom_user.visibility === 'public'`. Everywhere else they are
**private** and get anonymized when surfaced on a cross-group public surface.

- **Legacy:** `loadHomeUser(sb, user, publicUsers)` sets `public = publicUsers.includes(sb.user_id)`,
  where `publicUsers = bom_user WHERE visibility='public'` (`BomCommunity.ts:186`). A second source,
  `getMembersofPrivateGroups()`, is a **dead shim returning `[]`** (`BomCommunity.ts:28`) — so
  cross-group visibility was already inert in legacy.
- **Green-field:** `leaderboard` resolver sets `hu.public = (visibility === 'public')` per row and
  applies `maskUserPrivacy`. Cross-group visibility is explicitly deferred (documented in the
  resolver) — matching the legacy dead shim. **Parity.**

### Group privacy — `messenger_channels.custom_type`
Enum: `open | public | private | solo | DM`.
- **open** — open enrollment, anyone may join directly.
- **public** — discoverable; join is by *request* (operator approval).
- **private** — invite/hash only; not discoverable.
- **solo** — single-user (personal) channel.
- **DM** — direct message.

---

## 2. Enforcement points — verified at parity

| Surface | Rule | Green-field | Legacy | Status |
|---|---|---|---|---|
| Featured / public feed | only `public` + `open` channels listed | `getPublicChannels` defaults `customTypes=['public','open']` — excludes private/solo/DM | `featuredChannels` filter | ✅ parity |
| Home **message feed** | only public + *viewer's own* channels | `featured (public/open) + getMyChannels(myUserId)` where `state='joined'` | `featuredHomeGroups + myHomeGroups` | ✅ parity, no leak |
| `homethread` / single-channel `homefeed` | private/DM gated on membership | `custom_type === 'private'\|'DM'` → membership check | same | ✅ parity |
| `requestedUsers` | operator-only | viewer must have `role==='operator'` else `[]` | n/a (new) | ✅ gated |
| `processRequest` (approve/deny) | operator-only | caller must be `role==='operator'` else `false` | same | ✅ gated |
| `joinOpenGroup` | requires `custom_type==='open'` | enforced | `BomCommunity.ts:628` | ✅ parity |
| `requestToJoinGroup` | requires `custom_type==='public'` | enforced | `BomCommunity.ts:655/682` | ✅ parity |
| `joinGroup` (hash) | invite-hash is the bearer credential | hash → channel, no type check (by design) | same | ✅ parity |
| Leaderboard | non-public users anonymized | `maskUserPrivacy` (masked nickname + dicebear) | `BomCommunity.ts:197,204` | ✅ parity (added this session) |
| `getMyChannels` | membership = `state='joined'` only | enforced | same | ✅ no pending-request leak |

**Masking algorithm** (`maskUserPrivacy` / `maskNickname`) ported verbatim: public users pass
through; private users get nickname `Ab████yz` + a seeded dicebear avatar, with `user_id` retained
for keying. Verified live: leaderboard returns e.g. `Ki████ey` for a non-public account.

---

## 3. Pre-existing design notes (NOT regressions — flag for product decision)

### A. `bom_user.visibility` is never written by application code
Neither the legacy backend (`src/`) **nor** green-field writes `bom_user.visibility` — it is read-only
in both. The column is set by some **external/older process** (original site, a retired Sendbird
webhook, or manual ops). 

**Implication:** your stated model — "a user is public based on being in a public group" — is **not
enforced by either codebase**. If the process that maintained `visibility` is gone, the column is
frozen, and the leaderboard's public/private decision runs off stale data (likely **over-masking**
users who have since joined public groups).

**Options if you want code to own this:**
1. Compute `public` live from membership: a user is public iff they belong to ≥1 `public`/`open`
   channel (`messenger_members ⋈ messenger_channels`), ignoring the column. Most faithful to your model.
2. Maintain `visibility` on join/leave of public groups (write path in `joinOpenGroup` /
   `requestToJoinGroup` / leave) — but writes are sandbox-suppressed in dev.
3. Leave as-is (column-driven) and document that an external job owns it.

### B. `requests` (pending join-requester user_ids) ship on every group object
`assembleHomeGroup` (GF) and `loadGroup` (legacy) both return `requests: [user_id]` and the full
`members` list on **every** group in `homefeed`/`homegroups` — including **featured public** groups,
to **any** viewer. The frontend likely only renders requests for operators, but the **data is sent
over the wire** regardless of role. Pre-existing in legacy; carried over unchanged.

**Recommendation:** gate `requests` (and arguably `members` for non-joined public groups) to
operators/members at the resolver, so pending-requester identities aren't broadcast. This would be a
*tightening* beyond legacy — confirm before changing, since it alters the payload shape.

### C. Within-group names are intentionally unmasked
Only the **leaderboard** masks. `homefeed` feed authors, `repliers`, and group `members` show real
nicknames. This is correct and matches legacy: members of a group you belong to (or a public group)
are meant to see each other. Documented here so it isn't mistaken for a missed mask.

---

## 4. What was checked but found clean
- No private/solo/DM channel surfaces in the public feed or featured list.
- No private-group **messages** reachable by non-members (feed scoped to joined + public).
- Pending-request members (`state='requested'`) do **not** receive group content (`getMyChannels`
  filters `state='joined'`).
- Operator gates on the two privileged operations (`requestedUsers`, `processRequest`).

## 5. Recommended follow-ups (priority order)
1. **Decide who owns `bom_user.visibility`** (note A) — this is the one with real user-facing impact
   (stale masking). If you want "public = in a public group," implement option A1.
2. **Gate `requests` to operators** (note B) — small resolver tightening; stops broadcasting
   pending-requester identities.
3. No action needed on note C.

---

## 6. Resolution (2026-06-10)

Notes A and B were implemented this session:

- **A — live visibility (option A1).** Added `getPublicUserIds(db, userIds)` in `messaging/members.ts`:
  a user is public iff `state='joined'` on ≥1 `public`/`open` channel. The `leaderboard` resolver now
  masks off this live set, not `bom_user.visibility` (no longer read anywhere). Verified: of 50 ranked
  users, ~6 are genuinely public (in a public/open group), the rest masked — versus the column-driven
  result which masked nearly everyone.
- **B — operator-gated `requests`.** `assembleHomeGroup` now takes `viewerUserId` and returns
  `requests: []` unless the viewer is an operator of that channel. Verified: a non-operator viewer's
  `homefeed` returns 0 groups exposing `requests` (was exposing them on every group before).

### Open item — profile-image re-hosting (data, not code)
Separately discovered while auditing avatars: the Sendbird migration copied `profile_url` **strings**
verbatim (`gen-sendbird-dump.mjs:258`) but never re-hosted the image **bytes**. Across ~570 seeded
users, ~270 avatars point at Sendbird-owned hosts (`static.sendbird.com`, `*.sendbird.com`,
`sendbird-us-1.s3`) that **die when Sendbird is decommissioned**, and 50 already 404/410
(`avatars.dicebear.com`, the retired dicebear v1).

- **Mitigated now:** `assembleHomeUser` treats dead `avatars.dicebear.com` URLs as empty → dicebear
  v7 fallback (the 50 already-broken ones render again). Live Sendbird-hosted images are left intact.
- **Still needed before Sendbird shutdown:** a one-time job that downloads each Sendbird-hosted image,
  re-uploads to `assets.bookofmormon.online/profiles/<md5(user)>.jpg` (the scheme `media/s3.ts`
  already uses), and rewrites `profile_url`. This is a write/prod job (sandbox suppresses writes) and
  needs S3 credentials. Not yet done.
