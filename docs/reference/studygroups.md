# Study Groups & Social Features — Product + Technical Reference

Evergreen reference for every social feature in Book of Mormon Online: what each
feature does for users, and how it is implemented across the frontend
(`frontend/webapp/`) and the green-field backend (`backend/`). Update in place as
the code changes.

Related documents: `docs/reference/messaging-platform.md`,
`docs/reference/messenger-backlog.md` (known deferred issues),
`docs/specs/2026-06-09-greenfield-messaging-platform.md`,
`docs/specs/2026-06-11-page-comments-best-in-class.md`,
`docs/plans/2026-06-11-sendbird-parity.md`.

---

## 1. Overview & mental model

Book of Mormon Online is a scripture-reading product first; the social layer
("study groups") wraps the reading experience so that people read *together*:
a reader joins one or more groups, sees groupmates' presence and progress while
reading, comments on specific verses/images/commentary, chats in a group
discussion, and follows group activity from a home feed.

Everything social is built on a single messaging substrate — **channels,
members, messages** — originally SendBird, now a self-hosted "messenger"
platform (GraphQL + socket.io + MySQL). The frontend still speaks the SendBird
SDK surface through a compatibility shim, which is why code says `sendbird`
everywhere:

- `frontend/webapp/src/models/MessengerController.js` — the SendBird-shaped
  client: GraphQL for reads/admin writes, one socket.io connection for live
  writes and events, and CustomEvent dispatch so legacy UI components work
  unchanged.
- `frontend/webapp/src/contexts/MessengerContext.js` — `MessengerProvider` owns
  the controller lifecycle (created on sign-in, torn down on identity change /
  sign-out) and assigns `appController.sendbird` as a compatibility bridge.
- `backend/src/messaging/*` — the service layer (channels, members, messages,
  reactions, readstate, presence, pagecomments, users, bots).
- `backend/src/realtime/*` — socket.io server, event handlers, the
  `RealtimeBus` fan-out, and the bot auto-responder.
- `backend/src/graphql/resolvers/messenger.ts` + `community.ts` — the GraphQL
  surface (schema: `backend/schema/Messenger.graphql`, `BomCommunity.graphql`).

Note the repo has two backends: the legacy `src/` (Express/Apollo/Sequelize)
and the green-field `backend/` (Fastify/Kysely). **Dev traffic goes to
`backend/`** (the `bom-greenfield` unit on :5006); all backend facts in this
document refer to `backend/`.

**Study mode toggle.** Social UI is opt-in per session via "study mode"
(`appController.states.studyGroup.studyModeOn`, persisted in
`localStorage.studyModeOn` — `frontend/webapp/src/models/appController.js:53`,
setter at `:477`). With study mode off: no comment inputs on pages, no verse
comment badges, no presence toasts. The toggle lives in the StudyGroupBar's
group selector (`views/_Common/Study/StudyGroupSelect.js:215`, with
`studymode-on`/`studymode-off` sounds).

**Community feature flag.** Messaging is gated at runtime by hostname so one
production build can serve staging-on/prod-off
(`frontend/webapp/src/models/featureFlags.js`):

- ON when `REACT_APP_USE_MESSENGER === 'true'` (build flag), OR the hostname is
  loopback/RFC1918 private, OR the first subdomain segment matches
  `REACT_APP_MESSENGER_HOSTS` (default `staging,bom,localhost`), exactly or as a
  `<host>-<lang>` prefix (`staging-ko.…`).
- Prod apex (`bookofmormon.online`) does not match → messaging off there.
- When off: `MessengerProvider` installs a no-op controller
  (`MessengerContext.js:21`), messaging routes (`/groups`, `/group/:id`,
  `/invite/:hash`) redirect (`models/Routes.js:66,190`), but `/home` (the feed)
  always renders — per-group join/post still gates on messaging being live
  (`Routes.js:50`).

---

## 2. Study groups

A study group **is a messenger channel** (`messenger_channels` row). Channel
fields: `channel_url` (PK, nanoid(11) for groups created server-side),
`name`, `cover_url`, `custom_type`, `description`, `metadata` (JSON; holds the
invite-link `hash` and bot-channel config), `lang`, timestamps
(`backend/src/messaging/channels.ts:53`).

### Types / privacy (`custom_type`)

| custom_type | Meaning | Join path | Discoverable? |
|---|---|---|---|
| `open` | Open enrollment group | One click — `joinOpenGroup` mutation | Yes (featured/public lists) |
| `public` | Apply-to-join group | `requestToJoinGroup` → operator `processRequest` | Yes |
| `private` | Invitation only | Invite link (`joinGroup` by hash) or `messengerInviteMembers` | No (feed gated on membership) |
| `solo` | Personal one-member group | Created solo | No |
| `DM` | Direct-message channel | Auto-created on first DM | No (excluded from group lists) |

The enum is enforced in SQL and in `createChannel`
(`backend/src/messaging/channels.ts:282`). Membership of a public/open group is
also the live definition of a *public user* for leaderboard masking
(`getPublicUserIds`, `backend/src/messaging/members.ts:45`).

### Membership model

`messenger_members` row per (channel_url, user_id):

| Field | Values | Notes |
|---|---|---|
| `role` | `operator` \| `member` | Operators get the admin panel and pass `requireOperator` gates |
| `state` | `joined` \| `invited` \| `requested` | Only `joined` members are in socket rooms / channel lists |
| `is_muted` | 0/1 | Muted members' `send_message` is rejected server-side |
| `last_read_at` | datetime | Drives unread counts (`backend/src/messaging/readstate.ts`) |

### Lifecycle

