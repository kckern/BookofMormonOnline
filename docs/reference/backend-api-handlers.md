# BookofMormonOnline Backend API Handlers – Inventory & Modernization Audit

**Generated:** 2026-05-08  
**Backend Stack:** Node.js + TypeScript + Express + Apollo GraphQL  
**Scope:** Complete REST API handlers and GraphQL Query/Mutation resolvers

---

## 1. REST Endpoints

### 1.1 Registered Endpoints (GET)

| HTTP | Path | Handler | What it does | Auth |
|------|------|---------|-------------|------|
| GET | `/ping` | `src/library/ping.ts` | Analytics passthrough—logs analytics pings | No |
| GET | `/mapmarker/:id` | `src/api/mapmarkers.ts:mapMarker` | Returns SVG marker for place with name translation | No |
| GET | `/*` (SSR routes) | `src/ssr/index.ts:handleSSR` | Server-side render page; proxies to SSR_TARGET | No |

### 1.2 Registered APIs (POST)

| HTTP | Path | Handler | What it does | Auth |
|------|------|---------|-------------|------|
| POST | `/webhook` | `src/api/index.ts:webhook` | Webhook entry—routes to studybuddy/virtualgroup by trigger | Token (BomUserToken) |
| POST | `/studybuddy` | `src/api/studybuddy.ts:studyBuddyTextBlock` | AI-powered study assistant—generates responses to study questions | No (context-aware) |
| POST | `/translate` | `src/api/translate.ts:translate` | Translation management—list, audit, update, get context for localized content | No (internal admin tool) |
| POST | `/coords` | `src/api/coords.ts:updateCoords` | Map coordinate updates—persist marker positions for places | Token (BomUserToken) + mapper role |
| POST | `/mapmarker` | ❌ Not found in index.ts | *No explicit POST handler* | — |

**Note:** The `/webhook` POST handler dispatches to:
- `virtualgrouptrigger()` if trigger==="study_group_bots"
- `studyBuddy()` if bot is member (fires async, returns immediately)

---

## 2. GraphQL Queries

**Total: 68 operations** (across BomNotes, BomPage, BomUser, BomUtils, BomPeoplePlace, BomCommunity, BomMessenger domains)

### 2.1 BomNotes Queries (8)

| Operation | Args | Return | Resolver (file:line) | Domain | Auth | Modernized? |
|-----------|------|--------|--------|--------|------|-------------|
| `fax` | `filter?: String` | `[Fax]` | BomNotes.ts:38 | BomNotes | No | `[]` |
| `faxIndex` | `slug?: String` | `FaxIndex` | BomNotes.ts:62 | BomNotes | No | `[]` |
| `image` | `id?: [String]` | `[Image]` | BomNotes.ts:102 | BomNotes | No | `[]` |
| `commentary` | `id?: [String]` | `[Commentary]` | BomNotes.ts:18 | BomNotes | No | `[]` |
| `sources` | `id?: [String]` | `[Source]` | *Not explicitly impl.* | BomNotes | No | — |
| `publications` | — | `[Source]` | BomNotes.ts:12 | BomNotes | No | `[]` |
| `history` | `slug?: [String]` | `[HistoricalDocument]` | BomNotes.ts:92 | BomNotes | No | `[]` |
| `chiasmus` | `id?: [String]` | `[Chiasmus]` | BomNotes.ts:123 | BomNotes | No | `[]` |
| `passagenotes` | `verse_ids?: [Int], start_verse_id?: Int, end_verse_id?: Int` | `PassageNotes` | BomNotes.ts:170 | BomNotes | No | `[]` |

**Modernization notes:**
- All use inline Sequelize queries (no abstraction layer)
- No typed resolver signatures (`ResolverFn<>`)
- No input validation with Zod
- No DataLoaders for N+1 prevention
- No custom error classes (throws generic errors)

---

### 2.2 BomPage Queries (6)

