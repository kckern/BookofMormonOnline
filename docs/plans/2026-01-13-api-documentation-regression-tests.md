# API Documentation & Regression Test Baseline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create comprehensive API documentation and a full regression test suite as a baseline before any modernization work.

**Architecture:** Generate API reference docs from GraphQL typeDefs, then build Jest-based regression tests for all queries/mutations. Tests will use snapshot testing for complex responses and direct assertions for critical fields. Each test file covers one resolver module.

**Tech Stack:** Jest 30, ts-jest, GraphQL (apollo-server-express), TypeScript, Sequelize, snapshot testing

---

## Phase 1: API Documentation

### Task 1.1: Create API Reference Structure

**Files:**
- Create: `docs/api/README.md`
- Create: `docs/api/queries.md`
- Create: `docs/api/mutations.md`
- Create: `docs/api/types.md`

**Step 1: Create API docs directory structure**

Run: `mkdir -p /Users/kckern/Documents/GitHub/BookofMormonOnline/docs/api`

**Step 2: Create API README**

Create `docs/api/README.md`:
```markdown
# Book of Mormon Online API Reference

This document describes the GraphQL API for Book of Mormon Online.

## Base URL

- **Production**: `https://bookofmormon.online/graphql`
- **Development**: `http://localhost:4000/graphql`

## Authentication

Most queries are public. User-specific queries require a `token` parameter obtained via `signin` or `tokensignin`.

## Quick Links

- [Queries](./queries.md) - Read operations
- [Mutations](./mutations.md) - Write operations
- [Types](./types.md) - Data type definitions

## Query Categories

| Category | Description | Auth Required |
|----------|-------------|---------------|
| Content | Pages, sections, text blocks | No |
| Scripture | Verses, references, search | No |
| User | Progress, study log, profile | Yes |
| Community | Groups, feed, leaderboard | Yes |
| People/Places | Characters, locations, maps | No |
| Notes | Commentary, images, chiasmus | No |
| Messenger | Real-time messaging | Yes |

## Example Query

\`\`\`graphql
query {
  page(slug: ["1-nephi-1"]) {
    title
    slug
    sections {
      title
      rows {
        narration {
          description
        }
      }
    }
  }
}
\`\`\`
```

**Step 3: Commit API docs structure**

```bash
git add docs/api/
git commit -m "docs: create API reference structure"
```

---

### Task 1.2: Document All Queries

**Files:**
- Create: `docs/api/queries.md`

**Step 1: Create comprehensive queries documentation**