- **Create.** "Create new study group" UI (`views/_Common/Study/StudyGroupSelect.js:645`,
  `NewStudyGroup`): name, description, privacy radio (defaults open), generated
  dicebear-initials cover. Calls `MessengerController.createNewGroup`
  (`MessengerController.js:501`) → `messengerCreateChannel` mutation
  (`backend/src/graphql/resolvers/messenger.ts:286`) — acting user is forced
  into `operatorIds`; operators+userIds become `joined` members. After create,
  `generateGroupHash` (`StudyGroupSelect.js:627`) mints a short-link hash
  (`setShortLink` → `bom_shortlinks`) stored in channel metadata for the invite
  link, then the group is activated and the drawer opens. (Known limitation:
  channel cover-image *upload* is not supported by the green-field backend —
  `MessengerController.js:1230`.)
- **Join (open).** Home-feed `GroupCallToAction` button "join"
  (`views/Home/Home.js:414`) → `joinOpenGroup` mutation
  (`backend/src/graphql/resolvers/community.ts:782`): validates
  `custom_type === 'open'`, inserts a `joined` member, emits `user_joined` +
  `membership_changed`, then the client activates the group and opens the
  drawer.
- **Join (public, request + admission).** "request" button →
  `requestToJoinGroup` (`community.ts:819`): inserts member row with
  `state='requested'`; `withdrawRequest` (`community.ts:868`) deletes it.
  Operators see pending requests in the admin panel (`requestedUsers` query,
  operator-gated, `community.ts:669`) and grant/deny via `processRequest`
  (`community.ts:903`) — grant replaces the row with `state='joined'` and emits
  `user_joined`.
- **Join (private, invitation).** Via invite link (§3) or direct invitation
  rows (`state='invited'`), accepted with `messengerAcceptInvitation`.
- **Leave.** Group selector dropdown → `channel.leave()`
  (`StudyGroupSelect.js:335`, `MessengerController.js:1219`) →
  `messengerRemoveMember(self)`.
- **Removal / roles / muting (operator).** `StudyGroupAdmin.js` panel:
  remove/ban (`messengerRemoveMember` — `banMember` is currently an alias for
  remove, `MessengerController.js:880`), promote/demote
  (`messengerUpdateMemberRole` with role `operator`/`member`), mute/unmute
  (`messengerSetMute`). The mute is enforced in the realtime `send_message`
  handler (`backend/src/realtime/handlers/message.ts:90`).

### Group UI surfaces

- **GroupCard** (home feed left rail, `views/Home/Home.js:343`): cover, name,
  latest message preview, up to 4 member avatars, member count, and the
  privacy-appropriate call-to-action (Study / Request / Join / Sign in).
  A rich hover tooltip shows description + member progress
  (`groupToolTipHtml`, `Home.js:575`).
- **StudyGroupBar** (`views/_Common/Study/StudyGroupBar.js:76`): the persistent
  bottom bar — group selector + study-mode toggle (`StudyGroupSelect`), member
  presence circles with progress badges (`StudyGroupStatus`), bot circles /
  bot-plugin socket, and the StudyHall drawer toggle.
- **StudyHall drawer** (§5) for chat, members, DMs and admin.

---

## 3. Invitations

Two mechanisms exist: **invite links** (the primary flow) and **invitation
membership rows**.

**Invite links.** Every group can mint a short link: `setShortLink` stores
`channel_url` under a hash in `bom_shortlinks`; the hash is cached in channel
metadata. The "Invite" button in the StudyHall header
(`views/_Common/Study/StudyHall.js:92` — shown for open/public/private, not
solo/DM) and the group-selector dropdown fire a `showInviteLink` CustomEvent;
the modal (`views/_Common/AppModal/Components/InviteLink.js`) shows
`{origin}/invite/{hash}` with copy-to-clipboard and a QR code.

**Invitation landing page** (`views/User/Invitation.js`, route
`/invite/:hash` — `models/Routes.js:189`): loads a group preview via
`loadGroupsFromHash` (members with progress %, recent conversation —
`community.ts:473`), then:

1. Signed-in user clicks Accept → `joinGroup` mutation (`community.ts:742`):
   hash → channel_url → insert `joined` member → emits `user_joined`/
   `membership_changed`; client refreshes its group list, switches study mode
   on, activates the group, and opens the drawer (mobile: routes to
   `/group/:url/leaderboard`).
2. Guest clicks Accept → sign-up/sign-in flow inline, then auto-accepts when
   the messenger identity appears (`Invitation.js:64`).

Note `joinGroup` does **not** check `custom_type` — anyone holding a valid hash
joins directly, including private groups. That is the design: the link *is* the
invitation.

**Invitation rows.** `messengerInviteMembers(channelUrl, userIds)` inserts
members with `state='invited'` (`backend/src/graphql/resolvers/messenger.ts:526`);
`messengerAcceptInvitation` flips `invited → joined` (`:566`),
`messengerDeclineInvitation` deletes the row (`:601`). The client auto-accepts
when a user opens a chat for a channel where `myMemberState === "invited"`
(`views/_Common/Study/StudyChat.js:499`). There is currently **no dedicated UI
that calls `inviteMembers`** (the controller method exists at
`MessengerController.js:825`); the invite-link flow is what users actually use.
Also note: `messengerInviteMembers` has **no operator/membership gate** in the
resolver — any authenticated caller can create invited rows (the other admin
mutations are operator-gated; see §13).

---

## 4. Home feed

Route `/home` (`views/Home/Home.js`, `views/Home/Feed.js`). Always enabled,
even where messaging is off. Three GraphQL queries drive it (schema
`backend/schema/BomCommunity.graphql`, resolvers
`backend/src/graphql/resolvers/community.ts`):

- **`homegroups(token, grouping)`** → `[HomeGroup]` — the viewer's groups
  (`my_groups`) merged with featured public/open channels for the site language
  (`featured_groups`, lang fallback to `en`); unfiltered mode interleaves up to
  6, "see more" refetches one grouping (max 60). Each `HomeGroup`: url, name,
  description (parsed from the channel `data` JSON), `privacy` (= custom_type),
  picture, `latest` message, pending-request ids (operator-only — masked for
  everyone else, `community.ts:272`), members as `HomeUser` (nickname, picture,
  progress %, finished timestamps, bookmark).