| Operation | Args | Return | Resolver (file:line) | Domain | Auth | Modernized? |
|-----------|------|--------|--------|--------|------|-------------|
| `division` | `slug?: [String]` | `[Division]` | BomPage.ts:15 | BomPage | No | `[]` |
| `page` | `slug?: [String]` | `[Page]` | BomPage.ts:42 | BomPage | No | `[]` |
| `section` | `slug?: [String]` | `[Section]` | BomPage.ts:80 | BomPage | No | `[]` |
| `text` | `slug?: [String]` | `[TextBlock]` | BomPage.ts:102 | BomPage | No | `[]` |
| `lookup` | `ref?: [String]` | `[TextBlock]` | BomPage.ts:~220 | BomPage | No | `[]` |
| `queue` | `token?: String, items?: [QueueInput]` | `[TextBlock]` | BomPage.ts:153 | BomPage | Inline token | `[]` |
| `read` | `token?: String, ref?: String` | `ReadBlock` | BomPage.ts:~320 | BomPage | Inline token | `[]` |

---

### 2.3 BomUser Queries (11)

| Operation | Args | Return | Resolver (file:line) | Domain | Auth | Modernized? |
|-----------|------|--------|--------|--------|------|-------------|
| `user` | `token?: [String]` | `User` | BomUser.ts:145 | BomUser | Token lookup | `[A]` |
| `generateToken` | `seed?: Int` | `String` | BomUser.ts:~210 | BomUser | No | `[]` |
| `signin` | `token: String, username: String, password: String` | `SignIn` | BomUser.ts:97 | BomUser | **Service** | `[A,V]` |
| `tokensignin` | `token: String` | `SignIn` | BomUser.ts:177 | BomUser | Token lookup | `[A]` |
| `socialsignin` | `network: String, token: String, social_token: String` | `SignIn` | BomUser.ts:165 | BomUser | Social network | `[]` |
| `users` | `user_ids?: [String]` | `[User]` | BomUser.ts:~230 | BomUser | No | `[]` |
| `sourceUsage` | `token: String, source: String` | `Float` | BomUser.ts:~260 | BomUser | Token lookup | `[]` |
| `studylog` | `token: String` | `StudyLog` | BomUser.ts:274 | BomUser | Token lookup | `[]` |
| `pageprogress` | `token: String, slug: [String]` | `[ProgressScore]` | BomUser.ts:~310 | BomUser | Token lookup | `[]` |
| `userprogress` | `token: String` | `ProgressScore` | BomUser.ts:~340 | BomUser | Token lookup | `[]` |
| `userdailyscores` | `token: String` | `UserDailyScore` | BomUser.ts:~350 | BomUser | Token lookup | `[]` |
| `closetab` | `token: String` | `[String]` | BomUser.ts:154 | BomUser | Token lookup | `[]` |
| `test` | — | `Test` | BomUser.ts:~370 | BomUser | No | `[]` |

**Modernization notes:**
- `signin` uses `AuthService.signin()` (modern) + `SigninSchema` Zod validation → `[A,V]`
- `user`, `tokensignin` use inline `BomUserToken.findOne()` for auth → only `[A]` partial
- No typed resolver signatures
- No DataLoaders

---

### 2.4 BomUtils Queries (8)

| Operation | Args | Return | Resolver (file:line) | Domain | Auth | Modernized? |
|-----------|------|--------|--------|--------|------|-------------|
| `labels` | — | `[Label]` | BomUtils.ts:35 | BomUtils | No | `[]` |
| `menu` | `slug?: [String]` | `[Menu]` | BomUtils.ts:51 | BomUtils | No | `[]` |
| `books` | `seed?: String` | `[Book]` | BomUtils.ts:54 | BomUtils | No | `[]` |
| `search` | `query: String` | `[SearchResult]` | BomUtils.ts:57 | BomUtils | No | `[]` |
| `shortlink` | `hash?: [String]` | `Shortlinks` | BomUtils.ts:~160 | BomUtils | No | `[]` |
| `markdown` | `slug?: [String]` | `[Markdown]` | BomUtils.ts:~170 | BomUtils | No | `[]` |
| `scripture` | `ref: String, verse_ids: [Int], version: String` | `ScriptureResults` | BomUtils.ts:~180 | BomUtils | No | `[]` |
| `verses` | `verse_ids: [Int]` | `[Scripture]` | BomUtils.ts:~190 | BomUtils | No | `[]` |
| `versehighlights` | `verse_pairs: [[Int]]` | `[ScriptureHighlights]` | BomUtils.ts:~200 | BomUtils | No | `[]` |

---

### 2.5 BomPeoplePlace Queries (8)