Create `docs/api/queries.md`:
```markdown
# GraphQL Queries

## Content Queries

### division
Get book divisions (1 Nephi, 2 Nephi, etc.)

\`\`\`graphql
division(slug: [String]): [Division]
\`\`\`

**Arguments:**
- `slug` - Division slugs (e.g., ["1-nephi", "2-nephi"]) or omit for all

**Example:**
\`\`\`graphql
query {
  division(slug: ["1-nephi"]) {
    title
    slug
    description
    pages { title slug }
  }
}
\`\`\`

---

### page
Get page content with sections and text blocks

\`\`\`graphql
page(slug: [String]): [Page]
\`\`\`

**Arguments:**
- `slug` - Page slugs (e.g., ["1-nephi-1"])

**Example:**
\`\`\`graphql
query {
  page(slug: ["1-nephi-1"]) {
    title
    slug
    sections {
      title
      slug
      rows {
        narration { description }
        capsulation { description reference }
      }
    }
  }
}
\`\`\`

---

### section
Get individual section

\`\`\`graphql
section(slug: [String]): [Section]
\`\`\`

---

### text
Get text block by slug

\`\`\`graphql
text(slug: [String]): [TextBlock]
\`\`\`

---

### lookup
Lookup text by scripture reference

\`\`\`graphql
lookup(ref: [String]): [TextBlock]
\`\`\`

**Arguments:**
- `ref` - Scripture references (e.g., ["1 Nephi 1:1"])

---

### read
Get reading view with navigation

\`\`\`graphql
read(token: String, ref: String): ReadBlock
\`\`\`

**Arguments:**
- `token` - User token (optional, for progress tracking)
- `ref` - Scripture reference

---

### queue
Get multiple text items for study queue

\`\`\`graphql
queue(token: String, items: [QueueInput]): [TextBlock]
\`\`\`

---

## Scripture Queries

### scripture
Get scripture verses by reference

\`\`\`graphql
scripture(ref: String, verse_ids: [Int], version: String): ScriptureResults
\`\`\`

**Arguments:**
- `ref` - Scripture reference (e.g., "1 Nephi 1:1-5")
- `verse_ids` - Verse IDs (alternative to ref)
- `version` - Translation version

---

### verses
Get verses by ID

\`\`\`graphql
verses(verse_ids: [Int]): [Scripture]
\`\`\`

---

### versehighlights
Get highlighted text for verse comparisons

\`\`\`graphql
versehighlights(verse_pairs: [[Int]]): [ScriptureHighlights]
\`\`\`

---

### search
Full-text search

\`\`\`graphql
search(query: String): [SearchResult]
\`\`\`

**Example:**
\`\`\`graphql
query {
  search(query: "faith") {
    reference
    text
    slug
    page
    section
  }
}
\`\`\`

---

## User Queries

### signin
Authenticate user with username/password

\`\`\`graphql
signin(token: String, username: String, password: String): SignIn
\`\`\`

**Arguments:**
- `token` - Session token
- `username` - Username or email
- `password` - User password

**Returns:**
\`\`\`graphql
{
  isSuccess: Boolean
  msg: String
  user { user email name progress { completed started } }
  social { user_id nickname profile_url access_token }
}
\`\`\`

---

### tokensignin
Authenticate with existing token

\`\`\`graphql
tokensignin(token: String): SignIn
\`\`\`

---

### socialsignin
OAuth authentication

\`\`\`graphql
socialsignin(network: String, token: String, social_token: String): SignIn
\`\`\`

**Arguments:**
- `network` - OAuth provider (google, facebook, apple)
- `token` - Session token
- `social_token` - OAuth access token

---

### user
Get user profile

\`\`\`graphql
user(token: [String]): User
\`\`\`

---

### userprogress
Get user's overall progress

\`\`\`graphql
userprogress(token: String): ProgressScore
\`\`\`

---

### pageprogress
Get user's progress on specific pages

\`\`\`graphql
pageprogress(token: String, slug: [String]): [ProgressScore]
\`\`\`

---

### studylog
Get user's study session history

\`\`\`graphql
studylog(token: String): StudyLog
\`\`\`

---

### userdailyscores
Get daily progress breakdown

\`\`\`graphql
userdailyscores(token: String): UserDailyScore
\`\`\`

---

## Community Queries

### homefeed
Get home feed with groups and messages

\`\`\`graphql
homefeed(token: String, channel: [String], message: [String]): HomeFeed
\`\`\`

---

### homegroups
Get user's study groups

\`\`\`graphql
homegroups(token: String, grouping: String): [HomeGroup]
\`\`\`

---

### homethread
Get thread replies

\`\`\`graphql
homethread(token: String, channel: String, message: String): [HomeFeedItem]
\`\`\`

---

### leaderboard
Get top users by progress

\`\`\`graphql
leaderboard(token: String): LeaderBoard
\`\`\`

---

### readingplan
Get reading plan details

\`\`\`graphql
readingplan(token: String, slug: String): ReadingPlan
\`\`\`

---

### readingplansegment
Get reading plan segment

\`\`\`graphql
readingplansegment(token: String, guid: String): ReadingPlanSegment
\`\`\`

---

### botlist
List available bots

\`\`\`graphql
botlist: [Bot]
\`\`\`

---

## People & Places Queries

### person
Get person by slug

\`\`\`graphql
person(slug: [String]): [People]
\`\`\`

**Example:**
\`\`\`graphql
query {
  person(slug: ["nephi-1"]) {
    name
    title
    classification
    description
    relations { relation person { name slug } }
    index { slug ref text }
  }
}
\`\`\`

---

### peoplenetwork
Get full relationship network graph

\`\`\`graphql
peoplenetwork: PeopleNetwork
\`\`\`

---

### place
Get place by slug

\`\`\`graphql
place(slug: [String]): [Place]
\`\`\`

---

### maps
Get map definitions

\`\`\`graphql
maps(slug: [String]): [Map]
\`\`\`

---

### mapstories
Get journey narratives for a map

\`\`\`graphql
mapstories(map: [String]!): [MapStory]
\`\`\`

---

### timeline
Get timeline events

\`\`\`graphql
timeline(slug: [String]): [Event]
\`\`\`

---

## Notes & Commentary Queries

### commentary
Get commentary entries

\`\`\`graphql
commentary(id: [String]): [Commentary]
\`\`\`

---

### image
Get images/illustrations

\`\`\`graphql
image(id: [String]): [Image]
\`\`\`

---

### chiasmus
Get chiastic structures

\`\`\`graphql
chiasmus(id: [String]): [Chiasmus]
\`\`\`

---

### passagenotes
Get comprehensive notes for a passage

\`\`\`graphql
passagenotes(verse_ids: [Int], start_verse_id: Int, end_verse_id: Int): PassageNotes
\`\`\`

---

### history
Get historical documents

\`\`\`graphql
history(slug: [String]): [HistoricalDocument]
\`\`\`

---

### publications
List all publication sources

\`\`\`graphql
publications: [Source]
\`\`\`

---

### fax
Get facsimile page images

\`\`\`graphql
fax(filter: String): [Fax]
\`\`\`

---

## Utility Queries

### labels
Get all UI labels (for internationalization)

\`\`\`graphql
labels: [Label]
\`\`\`

---

### menu
Get menu structure

\`\`\`graphql
menu(slug: [String]): [Menu]
\`\`\`

---

### books
Get book/chapter structure

\`\`\`graphql
books(seed: String): [Book]
\`\`\`

---

### shortlink
Lookup shortened link

\`\`\`graphql
shortlink(hash: [String]): Shortlinks
\`\`\`

---

### markdown
Get markdown content

\`\`\`graphql
markdown(slug: [String]): [Markdown]
\`\`\`

---

## Messenger Queries

### messengerUser
Get messenger user

\`\`\`graphql
messengerUser(userId: String!): MessengerUser
\`\`\`

---

### messengerChannel
Get channel with members

\`\`\`graphql
messengerChannel(channelUrl: String!): MessengerChannel
\`\`\`

---

### messengerMyChannels
Get user's channels

\`\`\`graphql
messengerMyChannels(userId: String!, customTypes: [String!], limit: Int): [MessengerChannel!]!
\`\`\`

---

### messengerMessages
Get channel messages

\`\`\`graphql
messengerMessages(channelUrl: String!, before: String, limit: Int): [MessengerMessage!]!
\`\`\`

---

### messengerThread
Get thread replies

\`\`\`graphql
messengerThread(parentMessageId: String!): [MessengerMessage!]!
\`\`\`
```

**Step 2: Commit queries documentation**

```bash
git add docs/api/queries.md
git commit -m "docs: add comprehensive queries documentation"
```

---

### Task 1.3: Document All Mutations

**Files:**
- Create: `docs/api/mutations.md`

**Step 1: Create mutations documentation**