- **`leaderboard(token)`** → recent finishers (last 10 `bom_log` `finished`
  events) + current progress (top 50 of `bom_user` active in 90 days, ranked by
  `complete`). Non-public users are anonymized: nickname masked to
  `Xx████xx` and picture replaced with the deterministic neutral avatar
  (`maskUserPrivacy`, `community.ts:176`; "public" = joined member of a
  public/open group, computed live by `getPublicUserIds`). Bots are dropped.
  The UI colorizes masked users deterministically (`privateStyle`,
  `Home.js:47`).
- **`homefeed(token, channel, message)`** → `{ groups, feed }`. Multi-channel
  mode merges featured + the viewer's channels and pulls the latest 30 messages
  per channel **in one windowed SQL query** (`getMessagesForChannels`,
  `backend/src/messaging/messages.ts:414` — the fix for the 9.5s→440ms feed
  N+1), then filters through `feedAlgorithm` (`community.ts:307`): keep the
  viewer's own messages; drop others' auto-generated commentary shares
  (`links.com` matching `/14\d{3}$/); drop others' link-less, thread-less
  messages under 300 chars; require a `custom_type` (page slug); sort newest
  first. Single-channel mode (`/home/:channelId[/:messageId]`) gates
  private/DM channels on membership.

Each `HomeFeedItem` carries the message, author `HomeUser`, `likes` (the first
reaction's user_ids — `community.ts:232`), `replycount` + up to 3 `repliers`,
`link {key,val}` (com/img/fax/text/section; page-scoped values are prefixed
with the page slug), and `highlights`. `Feed.js` renders the linked scripture /
image / commentary / facsimile content inline via `prepareQuery` +
`BoMOnlineAPI` (`views/_Common/Study/StudyChat.js:320`,
`views/_Common/Study/StudyInFeed.js`).

**Replies and likes from the feed.** Comments under a feed item load via
`homethread(token, channel, message)` (lazy: on visibility or "load N
comments"). Members get a reply box that posts through the *channel* object
(`sendUserMessage` with `parentMessageId` — `Feed.js:720`) and a Like button
that adds/removes a `like` reaction (`Feed.js:545`). Non-members see a disabled
"join to comment" textarea plus the group's join CTA (`Feed.js:695`).
(Residual wart: after posting a feed reply the client polls `homethread` every
5s — `Feed.js:763` — contrary to the no-polling directive.)

**Guests** see featured groups, the masked leaderboard, the feed, and sign-in
CTAs in place of join/comment actions. The reading-plan widget
(`views/Home/ReadingPlan.js`, `readingplan` query) renders above the feed when
no group is selected.

---

## 5. Study hall & chat

The **StudyHall** is the slide-up drawer (`appController.states.studyGroup.isDrawerOpen`)
hosting all in-group surfaces (`views/_Common/Study/StudyHall.js:43`):

- **Header**: group name + Invite button.
- **Sidebar** (`StudyGroupSideBar`): Admin panel entry (operators only, with
  pending-request count badge), Discussion entry (group cover + unread count),
  then one entry per groupmate — presence-aware circle, nickname, "currently
  studying"/"last studied" bookmark link, and click-to-DM. The roster refreshes
  on `memberPresenceChanged` events with a 1s debounce (`StudyHall.js:146`) —
  socket-pushed presence replaced the old 60s poll.
- **Main panel** (`StudyGroupMainPanel`): `chat` (default), `message` (DM),
  `admin`; `notebook` and `progress` panels exist but are currently disabled
  (`StudyHall.js:205` renders them under `false ?`).

**Live chat** (`views/_Common/Study/StudyChat.js`):

- History: `loadGroupMessages` (newest 30, oldest-first for the UI), infinite
  upward scroll via an IntersectionObserver on the oldest rendered message →
  `loadPreviousMessages` (`StudyChat.js:397`).
- Read state: opening the chat calls `channel.markAsRead()` (socket
  `mark_read`); an "unread" divider is drawn at `channel.myLastRead`.
- Plain messages post with `customType: "comment"`; the Advanced Editor
  (ReactQuill) posts rich HTML with `customType: "formatted_comment"`
  (`StudyChat.js:72-132`).
- Linked content referenced by messages (text/section/img/com/fax links) is
  prefetched in bulk (`prepareQuery`) and rendered inline.
- Messages support edit (own), delete (own), like, reply-in-thread (§7),
  @-mentions (`TagList` opens on `@`).
- A bot in the group triggers canned starter questions above the input
  (`Study.js:428`, gated by the `canned_responses` preference).

**Typing indicators.** `channel.startTyping()/endTyping()` (auto-stop after 5s)
emit socket `typing_start`/`typing_stop`; the server broadcasts `typing` to
everyone else in the room (`backend/src/realtime/handlers/typing.ts`); the
controller re-dispatches `typingStatusUpdated`, `Main.js` stores typer ids in
`states.studyGroup.typers[channelUrl]`, and both the chat (avatar + animated
ellipsis, `StudyChat.js:559`) and the bar circles (`isTyping` class) render it.
Additionally, *typing location* within a page is synced via `fire_action`
(`updateTypingLocation`) so a groupmate's comment box shows "X is writing"
under the same verse (`Study.js:288`).

**Presence colors & sounds.** Member circles are colored by status: blue =
in-call, green = online in this group, yellow = online elsewhere on the site,
grey = offline (`getFreshUsers`, `StudyGroupBar.js:110`). Status transitions
play sounds and pop toasts when study mode is on (`contacts-online`,
`contacts-offline`, `caller-online`, `caller-offline` —
`StudyGroupBar.js:184-368`), all gated by `preferences.sound`. Incoming live
messages from groupmates surface as 8-second speech bubbles over the sender's
circle (`liveMessageQueue` via the `fireMessage` event →
`appController.firedMessage`, rendered by `ActionBubble.js`).

**Calls.** `StudyGroupCall.js` survives from the SendBird Calls era, but the
green-field controller stubs all room methods (`fetchRoomFromGroup` returns
null — `MessengerController.js:1024-1039`), so voice calls are currently
non-functional; the blue/call UI states are vestigial.

---

## 6. In-page comments

The signature feature: comments scoped to a reading page and anchored to a
verse, image, commentary excerpt, or facsimile area.

**Data model.** A page comment is a normal channel message whose
`custom_type` is the **page slug** (e.g. `alma-32`), with an anchor in its
`data` JSON: `{ links: { text: "21" } }` (verse), `{ links: { com: 14123 } }`
(commentary id), `{ links: { img: 482 } }` (image id),
`{ links: { fax: "12.a" } }` (facsimile), plus optional
`highlights: ["quoted text", …]` and a `description` for highlight-only posts.
On the backend, link and highlights live in dedicated columns
(`link_type`/`link_target`/`link_aux`, `messenger_highlights`) and are
re-serialized into the `data` string on read (`buildDataString`,
`backend/src/messaging/messages.ts:49`). Posting happens in `Study.js`
(`sendMessage`, `Study.js:76`): top-level comments set
`customType = pageSlug`; replies set `parentMessageId` instead.
Highlight-only and image/fax-star posts use the sentinel message `"•"`,
rendered as "X added N highlights" / "X highlighted this image".

**Single-round-trip pipeline (P1, shipped).** On page/group change, `Page.js`
calls `sendbird.loadPageComments(group, pageSlug)`
(`views/Page/Page.js:446-552`, `MessengerController.js:566`), which issues ONE
GraphQL query:

```
pagecomments(channelUrl, pageSlug) → { messages, counts }
```

- `messages`: SQL-filtered to `custom_type = pageSlug` (limit 500) — page
  comments older than recent chatter stay reachable
  (`backend/src/messaging/pagecomments.ts:117`).
- `counts`: per-verse `{ "<verseNum>": { com: [ids], img: [ids] } }`, resolved
  server-side by mapping each referenced commentary/image's `location_guid`
  through `bom_text` and the SlugResolver back to this page's verse numbers —
  replacing the old second round trip (`commentaryLocations`/`imageLocations`).
  Facsimile (`fax`) counts derive client-side from the message index alone
  (`views/Page/pageCommentCounts.js`).

The client indexes messages by anchor (`indexPageComments`, `Page.js:845` —
`{ text: {21: msg}, com: {14123: msg}, … }`), merges fax counts, and lands
index AND counts in a single dispatch, deferred through
`pageScrollManager.waitForIdle()` so the paint never competes with a scroll
animation (`Page.js:538`). All comment-driven UI is absolutely positioned, so
arrival causes zero layout shift (see the P2 audit in
`docs/specs/2026-06-11-page-comments-best-in-class.md`).

**UI.** Verses with activity get a 💬 badge (`views/Page/TextContent.js:286`,
only when study mode is on); commentary/image bubbles get count badges.
Expanding a verse shows the comment thread (`Study.js` `Comments`): first
comment + threaded replies + input with mentions, highlights, canned bot
prompts, edit/delete/like/reply footers.

**Live updates.** When a socket `message_received` arrives whose `custom_type`
matches a page and the channel is the active group, the controller dispatches
`addMessageToPage-<slug>` (`MessengerController.js:259`); `Page.js` listens and
patches the comment index in place — no refetch.

---

## 7. Threads & replies

Any message can be a thread parent. Replies are messages with
`parent_message_id` set; they are excluded from top-level history/feeds and
fetched separately.

- **Backend**: `getThread(db, parentMessageId)` returns replies oldest-first
  (`backend/src/messaging/messages.ts:456`); `thread_info` on a parent is
  computed at assembly time — `reply_count` plus `most_replies` (up to 3 unique
  repliers, reverse-chronological; `messages.ts:198`). GraphQL:
  `messengerThreadMessages(parentMessageId)`; the feed uses
  `homethread`/`postcomments`.
- **Frontend**: `loadThreadedMessages` (`MessengerController.js:612`).
  Three thread UIs:
  - Page comments: `ThreadedMessages` (`views/_Common/Study/Study.js:581`) —
    collapsed "view N more comments" row with replier avatars, auto-expanded
    under 3 replies; listens for `addMessageToThread<id>` /
    `updateMessageInThread<id>` / `deleteMessageFromThread<id>` CustomEvents.
  - Study-hall chat: clicking a message's reply count opens the side-by-side
    `StudyGroupThread` panel (`StudyChat.js:600`, hosted by
    `StudyGroupChatPanel`).
  - Home feed: `Comments`/`Comment` in `views/Home/Feed.js:477`.
- **Sending a reply**: `channel.sendUserMessage({ …, parentMessageId })` →
  socket `send_message` with `parentMessageId` → persisted, then
  `message_received` is routed to `addMessageToThread<parentId>` because the
  payload carries `parent_message_id` (`MessengerController.js:247`).
- Caveat: the SDL only exposes `thread_info { reply_count }` — the client's
  `shapeThreadInfo` therefore always renders `mostRepliedUsers: []` for
  fetched messages (`models/messengerShapes.js:77`); replier faces only appear
  on home-feed items (which use the community SDL's `repliers`).

---

## 8. Reactions & likes

**Storage**: `messenger_reactions` (message_id, user_id, reaction_key) with a
uniqueness constraint; add is idempotent (`backend/src/messaging/reactions.ts:27`).
The only key the UI uses today is `like` (👍), but the model is generic.

**Shape**: aggregated per message as `[{ key|reaction_key, user_ids }]`
(GraphQL renames `key → reaction_key`, `resolvers/messenger.ts:253`).

**Flow**: `channel.addReaction/deleteReaction` (`MessengerController.js:1254`)
emit socket `add_reaction`/`remove_reaction`; the handler persists and
broadcasts `reaction_changed` with a **full reaction snapshot** to the room
(`backend/src/realtime/handlers/reaction.ts:37`). The controller re-dispatches
`reactTo<messageId>`; message objects expose `applyReactionEvent` accepting
both the snapshot form and the optimistic local delta form
(`MessengerController.js:342`).

**Display**: `LikeButton` (`views/_Common/Study/Study.js:1118`) renders either
the page-comment footer Like/Unlike + "👍 name, name" row, or the chat-style
`👍 N` count with a who-liked tooltip. Names resolve via `shapeReacters`
(`models/messengerShapes.js:90`), which maps reaction user_ids to channel
members **by id** (falling back to the raw id for departed members). The home
feed shows likes from `HomeFeedItem.likes` with a member-map tooltip
(`Feed.js:379`).

---

## 9. Highlights & scripture references

**Highlights** (user-selected quote spans): selected text on a page becomes
removable tags above the comment input (`InputHighlights`, `Study.js:501`);
on send they ride in `data.highlights` and are persisted to
`messenger_highlights` (ordinal-ordered, `messages.ts:327`). Rendered comments
show the quoted tags; hovering a comment re-highlights its spans in the verse
text (`Study.js:791`). A highlight-only save posts the `"•"` sentinel with an
auto description. Feed/chat renderings pass `highlights` into the inline
content components to paint the quoted spans (`TextInFeed`).

**Content links**: the `data.links` object (one key per message) anchors a
message to content — `text`/`section` (verse/section number, combined with the
page-slug `custom_type` to form `slug/num`), `com` (commentary id), `img`
(image id), `fax` (facsimile `page.version`). The backend stores these in
`link_type`/`link_target`/`link_aux` and the GraphQL `MessengerMessage`
exposes `link_type`/`link_target` extracted from data
(`resolvers/messenger.ts:60`). Feed and chat use them to render the referenced
scripture passage, artwork, commentary card or facsimile inline (§4, §5).

**Scripture references in message text**: free-typed references ("Alma 32:21")
are detected at render time by the `scripture-guide` library
(`detectReferences` in `models/Utils.js:836` inside `formatText`/
`ParseMessage`) and become tappable links that open a scripture panel
(`ScripturesContainer`, `Utils.js:695`); URLs get link previews, and
commentary URLs render commentary preview cards.

**Mentions**: typing `@` opens `TagList` (group-member picker). Mentioned ids
are sent as `params.mentionedUserIds` and persisted **inside the message's data
JSON** (`{ mentionedUserIds: [...], mentionType: "users" }`) — there is no
dedicated column (`MessengerController.js:1158`,
`backend/src/messaging/messages.ts:291`). On read, `shapeMessage` resolves the
ids back to user objects from cached channel members
(`models/messengerShapes.js:46`). Known gap: editing a message cannot change
mentions (backlog #4).

---

## 10. Direct messages

DMs are channels with `custom_type = 'DM'` between exactly two users.

- **Creation / distinct reuse**: clicking a member in the StudyHall sidebar
  opens `DirectMessages.js`, which calls
  `sb.groupChannel.createChannel({ isDistinct: true, invitedUserIds: [me, them],
  customType: "DM", channelUrl: md5() })`. The controller first searches the
  user's existing channels for one with the same custom type and identical
  member set, and reuses it (`MessengerController.js:1448-1486`) — so a pair of
  users always converses in one channel. Otherwise `messengerCreateChannel`
  creates it (client-supplied `channelUrl` honored), with both users `joined`.
- **Exclusion from group surfaces**: `getStudyGroups()` requests only
  `["open","private","public","solo"]` (`MessengerController.js:436`), so DMs
  never appear in the group list; the DM panel itself filters
  `customTypesFilter: ["DM"]`.
- **Chat**: the DM panel reuses `StudyGroupChatPanel` with a "DMs with X"
  header (`StudyHall.js:313`).
- **Unread counts**: `messengerUnreadDMs(userId)` returns
  `{channel_url, other_user_id, unread_count}` for DM channels with unread
  messages (`resolvers/messenger.ts:204`); the controller maps it to
  `{otherUserId: {unread, channel}}` (`loadUnreadDMs`) and stores it in
  `states.studyGroup.unreadDMs`. Live updates: on every send the server emits
  `unread_count_changed` to the room; `mark_read` returns a unicast
  `unread_count_changed` with the fresh count
  (`backend/src/realtime/handlers/read.ts`). The client debounces bursts
  ~500ms, then refetches and dispatches `unreadMessageCountChanged`
  (`MessengerController.js:208`) — consumed by the sidebar/bar badges
  (`UnreadDMCount`, `StudyGroupBar.js:556`).
- Unread semantics: top-level, non-deleted messages newer than the member's
  `last_read_at`, authored by someone else (`readstate.ts:58`).

---

## 11. Bots

**Registry.** A bot is a `messenger_users` row with `is_bot = 1`, but
*pluggability* requires registration in `bom_bot` (`bot_id` = messenger
user_id) with `bot_class` and `enabled` (design:
`docs/plans/2026-06-11-study-bot-enrichment-design.md`):

| bot_class | Behavior | Examples |
|---|---|---|
| `study` | User-pluggable assistant; appears in the picker; replies to group messages | StudyBuddy (en), SchriftStudierBot (de), KasulatanBot (tgl), Écritudiant (fr), 스터디버디 (ko), BotHọcKinhThánh (vn); Help Desk + Linguist (`lang NULL` = every language) |
| `community` | Scheduled persona-to-persona conversations in dedicated channels; never in the picker | The 10 Reformers (Martin Luther, John Calvin, …) |

The picker query `botlist` joins `bom_bot` with `bot_class='study'`,
`enabled=1`, and `lang = normalized-site-lang OR lang IS NULL`
(`listStudyBots`, `backend/src/messaging/users.ts:377`; English editions
`rlds/covoc/str/plain/easy/concise` normalize to `en`). Junk `is_bot` rows
without a `bom_bot` registration never appear.

**Plug / unplug.** The StudyGroupBar shows a socket-plug icon to **operators
only** (`BotPlugin`, `StudyGroupBar.js:414`); choosing a bot calls the
`addBot(token, channel, bot)` mutation — operator-gated server-side too, and
`addBotToChannel` additionally requires a registered, enabled study bot
(`backend/src/messaging/bots/registry.ts:40`); `removeBot` (also
operator-gated) removes it. Plugged bots render as BOT-badged circles in the
bar and are filtered out of human rosters/member lists (`metaData.isBot`).

**Reply loop.** Every successful human `send_message` fires
`maybeBotReply(db, channelUrl, msg)` (fire-and-forget,
`backend/src/realtime/handlers/message.ts:113`;
`backend/src/realtime/botResponder.ts:87`):

1. Skip if the trigger was bot-authored (no bot-to-bot chains) or a reply is
   already in flight for the channel (per-channel debounce Set).
2. Find bot members (`messenger_members ⋈ messenger_users is_bot=1`); use the
   first (one bot per channel, legacy parity).
3. Load the last 10 top-level messages, map to user/assistant turns.
4. `generateBotReply` (`backend/src/bots/generate.ts`) runs the bot's **Mastra
   agent** — persona, tools and model resolved from `bom_bot`
   (`backend/src/bots/mastra/agents.ts`; persona text in `bom_bot.persona`
   with seeded fallbacks in `backend/src/messaging/bots/personas.ts`).
5. Post the reply via the normal `postMessage` path and broadcast
   `message_received` — clients render it like any message.

**Community scheduler.** `backend/src/bots/scheduler.ts`: a 60s tick (Redis
lock for multi-instance) runs due `bom_bot_schedule` rows; the `new_prompt`
action posts an unposted discussion prompt (`bom_virtualgroup_prompts`) to a
bot channel as the tagged bot, then has the channel's other bots comment
(2-N replies, each from its Mastra agent). Channel-side config lives in
`messenger_channels.metadata.bot` (`{tag, comment_min, comment_max, enabled}`).

Bots authenticate sockets with `MESSENGER_BOT_TOKEN` (bots have
`bom_user_id NULL` — `backend/src/realtime/server.ts:77`), though the
responder/scheduler post server-side and don't need sockets.

---

## 12. Presence & realtime

**Server**: socket.io attached to Fastify at path `/messenger`
(`backend/src/realtime/server.ts:179`), optional Redis adapter for
multi-instance. Handshake auth: `{userId, token}` → `messenger_users` row →
`bom_user_token` check (or bot token). On connect the socket joins a room per
joined channel and presence flips online; on disconnect, offline +
`last_seen_at` stamped.

**Presence** (`backend/src/messaging/presence.ts`): Redis `presence:online`
set + per-user 90s heartbeat TTL key (crash-safe), with an in-process Set
fallback when Redis is absent (single-instance only; see backlog #8 — presence
is per-user, so closing one of multiple tabs broadcasts a false offline).
`user_presence` is broadcast to every room the user belongs to on
connect/disconnect; the client patches the cached member's `connectionStatus`
in place and fires `memberPresenceChanged` (`MessengerController.js:228`) —
this replaced the 60s roster poll (parity task 12).

**Event catalog**:

| Client → server | Payload | Handler |
|---|---|---|
| `send_message` | `{channelUrl, message, link?, highlights?, data?, customType?, parentMessageId?}` | `handlers/message.ts` (mute-gated; triggers bot reply) |
| `edit_message` | `{channelUrl, messageId, message?, customType?}` | `handlers/message.ts` |
| `delete_message` | `{channelUrl, messageId}` | soft delete (`is_deleted=1`) |
| `add_reaction` / `remove_reaction` | `{channelUrl, messageId, reactionKey}` | `handlers/reaction.ts` |
| `typing_start` / `typing_stop` | `{channelUrl}` | `handlers/typing.ts` (broadcast, sender excluded) |
| `mark_read` | `{channelUrl}` | `handlers/read.ts` (stamps `last_read_at`) |
| `fire_action` | `{channelUrl, action}` | `handlers/action.ts` (pure broadcast, sender excluded) |
| `update_state` | `{activeGroup, activeCall}` | persists user metadata; no broadcast |

| Server → client | Scope | Client effect (`MessengerController.setupEventHandlers`) |
|---|---|---|
| `message_received` | room (incl. sender) | `addMessage` / `addMessageToThread<id>` / `addMessageToPage-<slug>` + `fireMessage` (speech bubbles) |
| `message_updated` | room | `updateMessage` / `updateMessageInThread<id>` / `updateMessageToPage-<slug>` |
| `message_deleted` | room | currently a logged no-op (legacy parity) |
| `typing` | room minus sender | `typingStatusUpdated` → `states.studyGroup.typers` |
| `reaction_changed` | room | `reactTo<messageId>` with full snapshot |
| `channel_action` | room minus sender | `fireStudyGroupAction` → `processStudyGroupEvent` (page-position sync, typing locations, user summaries) |
| `membership_changed` | room | refresh the cached channel (`refreshChannel`) |
| `user_joined` / `user_left` | room | refresh the cached channel |
| `unread_count_changed` | room (on send) / unicast (on mark_read) | debounced ~500ms → `loadUnreadDMs` + `unreadMessageCountChanged` |
| `user_presence` | every room of the user | patch `connectionStatus` + `memberPresenceChanged` |

GraphQL membership mutations emit the same events through the `RealtimeBus`
singleton (`backend/src/realtime/RealtimeBus.ts` — `getBus().emit(event, room,
payload)`, a safe no-op before the socket server is up).

**One socket per page.** The controller enforces a singleton: a new instance
disconnects any previous `window.__messengerSocket` before registering its own
(`MessengerController.js:108`) — guarding against sign-in re-init and HMR
leaks, where a shadow socket would double-render every inbound message.
`MessengerProvider` is the only thing that creates/destroys controllers
(create on sign-in, disconnect on identity change/sign-out/unmount,
`MessengerContext.js:67-110`).

**No-polling directive (KC).** Live community/study state must arrive via
socket push with in-place cache patching, not polling. Status: the 60s roster
poll and the per-message unread poll are gone; survivors are the
`StudyGroupCall` 1s call-state poll (vestigial; backlog #5) and the home-feed
post-reply 5s `homethread` poll (`Feed.js:763`).

---

## 13. Identity & privacy

**Identity.** Messenger user_id = `md5(bom_user.user)` (the username).
`messenger_users` links to the account via `bom_user_id`; "thin" human rows
keep `nickname`/`profile_url` NULL and coalesce display name from
`bom_user.name` at read time (`backend/src/messaging/users.ts:110`). Rows are
auto-provisioned at `tokensignin` (insert-if-missing —
`backend/src/graphql/resolvers/userauth.ts:53`) because members/messages/
reactions/sockets all FK to `messenger_users.user_id`. Auth everywhere is the
`bom_user_token` session token: GraphQL mutations take it as a bearer header
(`resolveActingUserId`, `resolvers/messenger.ts:26`) or `token` arg
(community resolvers), and the socket handshake verifies it
(`realtime/server.ts:54`).

**Avatars.** Single source of truth is the read path (`getUser` →
`avatarAssets`), resolution order:

1. **Stored `profile_url`** — explicit values pass through: an S3 upload
   (`{assets}/profiles/{md5(username)}.jpg`), a migrated mirror, a social
   provider URL, or a gravatar URL (a one-time 2026-06-11 data sweep stored
   `gravatar.com/avatar/<emailhash>?s=256&d=404` for users whose email had a
   gravatar and who had no other image — `d=404` means a later-deleted
   gravatar 404s into the frontend fallback). Stored URLs on dead hosts
   (`avatars.dicebear.com`, HTTP 410) are scrubbed to absent first
   (`users.ts:89`).
2. **Derived asset URL** — for NULL rows, derive
   `{PROFILE_IMAGE_BASE}/profiles/{md5}.jpg` and verify existence with a
   1-byte ranged GET, cached 24h-positive/60s-negative
   (`backend/src/messaging/avatarAssets.ts`).
3. **Deterministic dicebear `thumbs` fallback** — same generator on both ends
   (`generateAvatarUrl`, ported from `components/UserAvatar.js`).

At social sign-in, a fresh provider URL is persisted only when it fills a gap
or replaces a stale external URL — it never overwrites an S3 upload or an
assets-host mirror (`shouldRefreshStoredAvatar`, `avatarAssets.ts:129`;
applied in `backend/src/data/loaders/socialsignin.ts:91`).

**Authorization gates.** `requireOperator` protects channel-admin mutations:
`messengerUpdateChannel`, `messengerUpdateMemberRole`, `messengerSetMute`,
`messengerRemoveMember` (unless removing self), plus `addBot`/`removeBot`,
`processRequest`, and the `requestedUsers` query. Gaps to be aware of:
`messengerInviteMembers` and `messengerAcceptInvitation`/`Decline` accept an
arbitrary `userId` arg without verifying it matches the bearer, and
`messengerUpdateUser`/`messengerUpdateUserMetadata` likewise act on the passed
`userId`. Socket writes authenticate the *connection* but `send_message` does
not verify channel membership beyond the mute check.

**What guests see.** The home feed and featured groups (names, covers,
member avatars/progress, latest messages of public/open channels), the masked
leaderboard, and invite-link previews. Private and DM channel content is
membership-gated in `homefeed`/`homethread`; pending-request lists are
operator-only; non-public users are anonymized on the leaderboard (public =
joined member of at least one public/open group — `getPublicUserIds`).

**Sandbox (dev).** The dev backend runs read-only: `SANDBOX` wraps the Kysely
dialect driver and silently swallows every query-builder
INSERT/UPDATE/DELETE/MERGE (`backend/src/data/sandboxDialect.ts`) — so on dev,
joins/posts/reactions appear to succeed but persist nothing. Raw `` sql`…` ``
template writes are NOT intercepted (documented limitation); the dev DB user is
read-only as a second line of defense. (Temporary exception noted in memory:
:5006 was intentionally switched to RW for manual testing on 2026-06-11.)

---

## 14. User stories & flows appendix

1. **As a reader I join an open group from the home feed.**
   `/home` → `homegroups` renders a `GroupCard` → "join" (`GroupCallToAction`,
   `Home.js:496`) → `joinOpenGroup` mutation validates `custom_type='open'`,
   inserts the joined member, emits `user_joined`/`membership_changed` →
   client fetches the channel, `setActiveStudyGroup`, `setStudyMode(true)`,
   `openDrawer(true)` → I'm in the StudyHall chat.

2. **As a reader I apply to a public group and get admitted.**
   GroupCard "request" → `requestToJoinGroup` inserts `state='requested'` →
   button flips to "applied" (withdrawable). An operator's admin panel shows my
   request (`requestedUsers`) → grant via `processRequest` → my row becomes
   `joined`, `user_joined` fires, and the group appears in my next group-list
   refresh.

3. **As a group creator I make a private group and share an invite link.**
   StudyGroupBar group list → "Create new study group"
   (`StudyGroupSelect.js:645`) → `messengerCreateChannel` (me as operator) →
   `generateGroupHash` mints a `bom_shortlinks` hash → Invite button →
   InviteLink modal with `{origin}/invite/{hash}` + QR. A friend opens it,
   previews members/conversation (`loadGroupsFromHash`), accepts → `joinGroup`
   → group activates in their drawer.

4. **As a guest I receive an invite link and create an account.**
   `/invite/:hash` → Accept → "account required" panel → Sign up (social or
   form) → `tokensignin` auto-provisions my `messenger_users` row → the effect
   on `currentUser` re-triggers `handleAccept` → joined and dropped into the
   group (`Invitation.js:64`).

5. **As a member I comment on Alma 32:21 and my groupmates see it live.**
   Reading with study mode on → expand verse 21 → type in `CommentInput`
   (`Study.js:347`) → `channel.sendUserMessage({customType: "alma-32",
   data: {links: {text: "21"}}})` → socket `send_message` persists + broadcasts
   `message_received` → groupmates on the same page get
   `addMessageToPage-alma-32` and the comment appears in place; everyone
   else's channel cache refreshes; their verse badge count includes it on next
   page load.

6. **As a member I highlight a passage and save it.**
   Select text → highlight tags appear above the input → "Save highlight"
   posts the `"•"` sentinel with `data.highlights` → stored in
   `messenger_highlights` → groupmates see "X added 1 highlight" with the
   quoted span; hovering re-paints the highlight in the verse.

7. **As a member I reply in a thread from the home feed.**
   `/home` shows a groupmate's comment → `homethread` loads existing replies →
   I type in the reply box (`Feed.js:720`) → `sendUserMessage` with
   `parentMessageId = item.id` → thread members get
   `addMessageToThread<id>`; the parent's `thread_info.reply_count` reflects it
   on the next feed assembly.

8. **As a member I like a groupmate's comment.**
   `LikeButton` → `channel.addReaction(message, "like")` → socket
   `add_reaction` inserts the row → `reaction_changed` snapshot broadcast →
   every open client runs `applyReactionEvent` and the 👍 names/count update —
   no refetch.

9. **As an operator I plug StudyBuddy into my group.**
   StudyGroupBar plug icon (operator-only) → `botlist` (study bots for my
   language) → pick StudyBuddy → `addBot` mutation (operator gate + study-bot
   registry check) → `user_joined` fires, bot circle appears. Next human
   message triggers `maybeBotReply`: history → Mastra agent (persona from
   `bom_bot.persona`) → reply posted and broadcast like any message. Canned
   starter questions appear above comment inputs while a bot is present.

10. **As an operator I mute a disruptive member.**
    StudyHall → Admin panel → mute (`messengerSetMute(muted: true)`,
    operator-gated) → their next `send_message` is rejected with "You are
    muted in this channel" (`handlers/message.ts:90`); `membership_changed`
    refreshes everyone's member list. Unmute reverses it.

11. **As a member I DM a groupmate.**
    StudyHall sidebar → click their row (`setPanel({key:"message",
    val:userId})`) → `DirectMessages.js` looks for an existing distinct DM
    channel with exactly the two of us; reuses it or creates one
    (`customType: "DM"`) → chat panel opens. When they message me later,
    `unread_count_changed` → debounced `messengerUnreadDMs` refetch → a badge
    appears on their circle in my StudyGroupBar.

12. **As a member I see who's studying what, live.**
    Socket connect flips me online (Redis presence) and broadcasts
    `user_presence` to all my groups' rooms → groupmates' StudyGroupBar circles
    recolor within ~1s (debounced roster refresh). My reading position syncs
    via `fire_action`/`channel_action` (`updatePagePosition`) and my bookmark/
    progress summary via `updateUserSummary` metadata — groupmates' sidebar
    shows "currently studying: Alma 32" linking to my page.

13. **As a member I follow a deep link to a specific group message.**
    `/home/:channelId/:messageId` → `homefeed` single-channel mode gates
    private channels on my membership, finds the root message (resolving up
    from a reply), and renders it with its thread; `/group/:channelId/:messageId`
    opens the same inside the StudyHall chat.

14. **As a reader I check the leaderboard without exposing private users.**
    `leaderboard` ranks active users by completion; users not in any
    public/open group come back masked (`Jo████hn`, neutral avatar) — the
    UI tints masked avatars deterministically; bots are excluded.

15. **As a curious reader I watch the Reformers debate.**
    The community-bot scheduler posts a scripture discussion prompt to the
    Reformers channel on its cron, then each persona bot (Luther, Calvin, …)
    comments via its Mastra agent. The channel is a public group in the feed,
    so its conversation surfaces in `homefeed` like any other group's.

---

### Quick reference — DB tables

| Table | Purpose |
|---|---|
| `messenger_channels` | groups + DMs (custom_type, metadata, lang) |
| `messenger_members` | membership (role, state, is_muted, last_read_at) |
| `messenger_messages` | messages (custom_type = page slug for page comments; link_* columns; metadata JSON for mentions; parent_message_id; is_deleted) |
| `messenger_highlights` | ordered quote spans per message |
| `messenger_reactions` | (message_id, user_id, reaction_key) |
| `messenger_users` | messenger identity (md5 id, bom_user_id link, nickname, profile_url, metadata, is_bot, last_seen_at) |
| `bom_bot` (+ `bom_bot_schedule`, `bom_virtualgroup_prompts`) | bot registry (bot_class, lang, persona, enabled) + community-bot cron |
| `bom_shortlinks` | invite-link hash → channel_url |
| `bom_user`, `bom_user_token`, `bom_log` | account, session tokens, progress events (leaderboard) |