| Operation | Args | Return | Resolver (file:line) | Domain | Auth | Modernized? |
|-----------|------|--------|--------|--------|------|-------------|
| `person` | `slug?: [String]` | `[People]` | BomPeoplePlace.ts:64 | BomPeoplePlace | No | `[D]` |
| `people` | `slug?: [String]` | `[People]` | BomPeoplePlace.ts:~140 | BomPeoplePlace | No | `[D]` |
| `peoplenetwork` | — | `PeopleNetwork` | BomPeoplePlace.ts:~200 | BomPeoplePlace | No | `[]` |
| `place` | `slug?: [String]` | `[Place]` | BomPeoplePlace.ts:138 | BomPeoplePlace | No | `[D]` |
| `places` | `map?: [String]` | `[Place]` | BomPeoplePlace.ts:~250 | BomPeoplePlace | No | `[D]` |
| `maps` | `slug?: [String]` | `[Map]` | BomPeoplePlace.ts:~300 | BomPeoplePlace | No | `[]` |
| `mapstory` | `slug: String, map: String` | `[MapStory]` | BomPeoplePlace.ts:~350 | BomPeoplePlace | No | `[]` |
| `mapstories` | `map: [String]!` | `[MapStory]` | BomPeoplePlace.ts:~380 | BomPeoplePlace | No | `[]` |
| `timeline` | `slug?: [String]` | `[Event]` | BomPeoplePlace.ts:~410 | BomPeoplePlace | No | `[]` |

**Modernization notes:**
- `person`, `place`, `places` use field-level AST traversal to optimize query inclusion → partial `[D]` (dataloader-like optimization, not true DataLoaders)

---

### 2.6 BomCommunity Queries (13)

| Operation | Args | Return | Resolver (file:line) | Domain | Auth | Modernized? |
|-----------|------|--------|--------|--------|------|-------------|
| `studygrouphistory` | `token: String, studyGroupID: String` | `StudyGroupHistory` | BomCommunity.ts:231 | BomCommunity | Token lookup | `[]` |
| `loadGroupsFromHash` | `hash: [String]` | `[StudyGroup]` | BomCommunity.ts:220 | BomCommunity | No | `[]` |
| `homefeed` | `token: String, channel: [String], message: [String]` | `HomeFeed` | BomCommunity.ts:~380 | BomCommunity | Token lookup | `[]` |
| `homethread` | `token: String, channel: String, message: String` | `[HomeFeedItem]` | BomCommunity.ts:~420 | BomCommunity | Token lookup | `[]` |
| `homegroups` | `token: String, grouping: String` | `[HomeGroup]` | BomCommunity.ts:279 | BomCommunity | Token lookup | `[]` |
| `postcomments` | `token: String, message: Int` | `[HomeFeedItem]` | BomCommunity.ts:~450 | BomCommunity | Token lookup | `[]` |
| `moregroups` | `token: String, grouping: String` | `[HomeGroup]` | BomCommunity.ts:~480 | BomCommunity | Token lookup | `[]` |
| `requestedUsers` | `token: String, channel: String` | `[HomeUser]` | BomCommunity.ts:~500 | BomCommunity | Token lookup | `[]` |
| `leaderboard` | `token: String` | `LeaderBoard` | BomCommunity.ts:132 | BomCommunity | Token lookup | `[]` |
| `readingplan` | `token: String, slug: String` | `ReadingPlan` | BomCommunity.ts:~520 | BomCommunity | Token lookup | `[]` |
| `readingplansegment` | `token: String, guid: String` | `ReadingPlanSegment` | BomCommunity.ts:~540 | BomCommunity | Token lookup | `[]` |
| `botlist` | — | `[Bot]` | BomCommunity.ts:110 | BomCommunity | No | `[]` |

---

### 2.7 BomMessenger Queries (10)