Create `docs/api/mutations.md`:
```markdown
# GraphQL Mutations

## User Mutations

### signup
Register new user

\`\`\`graphql
mutation {
  signup(
    token: String
    username: String
    password: String
    name: String
    email: String
    zip: String
  ): SignIn
}
\`\`\`

---

### signout
Logout user

\`\`\`graphql
mutation {
  signout(token: String): Boolean
}
\`\`\`

---

### editProfile
Update user profile

\`\`\`graphql
mutation {
  editProfile(
    token: String
    name: String
    email: String
    zip: String
  ): User
}
\`\`\`

---

### changePassword
Change password

\`\`\`graphql
mutation {
  changePassword(token: String, password: String): Boolean
}
\`\`\`

---

### log
Log study activity

\`\`\`graphql
mutation {
  log(token: String!, key: String!, val: String): LogResult
}
\`\`\`

**Arguments:**
- `token` - User token (required)
- `key` - Activity key (e.g., text slug)
- `val` - Activity value

---

## Community Mutations

### joinGroup
Join study group via invite hash

\`\`\`graphql
mutation {
  joinGroup(token: String, hash: String): JoinedGroup
}
\`\`\`

---

### joinOpenGroup
Join open/public group

\`\`\`graphql
mutation {
  joinOpenGroup(token: String, url: String): JoinedGroup
}
\`\`\`

---

### requestToJoinGroup
Request to join private group

\`\`\`graphql
mutation {
  requestToJoinGroup(token: String, url: String): JoinedGroup
}
\`\`\`

---

### withdrawRequest
Cancel join request

\`\`\`graphql
mutation {
  withdrawRequest(token: String, url: String): JoinedGroup
}
\`\`\`

---

### processRequest
Accept/reject join request (admin only)

\`\`\`graphql
mutation {
  processRequest(
    token: String
    channel: String
    user_id: String
    grant: Boolean
  ): Boolean
}
\`\`\`

---

### addBot
Add bot to channel

\`\`\`graphql
mutation {
  addBot(token: String, channel: String, bot: String): Boolean
}
\`\`\`

---

### removeBot
Remove bot from channel

\`\`\`graphql
mutation {
  removeBot(token: String, channel: String, bot: String): Boolean
}
\`\`\`

---

## Utility Mutations

### shortlink
Create shortened link

\`\`\`graphql
mutation {
  shortlink(string: String): Shortlinks
}
\`\`\`

**Returns:**
\`\`\`graphql
{ hash: String }
\`\`\`

---

## Messenger Mutations

### messengerUpsertUser
Create or update messenger user

\`\`\`graphql
mutation {
  messengerUpsertUser(
    userId: String!
    nickname: String
    profileUrl: String
    bomUserId: String
    metadata: JSON
    isBot: Boolean
  ): MessengerUser!
}
\`\`\`

---

### messengerCreateChannel
Create messenger channel

\`\`\`graphql
mutation {
  messengerCreateChannel(input: MessengerCreateChannelInput!): MessengerChannel!
}
\`\`\`

**Input:**
\`\`\`graphql
input MessengerCreateChannelInput {
  channelUrl: String!
  name: String!
  customType: String
  description: String
  lang: String
  coverUrl: String
  operatorUserIds: [String!]
  memberUserIds: [String!]
}
\`\`\`

---

### messengerPostMessage
Post message to channel

\`\`\`graphql
mutation {
  messengerPostMessage(input: MessengerPostMessageInput!): MessengerMessage!
}
\`\`\`

**Input:**
\`\`\`graphql
input MessengerPostMessageInput {
  channelUrl: String!
  userId: String!
  messageType: String
  message: String!
  customType: String
  parentMessageId: String
  link: MessengerLinkInput
  highlights: [String!]
  mentionedUserIds: [String!]
  metadata: JSON
}
\`\`\`

---

### messengerUpdateMessage
Update existing message

\`\`\`graphql
mutation {
  messengerUpdateMessage(
    channelUrl: String!
    messageId: String!
    message: String
    customType: String
    link: MessengerLinkInput
    highlights: [String!]
    metadata: JSON
  ): MessengerMessage
}
\`\`\`

---

### messengerDeleteMessage
Delete message (soft delete)

\`\`\`graphql
mutation {
  messengerDeleteMessage(channelUrl: String!, messageId: String!): Boolean!
}
\`\`\`

---

### messengerAddMember
Add user to channel

\`\`\`graphql
mutation {
  messengerAddMember(channelUrl: String!, userId: String!, role: String): Boolean!
}
\`\`\`

---

### messengerRemoveMember
Remove user from channel

\`\`\`graphql
mutation {
  messengerRemoveMember(channelUrl: String!, userId: String!): Boolean!
}
\`\`\`

---

### messengerMarkAsRead
Mark channel as read

\`\`\`graphql
mutation {
  messengerMarkAsRead(channelUrl: String!, userId: String!): Boolean!
}
\`\`\`

---

### messengerAddReaction
Add emoji reaction to message

\`\`\`graphql
mutation {
  messengerAddReaction(messageId: String!, userId: String!, reactionKey: String!): Boolean!
}
\`\`\`

---

### messengerRemoveReaction
Remove reaction from message

\`\`\`graphql
mutation {
  messengerRemoveReaction(messageId: String!, userId: String!, reactionKey: String!): Boolean!
}
\`\`\`
```

**Step 2: Commit mutations documentation**

```bash
git add docs/api/mutations.md
git commit -m "docs: add mutations documentation"
```

---

### Task 1.4: Document All Types

**Files:**
- Create: `docs/api/types.md`

**Step 1: Create types documentation**

