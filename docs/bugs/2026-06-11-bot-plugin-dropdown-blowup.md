# Bot Plugin Dropdown renders off-screen / unusable

**Date:** 2026-06-11
**Symptom:** Hovering the socket (plug) icon in the StudyGroupBar opens a huge, mostly blank white bubble anchored *above* the bar and clipped off the top of the viewport. The bot list is unusable.

## Root cause chain (three layers)

### 1. Data: 83 users are flagged as bots — ~74 of them aren't bots

`botlist` on the running dev backend returns **83 entries**. Only ~6 are genuine
study bots (`enabled: true`, e.g. KasulatanBot, SchriftStudierBot, Écritudiant,
스터디버디). The rest are clearly regular/legacy virtual users mis-flagged
`is_bot = true` in `messenger_users` during the SendBird→green-field migration:
random anon handles (`angryzebra116_c8103f07`), bare hex/numeric IDs (`148965`,
`C3E95C2AD963`), and human-looking names (`Cindy Cunningham`, `Ricardo Woods`)
with default `"A helpful bot"` descriptions.

`messenger.listBotUsers()` (`src/library/messenger.ts:186`) is a straight
`WHERE is_bot = true` — correct code, polluted flag.

Verified live:

```
POST https://bom.kckern.net/graphql  { botlist { id name enabled } }
→ 83 bots; 9 filtered by the frontend's 🟢 hack; 74 rendered; 6 enabled
```

### 2. Frontend: renders all 74, menu has no height limit

`BotPlugin` (`frontend/webapp/src/views/_Common/Study/StudyGroupBar.js:414`)
renders a `DropdownItem` (image + name + description + divider) for every bot
except 🟢-prefixed ones — no `enabled` filter for display. With 74 items the
menu is thousands of pixels tall; `.userStatus .dropdown-menu`
(`StudyGroupBar.scss:606`) sets width but **no `max-height`/`overflow-y`**, so
Popper flips/clips the oversized menu above the toggle → the off-screen bubble
in the screenshot. Several legacy avatar URLs also point at the long-dead
`avatars.dicebear.com/api/...` endpoint, adding blank image boxes.

### 3. HEAD vs deployed: at HEAD the feature is dead anyway

The deployed dev backend predates current HEAD (it serves `botlist` data but
lacks the `messengerBots` field). At HEAD:

- `botlist` resolves via the gutted SendBird shim — `listBotUsers: async () => []`
  (`src/resolvers/BomCommunity.ts:26`) → dropdown will always be **empty**.
- `addBot`/`removeBot` (`BomCommunity.ts:544/561`) call
  `userIsChannelAdmin` → `sendbird.loadChannel()` → `null` →
  `group.members` throws → caught → `false`. Plugging a bot **silently fails**.
- The real implementation exists (`messenger.listBotUsers`, exposed as the
  `messengerBots` query in `BomMessenger.ts:28`), but the frontend still
  queries `botlist`. So redeploying dev at HEAD trades "74 junk bots" for
  "no bots at all."

## Secondary findings in `BotPlugin` (StudyGroupBar.js)

- `if(/🟢/.test(bot?.name)) return null` (line 494) — UI-side workaround for a
  data-quality problem; belongs in the resolver/data, not the render path.
- `botlist.sort((a, b) => (a.enabled ? -1 : 1))` (line 454) — comparator
  ignores `b`; inconsistent comparator → ordering is undefined per spec.
- `addingBot` is a single boolean for the whole menu: while one bot is being
  added, **every** row's button switches to "plugging in {its own name}".
- `toggle={() => {}}` + hover-only open/close — dropdown cannot be opened on
  touch devices; clicking the toggle does nothing.
- Disabled bots get `onClick` no-op but not the `disabled` prop on
  `DropdownItem`, so they still look interactive.
- `botlist` requires no token — the mis-flagged real-user rows (nickname +
  avatar URL) are publicly enumerable; minor privacy leak until the flags are
  cleaned.

## Runtime verification (2026-06-11, Playwright vs `http://10.0.0.10:8200`)

Logged in as the staff beta account, hovered the socket icon, measured the
open menu in-browser:

```
items: 74            (enabled: 6)
placement: top-start (Popper flipped above the toggle)
rect: top -4717.6px, height 4727.6px, bottom +10px
viewport: 900px      → only the bottom ~10px sliver is on screen
```

Exactly matches the reported screenshot: the menu mounts and populates, but
74 unscrollable items make it ~4,700px tall; Popper flips it to `top-start`
and nearly all of it lands above the viewport. Also confirmed the legacy
`avatars.dicebear.com` picture URLs in the list now return **HTTP 410 Gone**.
`addBot` was deliberately NOT exercised (would mutate a real dev study group).

## Suggested remediation (not applied)

1. **Data:** clean `messenger_users.is_bot` so only genuine bots carry the flag
   (migration/SQL belongs in the private workspace repo).
2. **Backend:** wire `Query.botlist` to `messenger.listBotUsers()` (or point the
   frontend at `messengerBots`), and re-implement `addBot`/`removeBot` against
   the green-field messenger instead of the dead shim. Filter to
   `enabled`/welcome-bearing bots server-side.
3. **Frontend:** drop the 🟢 hack, show only `enabled` bots, fix the sort
   comparator, give `.userStatus .dropdown-menu` a `max-height` +
   `overflow-y: auto` as a guardrail, track `addingBot` per bot id.