| Operation | Args | Return | Resolver (file:line) | Domain | Auth | Modernized? |
|-----------|------|--------|--------|--------|------|-------------|
| `messengerUser` | `userId: String!` | `MessengerUser` | BomMessenger.ts:20 | BomMessenger | No | `[]` |
| `messengerUsers` | `userIds: [String!]!` | `[MessengerUser!]!` | BomMessenger.ts:24 | BomMessenger | No | `[]` |
| `messengerChannel` | `channelUrl: String!` | `MessengerChannel` | BomMessenger.ts:36 | BomMessenger | No | `[]` |
| `messengerMyChannels` | `userId: String!, customTypes?: [String!], limit?: Int` | `[MessengerChannel!]!` | BomMessenger.ts:40 | BomMessenger | No | `[]` |
| `messengerPublicChannels` | `lang?: String, customTypes?: [String!], limit?: Int` | `[MessengerChannel!]!` | BomMessenger.ts:52 | BomMessenger | No | `[]` |
| `messengerMembers` | `channelUrl: String!` | `[MessengerMember!]!` | BomMessenger.ts:64 | BomMessenger | No | `[]` |
| `messengerMessages` | `channelUrl: String!, before?: String, limit?: Int` | `[MessengerMessage!]!` | BomMessenger.ts:72 | BomMessenger | No | `[]` |
| `messengerMessage` | `channelUrl: String!, messageId: String!` | `MessengerMessage` | BomMessenger.ts:84 | BomMessenger | No | `[]` |
| `messengerThread` | `parentMessageId: String!` | `[MessengerMessage!]!` | BomMessenger.ts:94 | BomMessenger | No | `[]` |
| `messengerUnreadCount` | `channelUrl: String!, userId: String!` | `Int!` | BomMessenger.ts:98 | BomMessenger | No | `[]` |
| `messengerBots` | `lang?: String` | `[MessengerUser!]!` | BomMessenger.ts:28 | BomMessenger | No | `[]` |

**Modernization notes:**
- All are thin wrappers around `messenger.*` library calls (Sendbird SDK)
- No inline DB logic, but no validation or error handling either
- Likely minimal modernization needed (delegated to Sendbird library)

---

## 3. GraphQL Mutations

**Total: 25 operations**

### 3.1 BomNotes Mutations (0)

*No mutations in BomNotes*

---

### 3.2 BomPage Mutations (0)

*No mutations in BomPage*

---

### 3.3 BomUser Mutations (5)

| Operation | Args | Return | Resolver (file:line) | Domain | Auth | Modernized? |
|-----------|------|--------|--------|--------|------|-------------|
| `changePassword` | `token: String, password: String` | `Boolean` | BomUser.ts:~660 | BomUser | Token lookup | `[A,V]` |
| `signup` | `token: String, username: String, password: String, name: String, email: String, zip: String` | `SignIn` | BomUser.ts:~680 | BomUser | **Service** | `[A,V]` |
| `signout` | `token: String` | `Boolean` | BomUser.ts:~720 | BomUser | Token lookup | `[]` |
| `editProfile` | `token: String, name: String, email: String, zip: String` | `User` | BomUser.ts:~700 | BomUser | Token lookup | `[]` |
| `uploadProfileImage` | `token: String!, imageData: String!` | `Boolean` | BomUser.ts:~740 | BomUser | Token lookup | `[]` |
| `log` | `token: String!, key: String!, val: String` | `LogResult` | BomUser.ts:~750 | BomUser | Token lookup | `[]` |

---

### 3.4 BomUtils Mutations (1)

| Operation | Args | Return | Resolver (file:line) | Domain | Auth | Modernized? |
|-----------|------|--------|--------|--------|------|-------------|
| `shortlink` | `string: String` | `Shortlinks` | BomUtils.ts:212 | BomUtils | No | `[]` |

---

### 3.5 BomPeoplePlace Mutations (0)

*No mutations in BomPeoplePlace*

---

### 3.6 BomCommunity Mutations (12)

| Operation | Args | Return | Resolver (file:line) | Domain | Auth | Modernized? |
|-----------|------|--------|--------|--------|------|-------------|
| `joinGroup` | `token: String, hash: String` | `JoinedGroup` | BomCommunity.ts:~600 | BomCommunity | Token lookup | `[]` |
| `joinOpenGroup` | `token: String, url: String` | `JoinedGroup` | BomCommunity.ts:~620 | BomCommunity | Token lookup | `[]` |
| `requestToJoinGroup` | `token: String, url: String` | `JoinedGroup` | BomCommunity.ts:~640 | BomCommunity | Token lookup | `[]` |
| `withdrawRequest` | `token: String, url: String` | `JoinedGroup` | BomCommunity.ts:~660 | BomCommunity | Token lookup | `[]` |
| `processRequest` | `token: String, channel: String, user_id: String, grant: Boolean` | `Boolean` | BomCommunity.ts:~680 | BomCommunity | Token lookup | `[]` |
| `addBot` | `token: String, channel: String, bot: String` | `Boolean` | BomCommunity.ts:~700 | BomCommunity | Token lookup | `[]` |
| `removeBot` | `token: String, channel: String, bot: String` | `Boolean` | BomCommunity.ts:~720 | BomCommunity | Token lookup | `[]` |