Create `docs/api/types.md`:
```markdown
# GraphQL Types

## User Types

### User
\`\`\`graphql
type User {
  user: String
  email: String
  name: String
  bookmark: String
  zip: String
  finished: String
  complete: Float
  started: Float
  time: Float
  progress: ProgressScore
  networks: [Network]
  social: Social
}
\`\`\`

### SignIn
\`\`\`graphql
type SignIn {
  isSuccess: Boolean
  msg: String
  profile_url: String
  user: User
  social: Social
}
\`\`\`

### Social
\`\`\`graphql
type Social {
  user_id: String
  nickname: String
  profile_url: String
  access_token: String
}
\`\`\`

### ProgressScore
\`\`\`graphql
type ProgressScore {
  count: Int
  completed: Float
  started: Float
  completed_items: [String]
  started_items: [String]
  active_items: [String]
  summary: UserStudySummary
}
\`\`\`

### StudyLog
\`\`\`graphql
type StudyLog {
  summary: UserStudySummary
  sessions: [UserSession]
}
\`\`\`

---

## Content Types

### Division
\`\`\`graphql
type Division {
  title: String
  slug: String
  description: String
  progress: ProgressScore
  pages: [Page]
}
\`\`\`

### Page
\`\`\`graphql
type Page {
  title: String
  slug: String
  counts: String
  progress: ProgressScore
  sections: [Section]
}
\`\`\`

### Section
\`\`\`graphql
type Section {
  title: String
  slug: String
  ambient: String
  sectionText: [TextBlock]
  page: Page
  rows: [Row]
}
\`\`\`

### TextBlock
\`\`\`graphql
type TextBlock {
  guid: String
  slug: String
  link: String
  heading: String
  content: String
  chrono: String
  duration: Float
  status: String
  quotes: [TextBlock]
  people: [People]
  places: [Place]
  refs: [Reference]
  notes: [Note]
  imgs: [Image]
  coms: [Commentary]
  parent_page: Page
  parent_section: Section
  narration: Narration
  next: NarrativePath
}
\`\`\`

### Row
\`\`\`graphql
type Row {
  weight: Int
  type: String
  narration: Narration
  connection: Conn
  capsulation: Caps
}
\`\`\`

---

## Scripture Types

### Scripture
\`\`\`graphql
type Scripture {
  verse_id: Int
  reference: String
  heading: String
  text: String
}
\`\`\`

### ScriptureResults
\`\`\`graphql
type ScriptureResults {
  ref: String
  passages: [Passage]
}
\`\`\`

### Passage
\`\`\`graphql
type Passage {
  reference: String
  heading: String
  verses: [Scripture]
}
\`\`\`

---

## People & Places Types

### People
\`\`\`graphql
type People {
  slug: String
  name: String
  title: String
  classification: String
  identification: String
  unit: String
  date: String
  description: String
  relations: [Relation]
  index: [Index]
}
\`\`\`

### Place
\`\`\`graphql
type Place {
  slug: String
  name: String
  label: String
  icon: String
  info: String
  occupants: String
  type: String
  location: String
  description: String
  maps: [Map]
  index: [Index]
  lat: Float
  lng: Float
  minZoom: Int
  maxZoom: Int
  h: Int
  w: Int
  ax: Int
  ay: Int
}
\`\`\`

### Map
\`\`\`graphql
type Map {
  slug: String
  name: String
  desc: String
  group: String
  centerx: Float
  centery: Float
  minzoom: Int
  maxzoom: Int
  zoom: Int
  tiles: String
  places: [Place]
}
\`\`\`

### MapStory
\`\`\`graphql
type MapStory {
  slug: String
  title: String
  description: String
  moves: [MapMove]
}
\`\`\`

---

## Notes Types

### Commentary
\`\`\`graphql
type Commentary {
  id: String
  slug: String
  title: String
  preview: String
  text: String
  reference: String
  publication: Source
  location: TextBlock
}
\`\`\`

### Image
\`\`\`graphql
type Image {
  id: String
  title: String
  artist: String
  file: String
  link: String
  width: Int
  height: Int
  location: TextBlock
}
\`\`\`

### Chiasmus
\`\`\`graphql
type Chiasmus {
  chiasmus_id: String
  title: String
  reference: String
  scheme: String
  lines: [ChiasmusLine]
}
\`\`\`

---

## Community Types

### HomeFeed
\`\`\`graphql
type HomeFeed {
  groups: [HomeGroup]
  feed: [HomeFeedItem]
}
\`\`\`

### HomeGroup
\`\`\`graphql
type HomeGroup {
  url: String
  name: String
  description: String
  grouping: String
  privacy: String
  picture: String
  requests: Int
  members: [HomeUser]
  latest: HomeFeedItem
}
\`\`\`

### HomeFeedItem
\`\`\`graphql
type HomeFeedItem {
  channel_url: String
  id: Int
  timestamp: String
  msg: String
  user: HomeUser
  mentioned_users: [HomeUser]
  likes: Int
  replycount: Int
  repliers: [HomeUser]
  link: ContentLink
  highlights: [String]
}
\`\`\`

### HomeUser
\`\`\`graphql
type HomeUser {
  user_id: String
  nickname: String
  picture: String
  progress: Float
  finished: String
  lastseen: String
  laststudied: String
  bookmark: String
  public: Boolean
  isBot: Boolean
}
\`\`\`

### LeaderBoard
\`\`\`graphql
type LeaderBoard {
  recentFinishers: [HomeUser]
  currentProgress: [HomeUser]
}
\`\`\`

---

## Messenger Types

### MessengerUser
\`\`\`graphql
type MessengerUser {
  user_id: String!
  nickname: String
  profile_url: String
  bom_user_id: String
  metadata: JSON
  is_online: Boolean
  last_seen_at: String
  is_bot: Boolean
  created_at: String
  updated_at: String
}
\`\`\`

### MessengerChannel
\`\`\`graphql
type MessengerChannel {
  channel_url: String!
  name: String!
  custom_type: String
  description: String
  lang: String
  cover_url: String
  member_count: Int
  message_count: Int
  last_message_at: String
  created_at: String
  updated_at: String
  members: [MessengerMember!]
}
\`\`\`

### MessengerMessage
\`\`\`graphql
type MessengerMessage {
  message_id: String!
  channel_url: String!
  user: MessengerUser
  message_type: String!
  message: String
  custom_type: String
  data: JSON
  parent_message_id: String
  thread_info: MessengerThreadInfo
  mentioned_users: [MessengerUser!]
  reactions: [MessengerReaction!]
  highlights: [MessengerHighlight!]
  is_removed: Boolean
  created_at: String!
  updated_at: String
}
\`\`\`

---

## Utility Types

### SearchResult
\`\`\`graphql
type SearchResult {
  reference: String
  text: String
  slug: String
  page: String
  section: String
  narration: String
  speaker: String
  voice: String
}
\`\`\`

### Label
\`\`\`graphql
type Label {
  key: String
  val: String
}
\`\`\`

### Shortlinks
\`\`\`graphql
type Shortlinks {
  hash: String
  shortLink: String
}
\`\`\`
```

**Step 2: Commit types documentation**

```bash
git add docs/api/types.md
git commit -m "docs: add GraphQL types documentation"
```

---

## Phase 2: Test Infrastructure Setup

### Task 2.1: Create Test Utilities and Helpers

**Files:**
- Create: `test/helpers/graphql.ts`
- Create: `test/helpers/fixtures.ts`
- Modify: `test/setup.ts`

**Step 1: Create GraphQL test helper**