---

### 3.7 BomMessenger Mutations (7)

| Operation | Args | Return | Resolver (file:line) | Domain | Auth | Modernized? |
|-----------|------|--------|--------|--------|------|-------------|
| `messengerUpsertUser` | `userId: String!, nickname?: String, profileUrl?: String, bomUserId?: String, metadata?: JSON, isBot?: Boolean` | `MessengerUser!` | BomMessenger.ts:114 | BomMessenger | No | `[]` |
| `messengerUpdateNickname` | `userId: String!, nickname: String!` | `Boolean!` | BomMessenger.ts:138 | BomMessenger | No | `[]` |
| `messengerUpdateProfileUrl` | `userId: String!, profileUrl: String!` | `Boolean!` | BomMessenger.ts:148 | BomMessenger | No | `[]` |
| `messengerUpdateUserMetadata` | `userId: String!, metadata: JSON!` | `Boolean!` | BomMessenger.ts:158 | BomMessenger | No | `[]` |
| `messengerCreateChannel` | `input: MessengerCreateChannelInput!` | `MessengerChannel!` | BomMessenger.ts:183 | BomMessenger | No | `[]` |
| `messengerAddMember` | `channelUrl: String!, userId: String!, role?: String` | `Boolean!` | BomMessenger.ts:199 | BomMessenger | No | `[]` |
| `messengerRemoveMember` | `channelUrl: String!, userId: String!` | `Boolean!` | BomMessenger.ts:206 | BomMessenger | No | `[]` |
| `messengerPostMessage` | `input: MessengerPostMessageInput!` | `MessengerMessage!` | BomMessenger.ts:209 | BomMessenger | No | `[]` |
| `messengerUpdateMessage` | `channelUrl: String!, messageId: String!, message?: String, customType?: String, link?: MessengerLinkInput, highlights?: [String!], metadata?: JSON` | `MessengerMessage` | BomMessenger.ts:212 | BomMessenger | No | `[]` |
| `messengerDeleteMessage` | `channelUrl: String!, messageId: String!` | `Boolean!` | BomMessenger.ts:223 | BomMessenger | No | `[]` |
| `messengerAddReaction` | `messageId: String!, userId: String!, reactionKey: String!` | `Boolean!` | BomMessenger.ts:225 | BomMessenger | No | `[]` |
| `messengerRemoveReaction` | `messageId: String!, userId: String!, reactionKey: String!` | `Boolean!` | BomMessenger.ts:233 | BomMessenger | No | `[]` |
| `messengerMarkAsRead` | `channelUrl: String!, userId: String!` | `Boolean!` | BomMessenger.ts:240 | BomMessenger | No | `[]` |

---

## 4. Modernization Assessment

### 4.1 Modern Infrastructure Available

✅ **Exists and in use:**
- `src/services/AuthService.ts` — encapsulates signin/signup with Zod validation (`SigninSchema`, `SignupSchema`)
- `src/library/validation/schemas.ts` — Zod schema definitions
- `src/library/auth/password.ts` — bcrypt password hashing & verification
- `src/library/errors/AppError.ts` — custom error types (not yet widely used)
- `src/library/dataloaders/userLoader.ts` — DataLoader factory (created but not integrated into resolvers)
- `src/types/graphql.ts` — TypeScript types for context, `ResolverFn<>`, common args

### 4.2 Modernization by Signal

#### **T (Typed resolver shape)**: 0 of 93
- No resolvers explicitly import or use `ResolverFn<Parent, Args, Context, Return>` type
- BomUser.ts has some inline type hints (`SigninArgs`, etc.) but no GraphQL-specific typed signatures
- Most resolvers use generic `(root, args, context, info)` pattern

#### **A (AuthService)**: 2 of 93
- `signin` mutation ✅ (uses `authService.signin()`)
- `signup` mutation ✅ (uses `authService.signup()`)
- All other auth: inline `BomUserToken.findOne({where:{token}})` or `BomUser.findOne({include:[BomUserToken]})`
- **Gap: 91 of 93 auth checks are not delegated to AuthService**

#### **V (Zod validation)**: 2 of 93
- `signin` mutation ✅ (validates with `SigninSchema`)
- `signup` mutation ✅ (validates with `SignupSchema`)
- **Gap: 91 of 93 have zero input validation**

#### **D (DataLoaders)**: ~3 of 93 (partial)
- `person` query in BomPeoplePlace.ts uses field-level AST to optimize query inclusion (quasi-dataloader approach)
- `place`, `places` queries in BomPeoplePlace.ts use same pattern
- **True DataLoader integration: 0** (userLoader created but not used in any resolver)
- **Gap: 90 of 93 have no batch-loading protection (N+1 risk)**

#### **E (Custom error classes)**: 0 of 93
- All resolvers use inline error throwing: `throw new Error(...)` or return generic errors
- `AppError.ts` exists but is not imported or used by any resolver
- **Gap: 93 of 93 have zero custom error handling**

### 4.3 Modernization Summary Table

| Signal | Total Ops | Modern | Legacy | Coverage |
|--------|-----------|--------|--------|----------|
| T (Typed resolvers) | 93 | 0 | 93 | **0%** |
| A (AuthService) | 93 | 2 | 91 | **2%** |
| V (Zod validation) | 93 | 2 | 91 | **2%** |
| D (DataLoaders) | 93 | 3 | 90 | **3%** |
| E (Custom errors) | 93 | 0 | 93 | **0%** |
| **Full [T,A,V,D,E]** | **93** | **0** | **93** | **0%** |

---

## 5. Coverage Summary

### 5.1 REST Endpoints
- **Total:** 5 routes (1 explicit + 3 SSR + 1 GET MapMarker)
- **POST APIs:** 5 (webhook, studybuddy, translate, coords, implicit mapmarker)
- **Explicit in code:** ✅ mapped

### 5.2 GraphQL Operations

| Type | Total | Modernized | Modern % |
|------|-------|-----------|----------|
| Queries | 68 | 0 | 0% |
| Mutations | 25 | 2 | 8% |
| **Total** | **93** | **2** | **2%** |

### 5.3 Top Modernization Gaps

1. **Zero typed resolver definitions (T):** All 93 resolvers lack explicit `ResolverFn<>` type annotations
2. **91 auth operations using inline token lookup (A):** Only `signin`/`signup` use `AuthService`
3. **91 queries with zero Zod validation (V):** Only `signin`/`signup` validate with schemas
4. **90 operations at N+1 risk (D):** Created userLoader sits unused; 3 manual AST optimizations insufficient
5. **93 resolvers with generic error handling (E):** AppError infrastructure exists, zero usage

### 5.4 Highest-Priority Migration Work

**Phase 1 (Critical):**
1. Wrap all token-based auth in `AuthService` (affects ~30 resolvers across BomUser, BomCommunity)
2. Add Zod schemas for common argument patterns (token, slug, ids)
3. Integrate typed resolver signatures (wrap all 93 resolvers)

**Phase 2 (High-value):**
1. Wire DataLoader instances into GraphQL context for BomUser, BomPeople, etc.
2. Replace inline DB token lookups with service-layer helpers
3. Adopt AppError and structured error responses

**Phase 3 (Nice-to-have):**
1. Migrate REST API handlers to factory pattern with validation
2. Refactor AI/LLM handlers (studybuddy, virtualgroup) into services
3. Audit and optimize N+1 queries (search, leaderboard especially)

---

## Appendix: File-by-File Stats

| File | Lines | Queries | Mutations | Notes |
|------|-------|---------|-----------|-------|
| BomNotes.ts | 453 | 8 | 0 | Highest-volume data fetching (commentary, images, FAX) |
| BomPage.ts | 790 | 7 | 0 | Complex join chains; queue/read operations |
| BomUser.ts | 824 | 13 | 6 | **Most modern:** Uses AuthService for signin/signup |
| BomUtils.ts | 294 | 9 | 1 | Search & scripture lookup; 1 mutation (shortlink) |
| BomPeoplePlace.ts | 712 | 9 | 0 | Advanced field-level optimization; partial DataLoader pattern |
| BomCommunity.ts | 926 | 13 | 7 | **Heaviest:** Community/study group logic; Sendbird-dependent |
| BomMessenger.ts | 323 | 10 | 7 | **Newest phase:** Sendbird wrapper; clean delegation pattern |
| BomScripture.ts | 154 | — | — | Helper functions for scripture lookup |
| **Totals** | **~5,755** | **68** | **25** | — |

---

**Document prepared for migration burndown tracking. Code locations are **absolute paths** in `/home/bom/BookofMormonOnline/src/`.