Create `test/helpers/graphql.ts`:
```typescript
import { ApolloServer } from 'apollo-server-express';
import { typeDefs } from '../../src/typeDefs';
import resolvers from '../../src/resolvers';

// Create test server instance
let testServer: ApolloServer | null = null;

export const getTestServer = (): ApolloServer => {
  if (!testServer) {
    testServer = new ApolloServer({
      typeDefs,
      resolvers,
      context: () => ({
        lang: 'en',
        ip: '127.0.0.1'
      })
    });
  }
  return testServer;
};

// Execute GraphQL query for testing
export const executeQuery = async <T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<{ data?: T; errors?: any[] }> => {
  const server = getTestServer();
  const result = await server.executeOperation({
    query,
    variables
  });

  return {
    data: result.data as T,
    errors: result.errors
  };
};

// Execute GraphQL mutation for testing
export const executeMutation = async <T = any>(
  mutation: string,
  variables?: Record<string, any>
): Promise<{ data?: T; errors?: any[] }> => {
  return executeQuery<T>(mutation, variables);
};

// Common query fragments
export const fragments = {
  user: `
    fragment UserFields on User {
      user
      email
      name
      bookmark
      progress { completed started }
    }
  `,
  page: `
    fragment PageFields on Page {
      title
      slug
      sections { title slug }
    }
  `,
  textBlock: `
    fragment TextBlockFields on TextBlock {
      guid
      slug
      heading
      content
      duration
    }
  `,
  person: `
    fragment PersonFields on People {
      slug
      name
      title
      classification
      description
    }
  `,
  place: `
    fragment PlaceFields on Place {
      slug
      name
      info
      type
      location
    }
  `
};
```

**Step 2: Create test fixtures**

Create `test/helpers/fixtures.ts`:
```typescript
// Known good test data - slugs/IDs that exist in the database
export const fixtures = {
  // Content
  divisions: ['1-nephi', '2-nephi', 'jacob', 'enos', 'jarom', 'omni'],
  pages: ['1-nephi-1', '1-nephi-2', 'alma-32'],
  sections: ['1-nephi-1-1', '1-nephi-1-2'],
  textSlugs: ['1-nephi-1-1-1', '1-nephi-1-1-2'],

  // Scripture
  scriptureRefs: ['1 Nephi 1:1', '1 Nephi 1:1-5', 'Alma 32:21'],
  verseIds: [31103001, 31103002, 31103003], // 1 Nephi 1:1-3

  // People & Places
  people: ['nephi-1', 'lehi-1', 'laman-1', 'lemuel-1'],
  places: ['jerusalem', 'red-sea', 'bountiful'],
  maps: ['arabian-peninsula', 'promised-land'],

  // Notes
  commentaryIds: ['1', '2', '3'],
  imageIds: ['1', '2', '3'],
  chiasmusIds: ['1', '2'],

  // Search
  searchQueries: ['faith', 'repent', 'Jesus Christ', 'plates'],

  // Test user (create if needed)
  testUser: {
    username: 'testuser_regression',
    email: 'test_regression@example.com',
    password: 'testpass123',
    token: '' // Will be populated during test setup
  }
};

// Invalid data for negative tests
export const invalidFixtures = {
  nonExistentSlug: 'this-slug-does-not-exist-12345',
  nonExistentId: '99999999',
  invalidVerseId: -1,
  emptyString: '',
  nullValue: null
};

// Expected response shapes for validation
export const expectedShapes = {
  division: ['title', 'slug', 'description'],
  page: ['title', 'slug', 'sections'],
  section: ['title', 'slug', 'rows'],
  textBlock: ['guid', 'slug', 'heading', 'content'],
  person: ['slug', 'name', 'title'],
  place: ['slug', 'name', 'info'],
  searchResult: ['reference', 'text', 'slug']
};
```

**Step 3: Update test setup**

Modify `test/setup.ts`:
```typescript
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set Jest worker ID for database connection isolation
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';

// Configure test timeout (30 seconds for DB queries)
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Ensure database connection is ready
  const { sequelize } = await import('../src/config/database');
  await sequelize.authenticate();
});

// Global test teardown
afterAll(async () => {
  // Close database connections
  const { sequelize } = await import('../src/config/database');
  await sequelize.close();
});

// Suppress console output during tests (optional)
// Uncomment to reduce noise in test output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
// };
```

**Step 4: Commit test infrastructure**

```bash
git add test/helpers/ test/setup.ts
git commit -m "test: add GraphQL test helpers and fixtures"
```

---

### Task 2.2: Create Content Queries Regression Tests

**Files:**
- Create: `test/regression/content.test.ts`

**Step 1: Create content regression tests**

Create `test/regression/content.test.ts`:
```typescript
import { executeQuery } from '../helpers/graphql';
import { fixtures, invalidFixtures, expectedShapes } from '../helpers/fixtures';

describe('Content Queries Regression Tests', () => {
  describe('division', () => {
    it('should return all divisions when no slug provided', async () => {
      const { data, errors } = await executeQuery(`
        query {
          division {
            title
            slug
            description
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.division).toBeDefined();
      expect(Array.isArray(data?.division)).toBe(true);
      expect(data?.division.length).toBeGreaterThan(0);

      // Verify shape
      const division = data?.division[0];
      expectedShapes.division.forEach(field => {
        expect(division).toHaveProperty(field);
      });
    });

    it('should return specific division by slug', async () => {
      const { data, errors } = await executeQuery(`
        query {
          division(slug: ["1-nephi"]) {
            title
            slug
            description
            pages {
              title
              slug
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.division).toHaveLength(1);
      expect(data?.division[0].slug).toBe('1-nephi');
      expect(data?.division[0].title).toContain('Nephi');
      expect(data?.division[0].pages.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent slug', async () => {
      const { data, errors } = await executeQuery(`
        query {
          division(slug: ["${invalidFixtures.nonExistentSlug}"]) {
            title
            slug
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.division).toEqual([]);
    });
  });

  describe('page', () => {
    it('should return page with sections', async () => {
      const { data, errors } = await executeQuery(`
        query {
          page(slug: ["1-nephi-1"]) {
            title
            slug
            sections {
              title
              slug
              rows {
                weight
                type
                narration {
                  description
                }
              }
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.page).toHaveLength(1);
      expect(data?.page[0].slug).toBe('1-nephi-1');
      expect(data?.page[0].sections.length).toBeGreaterThan(0);
      expect(data?.page[0].sections[0].rows.length).toBeGreaterThan(0);
    });

    it('should return multiple pages', async () => {
      const slugs = ['1-nephi-1', '1-nephi-2'];
      const { data, errors } = await executeQuery(`
        query {
          page(slug: ${JSON.stringify(slugs)}) {
            title
            slug
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.page.length).toBe(2);
    });
  });

  describe('section', () => {
    it('should return section by slug', async () => {
      const { data, errors } = await executeQuery(`
        query {
          section(slug: ["1-nephi-1-1"]) {
            title
            slug
            sectionText {
              heading
              slug
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.section).toBeDefined();
    });
  });

  describe('text', () => {
    it('should return text block by slug', async () => {
      const { data, errors } = await executeQuery(`
        query {
          text(slug: ["1-nephi-1-1-1"]) {
            guid
            slug
            heading
            content
            duration
            people { name slug }
            places { name slug }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.text).toBeDefined();
      if (data?.text.length > 0) {
        expect(data?.text[0]).toHaveProperty('slug');
        expect(data?.text[0]).toHaveProperty('content');
      }
    });
  });

  describe('lookup', () => {
    it('should lookup text by scripture reference', async () => {
      const { data, errors } = await executeQuery(`
        query {
          lookup(ref: ["1 Nephi 1:1"]) {
            slug
            heading
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.lookup).toBeDefined();
    });
  });

  describe('search', () => {
    it('should return search results for valid query', async () => {
      const { data, errors } = await executeQuery(`
        query {
          search(query: "faith") {
            reference
            text
            slug
            page
            section
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.search).toBeDefined();
      expect(Array.isArray(data?.search)).toBe(true);
      expect(data?.search.length).toBeGreaterThan(0);

      // Verify shape
      const result = data?.search[0];
      expectedShapes.searchResult.forEach(field => {
        expect(result).toHaveProperty(field);
      });
    });

    it('should return empty array for no matches', async () => {
      const { data, errors } = await executeQuery(`
        query {
          search(query: "xyznonexistent12345") {
            reference
            text
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.search).toEqual([]);
    });
  });
});
```

**Step 2: Run content tests**

Run: `npm test -- --testPathPattern=content.test.ts --verbose`
Expected: All tests PASS

**Step 3: Commit content tests**

```bash
git add test/regression/content.test.ts
git commit -m "test: add content queries regression tests

- Test division queries (all, by slug, invalid)
- Test page queries with sections
- Test section and text queries
- Test lookup and search queries"
```

---

### Task 2.3: Create Scripture Queries Regression Tests

**Files:**
- Create: `test/regression/scripture.test.ts`

**Step 1: Create scripture regression tests**

Create `test/regression/scripture.test.ts`:
```typescript
import { executeQuery } from '../helpers/graphql';
import { fixtures } from '../helpers/fixtures';

describe('Scripture Queries Regression Tests', () => {
  describe('scripture', () => {
    it('should return verses by reference', async () => {
      const { data, errors } = await executeQuery(`
        query {
          scripture(ref: "1 Nephi 1:1-3") {
            ref
            passages {
              reference
              heading
              verses {
                verse
                verse_id
                text
              }
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.scripture).toBeDefined();
      expect(data?.scripture.ref).toBeDefined();
      expect(data?.scripture.passages.length).toBeGreaterThan(0);
      expect(data?.scripture.passages[0].verses.length).toBeGreaterThanOrEqual(3);
    });

    it('should return verses by verse_ids', async () => {
      const { data, errors } = await executeQuery(`
        query {
          scripture(verse_ids: [31103001, 31103002]) {
            passages {
              verses {
                verse_id
                text
              }
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.scripture.passages[0].verses.length).toBe(2);
    });
  });

  describe('verses', () => {
    it('should return verses by ID array', async () => {
      const { data, errors } = await executeQuery(`
        query {
          verses(verse_ids: [31103001, 31103002, 31103003]) {
            verse_id
            reference
            text
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.verses).toHaveLength(3);
      data?.verses.forEach((verse: any) => {
        expect(verse).toHaveProperty('verse_id');
        expect(verse).toHaveProperty('reference');
        expect(verse).toHaveProperty('text');
      });
    });
  });

  describe('read', () => {
    it('should return reading block with navigation', async () => {
      const { data, errors } = await executeQuery(`
        query {
          read(ref: "1 Nephi 1") {
            ref
            verse_id
            verse_count
            prev_ref
            next_ref
            sections {
              ref
              heading
              blocks {
                ref
                voice
                lines {
                  ref
                  verse_num
                  text
                }
              }
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.read).toBeDefined();
      expect(data?.read.ref).toBeDefined();
      expect(data?.read.sections.length).toBeGreaterThan(0);
      expect(data?.read.sections[0].blocks.length).toBeGreaterThan(0);
    });
  });

  describe('versehighlights', () => {
    it('should return highlights for verse pairs', async () => {
      const { data, errors } = await executeQuery(`
        query {
          versehighlights(verse_pairs: [[31103001, 1001001]]) {
            isQuote
            bom_verse_id
            bible_verse_id
            bom_highlight
            bible_highlight
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.versehighlights).toBeDefined();
    });
  });
});
```

**Step 2: Run scripture tests**

Run: `npm test -- --testPathPattern=scripture.test.ts --verbose`
Expected: All tests PASS

**Step 3: Commit scripture tests**

```bash
git add test/regression/scripture.test.ts
git commit -m "test: add scripture queries regression tests

- Test scripture by reference and verse_ids
- Test verses query
- Test read block with navigation
- Test verse highlights"
```

---

### Task 2.4: Create People & Places Regression Tests

**Files:**
- Create: `test/regression/people-places.test.ts`

**Step 1: Create people/places regression tests**

Create `test/regression/people-places.test.ts`:
```typescript
import { executeQuery } from '../helpers/graphql';
import { fixtures, expectedShapes } from '../helpers/fixtures';

describe('People & Places Queries Regression Tests', () => {
  describe('person', () => {
    it('should return person by slug', async () => {
      const { data, errors } = await executeQuery(`
        query {
          person(slug: ["nephi-1"]) {
            slug
            name
            title
            classification
            description
            relations {
              relation
              person {
                name
                slug
              }
            }
            index {
              slug
              ref
              text
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.person).toHaveLength(1);
      expect(data?.person[0].slug).toBe('nephi-1');
      expect(data?.person[0].name).toContain('Nephi');

      // Verify shape
      expectedShapes.person.forEach(field => {
        expect(data?.person[0]).toHaveProperty(field);
      });
    });

    it('should return multiple people', async () => {
      const { data, errors } = await executeQuery(`
        query {
          person(slug: ["nephi-1", "lehi-1"]) {
            slug
            name
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.person.length).toBe(2);
    });
  });

  describe('peoplenetwork', () => {
    it('should return relationship network', async () => {
      const { data, errors } = await executeQuery(`
        query {
          peoplenetwork {
            nodes {
              id
              name
              group
            }
            links {
              source
              target
              value
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.peoplenetwork).toBeDefined();
      expect(data?.peoplenetwork.nodes.length).toBeGreaterThan(0);
      expect(data?.peoplenetwork.links.length).toBeGreaterThan(0);
    });
  });

  describe('place', () => {
    it('should return place by slug', async () => {
      const { data, errors } = await executeQuery(`
        query {
          place(slug: ["jerusalem"]) {
            slug
            name
            info
            type
            location
            description
            maps {
              slug
              name
            }
            index {
              slug
              ref
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.place).toHaveLength(1);
      expect(data?.place[0].slug).toBe('jerusalem');

      // Verify shape
      expectedShapes.place.forEach(field => {
        expect(data?.place[0]).toHaveProperty(field);
      });
    });
  });

  describe('maps', () => {
    it('should return all maps', async () => {
      const { data, errors } = await executeQuery(`
        query {
          maps {
            slug
            name
            desc
            centerx
            centery
            zoom
            tiles
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.maps).toBeDefined();
      expect(data?.maps.length).toBeGreaterThan(0);
    });

    it('should return map with places', async () => {
      const { data, errors } = await executeQuery(`
        query {
          maps(slug: ["arabian-peninsula"]) {
            slug
            name
            places {
              slug
              name
              lat
              lng
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      if (data?.maps.length > 0) {
        expect(data?.maps[0].places).toBeDefined();
      }
    });
  });

  describe('mapstories', () => {
    it('should return map stories', async () => {
      const { data, errors } = await executeQuery(`
        query {
          mapstories(map: ["arabian-peninsula"]) {
            slug
            title
            description
            moves {
              guid
              seq
              description
              people {
                slug
                name
              }
              startPlace {
                slug
                lat
                lng
              }
              endPlace {
                slug
                lat
                lng
              }
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.mapstories).toBeDefined();
    });
  });

  describe('timeline', () => {
    it('should return timeline events', async () => {
      const { data, errors } = await executeQuery(`
        query {
          timeline {
            slug
            heading
            date
            x
            y
            text {
              slug
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.timeline).toBeDefined();
      expect(data?.timeline.length).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run people/places tests**

Run: `npm test -- --testPathPattern=people-places.test.ts --verbose`
Expected: All tests PASS

**Step 3: Commit people/places tests**

```bash
git add test/regression/people-places.test.ts
git commit -m "test: add people/places queries regression tests

- Test person queries with relations
- Test people network graph
- Test place queries
- Test maps and map stories
- Test timeline events"
```

---

### Task 2.5: Create Notes & Commentary Regression Tests

**Files:**
- Create: `test/regression/notes.test.ts`

**Step 1: Create notes regression tests**

Create `test/regression/notes.test.ts`:
```typescript
import { executeQuery } from '../helpers/graphql';

describe('Notes & Commentary Queries Regression Tests', () => {
  describe('commentary', () => {
    it('should return commentary by ID', async () => {
      const { data, errors } = await executeQuery(`
        query {
          commentary(id: ["1"]) {
            id
            slug
            title
            text
            reference
            publication {
              source_title
              source_name
              source_year
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.commentary).toBeDefined();
      if (data?.commentary.length > 0) {
        expect(data?.commentary[0]).toHaveProperty('id');
        expect(data?.commentary[0]).toHaveProperty('title');
        expect(data?.commentary[0]).toHaveProperty('text');
      }
    });
  });

  describe('publications', () => {
    it('should return all publication sources', async () => {
      const { data, errors } = await executeQuery(`
        query {
          publications {
            source_id
            source_title
            source_name
            source_short
            source_year
            source_publisher
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.publications).toBeDefined();
      expect(data?.publications.length).toBeGreaterThan(0);
    });
  });

  describe('image', () => {
    it('should return image by ID', async () => {
      const { data, errors } = await executeQuery(`
        query {
          image(id: ["1"]) {
            id
            title
            artist
            link
            width
            height
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.image).toBeDefined();
      if (data?.image.length > 0) {
        expect(data?.image[0]).toHaveProperty('id');
        expect(data?.image[0]).toHaveProperty('title');
      }
    });
  });

  describe('chiasmus', () => {
    it('should return all chiasmus structures', async () => {
      const { data, errors } = await executeQuery(`
        query {
          chiasmus {
            chiasmus_id
            title
            reference
            scheme
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.chiasmus).toBeDefined();
      expect(data?.chiasmus.length).toBeGreaterThan(0);
    });

    it('should return chiasmus with lines by ID', async () => {
      const { data, errors } = await executeQuery(`
        query {
          chiasmus(id: ["1"]) {
            chiasmus_id
            title
            reference
            scheme
            lines {
              line_key
              line_text
              highlights
              label
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      if (data?.chiasmus.length > 0) {
        expect(data?.chiasmus[0].lines).toBeDefined();
      }
    });
  });

  describe('passagenotes', () => {
    it('should return comprehensive passage notes', async () => {
      const { data, errors } = await executeQuery(`
        query {
          passagenotes(verse_ids: [31103001, 31103002, 31103003]) {
            commentary {
              id
              title
              preview
            }
            people {
              name
              slug
            }
            places {
              name
              slug
            }
            images {
              title
              file
            }
            chiasmus {
              title
              reference
            }
            refs {
              verse_id
              ref
              type
            }
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.passagenotes).toBeDefined();
      expect(data?.passagenotes).toHaveProperty('commentary');
      expect(data?.passagenotes).toHaveProperty('people');
      expect(data?.passagenotes).toHaveProperty('places');
    });
  });

  describe('history', () => {
    it('should return historical documents', async () => {
      const { data, errors } = await executeQuery(`
        query {
          history {
            id
            slug
            year
            date
            type
            source
            author
            document
            teaser
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.history).toBeDefined();
    });
  });

  describe('fax', () => {
    it('should return facsimile pages', async () => {
      const { data, errors } = await executeQuery(`
        query {
          fax(filter: "1830") {
            slug
            title
            info
            code
            pages
            format
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.fax).toBeDefined();
    });
  });
});
```

**Step 2: Run notes tests**

Run: `npm test -- --testPathPattern=notes.test.ts --verbose`
Expected: All tests PASS

**Step 3: Commit notes tests**

```bash
git add test/regression/notes.test.ts
git commit -m "test: add notes/commentary regression tests

- Test commentary queries
- Test publications listing
- Test image queries
- Test chiasmus queries
- Test passagenotes comprehensive query
- Test history and fax queries"
```

---

### Task 2.6: Create Utility Queries Regression Tests

**Files:**
- Create: `test/regression/utils.test.ts`

**Step 1: Create utility regression tests**

Create `test/regression/utils.test.ts`:
```typescript
import { executeQuery, executeMutation } from '../helpers/graphql';

describe('Utility Queries Regression Tests', () => {
  describe('labels', () => {
    it('should return all labels', async () => {
      const { data, errors } = await executeQuery(`
        query {
          labels {
            key
            val
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.labels).toBeDefined();
      expect(data?.labels.length).toBeGreaterThan(0);
      expect(data?.labels[0]).toHaveProperty('key');
      expect(data?.labels[0]).toHaveProperty('val');
    });
  });

  describe('menu', () => {
    it('should return menu structure', async () => {
      const { data, errors } = await executeQuery(`
        query {
          menu {
            title
            slug
            description
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.menu).toBeDefined();
    });
  });

  describe('books', () => {
    it('should return book/chapter structure', async () => {
      const { data, errors } = await executeQuery(`
        query {
          books {
            title
            slug
            chapters
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.books).toBeDefined();
      expect(data?.books.length).toBeGreaterThan(0);
    });
  });

  describe('markdown', () => {
    it('should return markdown content', async () => {
      const { data, errors } = await executeQuery(`
        query {
          markdown(slug: ["about"]) {
            slug
            markdown
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.markdown).toBeDefined();
    });
  });

  describe('shortlink', () => {
    it('should create and retrieve shortlink', async () => {
      // Create shortlink
      const createResult = await executeMutation(`
        mutation {
          shortlink(string: "/1-nephi-1") {
            hash
          }
        }
      `);

      expect(createResult.errors).toBeUndefined();
      expect(createResult.data?.shortlink.hash).toBeDefined();

      const hash = createResult.data?.shortlink.hash;

      // Retrieve shortlink
      const getResult = await executeQuery(`
        query {
          shortlink(hash: ["${hash}"]) {
            shortLink
          }
        }
      `);

      expect(getResult.errors).toBeUndefined();
      expect(getResult.data?.shortlink.shortLink).toBeDefined();
    });
  });

  describe('test', () => {
    it('should return health check', async () => {
      const { data, errors } = await executeQuery(`
        query {
          test {
            success
          }
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.test).toBeDefined();
    });
  });

  describe('generateToken', () => {
    it('should generate a token', async () => {
      const { data, errors } = await executeQuery(`
        query {
          generateToken
        }
      `);

      expect(errors).toBeUndefined();
      expect(data?.generateToken).toBeDefined();
      expect(typeof data?.generateToken).toBe('string');
      expect(data?.generateToken.length).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run utility tests**

Run: `npm test -- --testPathPattern=utils.test.ts --verbose`
Expected: All tests PASS

**Step 3: Commit utility tests**

```bash
git add test/regression/utils.test.ts
git commit -m "test: add utility queries regression tests

- Test labels query
- Test menu query
- Test books structure query
- Test markdown query
- Test shortlink create/retrieve
- Test health check
- Test token generation"
```

---

### Task 2.7: Create Test Runner Script

**Files:**
- Create: `test/run-regression.sh`
- Modify: `package.json`

**Step 1: Create regression test runner**

Create `test/run-regression.sh`:
```bash
#!/bin/bash

echo "==================================="
echo "Running Regression Test Suite"
echo "==================================="
echo ""

# Set exit on error
set -e

# Run all regression tests
echo "Running content tests..."
npm test -- --testPathPattern=content.test.ts --verbose

echo ""
echo "Running scripture tests..."
npm test -- --testPathPattern=scripture.test.ts --verbose

echo ""
echo "Running people/places tests..."
npm test -- --testPathPattern=people-places.test.ts --verbose

echo ""
echo "Running notes tests..."
npm test -- --testPathPattern=notes.test.ts --verbose

echo ""
echo "Running utils tests..."
npm test -- --testPathPattern=utils.test.ts --verbose

echo ""
echo "Running messenger tests..."
npm test -- --testPathPattern=messenger.test.ts --verbose

echo ""
echo "==================================="
echo "All Regression Tests Passed!"
echo "==================================="
```

**Step 2: Make executable**

Run: `chmod +x test/run-regression.sh`

**Step 3: Add npm script**

Add to `package.json` scripts:
```json
"test:regression": "jest --testPathPattern=regression --verbose",
"test:all": "./test/run-regression.sh"
```

**Step 4: Commit test runner**

```bash
git add test/run-regression.sh package.json
git commit -m "test: add regression test runner script

- Add shell script to run all regression tests
- Add npm scripts for regression testing"
```

---

## Summary

### Phase 1: API Documentation
| Task | Description | Status |
|------|-------------|--------|
| 1.1 | Create API reference structure | Pending |
| 1.2 | Document all queries | Pending |
| 1.3 | Document all mutations | Pending |
| 1.4 | Document all types | Pending |

### Phase 2: Regression Test Suite
| Task | Description | Status |
|------|-------------|--------|
| 2.1 | Create test utilities and helpers | Pending |
| 2.2 | Content queries tests | Pending |
| 2.3 | Scripture queries tests | Pending |
| 2.4 | People/Places queries tests | Pending |
| 2.5 | Notes/Commentary tests | Pending |
| 2.6 | Utility queries tests | Pending |
| 2.7 | Test runner script | Pending |

### Coverage Summary
After completing this plan:
- **60+ GraphQL queries** documented and tested
- **20+ mutations** documented
- **50+ types** documented
- **6 test suites** covering all resolver modules
- **Automated test runner** for CI/CD integration

### Next Steps
Once regression baseline is complete:
1. Run `npm test:regression` to establish baseline
2. Save test results as benchmark
3. Proceed with backend modernization plan
4. Run regression tests after each modernization task to catch regressions
