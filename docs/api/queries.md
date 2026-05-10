# GraphQL Queries

This document provides comprehensive documentation for all GraphQL queries available in the Book of Mormon Online API.

## Table of Contents

- [Content Queries (BomPage)](#content-queries-bompage)
- [User Queries (BomUser)](#user-queries-bomuser)
- [Commentary Queries (BomNotes)](#commentary-queries-bomnotes)
- [People and Places Queries (BomPeoplePlaces)](#people-and-places-queries-bompeopeplaces)
- [Utility Queries (BomUtils)](#utility-queries-bomutils)
- [Community Queries (BomCommunity)](#community-queries-bomcommunity)
- [Messenger Queries (BomMessenger)](#messenger-queries-bommessenger)

---

## Content Queries (BomPage)

These queries handle the core scripture content including divisions, pages, sections, and text blocks.

### division

Retrieves division(s) of the Book of Mormon (e.g., books, major sections).

```graphql
division(slug: [String]): [Division]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `[String]` | Array of division slugs to retrieve |

**Example:**
```graphql
query {
  division(slug: ["1-nephi"]) {
    guid
    title
    slug
    link
    description
    weight
    pages {
      guid
      title
      slug
    }
  }
}
```

**Returns:** Array of `Division` objects containing title, description, and nested pages.

---

### page

Retrieves page(s) containing scripture content and sections.

```graphql
page(slug: [String]): [Page]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `[String]` | Array of page slugs to retrieve |

**Example:**
```graphql
query {
  page(slug: ["1-nephi-1"]) {
    guid
    title
    ref
    counts
    sections {
      guid
      title
      slug
    }
    text {
      heading
      content
    }
  }
}
```

**Returns:** Array of `Page` objects with title, reference, counts, sections, and text blocks.

---

### section

Retrieves section(s) within a page.

```graphql
section(slug: [String]): [Section]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `[String]` | Array of section slugs to retrieve |

**Example:**
```graphql
query {
  section(slug: ["1-nephi-1-1"]) {
    guid
    title
    weight
    slug
    ref
    badge
    rows {
      guid
      type
    }
    ambient
  }
}
```

**Returns:** Array of `Section` objects with title, reference, rows, and ambient audio info.

---

### text

Retrieves text block(s) containing scripture verses.

```graphql
text(slug: [String]): [TextBlock]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `[String]` | Array of text block slugs to retrieve |

**Example:**
```graphql
query {
  text(slug: ["1-nephi-1-1-4"]) {
    guid
    slug
    heading
    content
    chrono
    duration
    people {
      name
      slug
    }
    places {
      name
      slug
    }
  }
}
```

**Returns:** Array of `TextBlock` objects with content, metadata, and related people/places.

---

### lookup

Looks up text blocks by scripture reference.

```graphql
lookup(ref: [String]): [TextBlock]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `ref` | `[String]` | Array of scripture references (e.g., "1 Nephi 1:1") |

**Example:**
```graphql
query {
  lookup(ref: ["1 Nephi 1:1", "Alma 32:21"]) {
    guid
    heading
    content
    parent_page {
      title
      slug
    }
  }
}
```

**Returns:** Array of `TextBlock` objects matching the scripture references.

---

### queue

Queues text blocks for reading progress tracking.

```graphql
queue(token: String, items: [QueueInput]): [TextBlock]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |
| `items` | `[QueueInput]` | Array of queue items with slug, plan, reference, and blocks |

**Input Type - QueueInput:**
```graphql
input QueueInput {
  slug: String
  plan: String
  reference: String
  blocks: [Int!]
}
```

**Example:**
```graphql
query {
  queue(token: "user-token", items: [
    { slug: "1-nephi-1", reference: "1 Nephi 1:1-5" }
  ]) {
    guid
    heading
    content
  }
}
```

**Returns:** Array of `TextBlock` objects that have been queued.

---

### read

Retrieves a reading block with navigation context.

```graphql
read(token: String, ref: String): ReadBlock
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token (optional) |
| `ref` | `String` | Scripture reference to read |

**Example:**
```graphql
query {
  read(ref: "1 Nephi 1:1") {
    ref
    verse_id
    verse_count
    next_ref
    prev_ref
    sections {
      ref
      heading
      blocks {
        ref
        lines {
          text
          verse_num
        }
      }
    }
  }
}
```

**Returns:** A `ReadBlock` object with verse content, navigation links, and section structure.

---

## User Queries (BomUser)

These queries handle user authentication, profiles, and study progress.

### user

Retrieves user profile information.

```graphql
user(token: [String]): User
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `[String]` | User authentication token(s) |

**Example:**
```graphql
query {
  user(token: ["user-token"]) {
    user
    email
    name
    bookmark
    complete
    started
    time
    progress {
      count
      completed
    }
  }
}
```

**Returns:** `User` object with profile info, progress, and study history.

---

### users

Retrieves multiple users by their IDs.

```graphql
users(user_ids: [String]): [User]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `user_ids` | `[String]` | Array of user IDs to retrieve |

**Example:**
```graphql
query {
  users(user_ids: ["user1", "user2"]) {
    user
    name
    complete
  }
}
```

**Returns:** Array of `User` objects.

---

### generateToken

Generates a new anonymous user token.

```graphql
generateToken(seed: Int): String
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `seed` | `Int` | Optional seed for token generation |

**Example:**
```graphql
query {
  generateToken(seed: 12345)
}
```

**Returns:** String containing the generated token.

---

### signin

Authenticates a user with username and password.

```graphql
signin(token: String, username: String, password: String): SignIn
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | Current session token |
| `username` | `String` | User's username |
| `password` | `String` | User's password |

**Example:**
```graphql
query {
  signin(token: "session-token", username: "john", password: "secret") {
    isSuccess
    msg
    user {
      user
      name
      email
    }
  }
}
```

**Returns:** `SignIn` object with success status, message, and user data.

---

### tokensignin

Authenticates a user using an existing token.

```graphql
tokensignin(token: String): SignIn
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |

**Example:**
```graphql
query {
  tokensignin(token: "user-token") {
    isSuccess
    user {
      user
      name
    }
  }
}
```

**Returns:** `SignIn` object with authentication result.

---

### socialsignin

Authenticates a user via social network (OAuth).

```graphql
socialsignin(network: String, token: String, social_token: String): SignIn
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `network` | `String` | Social network name (e.g., "google", "facebook") |
| `token` | `String` | Current session token |
| `social_token` | `String` | OAuth token from social provider |

**Example:**
```graphql
query {
  socialsignin(network: "google", token: "session-token", social_token: "oauth-token") {
    isSuccess
    msg
    user {
      user
      name
    }
    social {
      nickname
      profile_url
    }
  }
}
```

**Returns:** `SignIn` object with user data and social profile info.

---

### userprogress

Retrieves overall study progress for a user.

```graphql
userprogress(token: String): ProgressScore
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |

**Example:**
```graphql
query {
  userprogress(token: "user-token") {
    count
    started
    completed
    started_items
    completed_items
    summary {
      first
      duration
      count
    }
  }
}
```

**Returns:** `ProgressScore` object with completion statistics.

---

### studylog

Retrieves detailed study session history.

```graphql
studylog(token: String): StudyLog
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |

**Example:**
```graphql
query {
  studylog(token: "user-token") {
    sessions {
      timestamp
      datetime
      duration
      description
      slug
    }
    summary {
      first
      duration
      count
    }
  }
}
```

**Returns:** `StudyLog` object with session history and summary statistics.

---

### pageprogress

Retrieves progress for specific pages.

```graphql
pageprogress(token: String, slug: [String]): [ProgressScore]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |
| `slug` | `[String]` | Array of page slugs |

**Example:**
```graphql
query {
  pageprogress(token: "user-token", slug: ["1-nephi-1", "1-nephi-2"]) {
    slug
    count
    started
    completed
  }
}
```

**Returns:** Array of `ProgressScore` objects for each page.

---

### userdailyscores

Retrieves daily progress scores for visualization.

```graphql
userdailyscores(token: String): UserDailyScore
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |

**Example:**
```graphql
query {
  userdailyscores(token: "user-token") {
    dates
    progress
  }
}
```

**Returns:** `UserDailyScore` object with arrays of dates and corresponding progress values.

---

### sourceUsage

Retrieves usage statistics for a specific source.

```graphql
sourceUsage(token: String, source: String): Float
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |
| `source` | `String` | Source identifier |

**Example:**
```graphql
query {
  sourceUsage(token: "user-token", source: "source-id")
}
```

**Returns:** Float representing usage percentage or count.

---

### closetab

Retrieves tabs that should be closed for the user session.

```graphql
closetab(token: String): [String]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |

**Example:**
```graphql
query {
  closetab(token: "user-token")
}
```

**Returns:** Array of strings identifying tabs to close.

---

### test

Tests database and HTTP connectivity.

```graphql
test: Test
```

**Arguments:** None

**Example:**
```graphql
query {
  test {
    db
    http
    http2
  }
}
```

**Returns:** `Test` object with connection status for database and HTTP services.

---

## Commentary Queries (BomNotes)

These queries retrieve scholarly commentary, images, facsimiles, and annotations.

### fax

Retrieves facsimile information for original manuscripts.

```graphql
fax(filter: String): [Fax]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `filter` | `String` | Filter criteria for facsimiles |

**Example:**
```graphql
query {
  fax(filter: "original") {
    slug
    code
    title
    pages
    pgoffset
    info
    format
  }
}
```

**Returns:** Array of `Fax` objects with manuscript metadata.

---

### faxIndex

Retrieves page index for a specific facsimile.

```graphql
faxIndex(slug: String): FaxIndex
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `String` | Facsimile slug identifier |

**Example:**
```graphql
query {
  faxIndex(slug: "original-manuscript") {
    slug
    pages
  }
}
```

**Returns:** `FaxIndex` object with page mapping arrays.

---

### image

Retrieves image(s) associated with scripture passages.

```graphql
image(id: [String]): [Image]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `id` | `[String]` | Array of image IDs |

**Example:**
```graphql
query {
  image(id: ["img-001", "img-002"]) {
    id
    file
    title
    artist
    link
    width
    height
    location {
      heading
      content
    }
  }
}
```

**Returns:** Array of `Image` objects with file info, dimensions, and associated text location.

---

### commentary

Retrieves commentary entries for scripture passages.

```graphql
commentary(id: [String]): [Commentary]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `id` | `[String]` | Array of commentary IDs |

**Example:**
```graphql
query {
  commentary(id: ["com-001"]) {
    id
    verse_id
    verse_range
    reference
    title
    text
    preview
    publication {
      source_title
      source_name
      source_year
    }
  }
}
```

**Returns:** Array of `Commentary` objects with text, reference, and publication source.

---

### sources

Retrieves source publication information.

```graphql
sources(id: [String]): [Source]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `id` | `[String]` | Array of source IDs |

**Example:**
```graphql
query {
  sources(id: ["source-001"]) {
    source_id
    source_rating
    source_title
    source_name
    source_short
    source_url
    source_description
    source_publisher
    source_year
  }
}
```

**Returns:** Array of `Source` objects with publication details.

---

### publications

Retrieves all available publication sources.

```graphql
publications: [Source]
```

**Arguments:** None

**Example:**
```graphql
query {
  publications {
    source_id
    source_title
    source_name
    source_publisher
    source_year
  }
}
```

**Returns:** Array of all `Source` objects in the system.

---

### history

Retrieves historical documents related to the Book of Mormon.

```graphql
history(slug: [String]): [HistoricalDocument]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `[String]` | Array of document slugs |

**Example:**
```graphql
query {
  history(slug: ["letter-1829"]) {
    seq
    id
    slug
    year
    date
    type
    source
    author
    document
    pages
    citation
    teaser
    transcript
  }
}
```

**Returns:** Array of `HistoricalDocument` objects with document metadata and content.

---

### chiasmus

Retrieves chiastic structures in the text.

```graphql
chiasmus(id: [String]): [Chiasmus]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `id` | `[String]` | Array of chiasmus IDs |

**Example:**
```graphql
query {
  chiasmus(id: ["chi-001"]) {
    chiasmus_id
    reference
    scheme
    title
    lines {
      guid
      line_key
      line_text
      highlights
      label
    }
  }
}
```

**Returns:** Array of `Chiasmus` objects with structural analysis.

---

### passagenotes

Retrieves all notes and annotations for a scripture passage.

```graphql
passagenotes(verse_ids: [Int], start_verse_id: Int, end_verse_id: Int): PassageNotes
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `verse_ids` | `[Int]` | Specific verse IDs |
| `start_verse_id` | `Int` | Start of verse range |
| `end_verse_id` | `Int` | End of verse range |

**Example:**
```graphql
query {
  passagenotes(start_verse_id: 1, end_verse_id: 10) {
    commentary {
      id
      title
      text
    }
    chiasmus {
      chiasmus_id
      title
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
      id
      title
    }
    fax {
      slug
      title
    }
    refs {
      ref
      type
    }
  }
}
```

**Returns:** `PassageNotes` object aggregating all annotations for the passage.

---

## People and Places Queries (BomPeoplePlaces)

These queries retrieve information about people, places, maps, and timelines.

### person

Retrieves person information by slug.

```graphql
person(slug: [String]): [People]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `[String]` | Array of person slugs |

**Example:**
```graphql
query {
  person(slug: ["nephi"]) {
    guid
    slug
    name
    title
    classification
    identification
    description
    relations {
      relation
      person {
        name
        slug
      }
    }
  }
}
```

**Returns:** Array of `People` objects with biographical information.

---

### people

Retrieves multiple people (alias for person query).

```graphql
people(slug: [String]): [People]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `[String]` | Array of person slugs |

**Example:**
```graphql
query {
  people(slug: ["nephi", "lehi"]) {
    name
    title
    classification
    index {
      ref
      text
    }
  }
}
```

**Returns:** Array of `People` objects.

---

### peoplenetwork

Retrieves the network graph of relationships between people.

```graphql
peoplenetwork: PeopleNetwork
```

**Arguments:** None

**Example:**
```graphql
query {
  peoplenetwork {
    nodes {
      name
      slug
      title
      group
      cluster
      radius
      fill
      stroke
    }
    links {
      source
      target
      value
      strokeWidth
      strokeColor
    }
  }
}
```

**Returns:** `PeopleNetwork` object with nodes and links for visualization.

---

### place

Retrieves place information by slug.

```graphql
place(slug: [String]): [Place]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `[String]` | Array of place slugs |

**Example:**
```graphql
query {
  place(slug: ["jerusalem"]) {
    guid
    slug
    name
    aka
    info
    type
    location
    description
    lat
    lng
    maps {
      name
      slug
    }
  }
}
```

**Returns:** Array of `Place` objects with geographic and descriptive information.

---

### places

Retrieves places associated with a specific map.

```graphql
places(map: [String]): [Place]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `map` | `[String]` | Array of map slugs to filter places |

**Example:**
```graphql
query {
  places(map: ["old-world"]) {
    name
    slug
    lat
    lng
    type
    icon
  }
}
```

**Returns:** Array of `Place` objects on the specified maps.

---

### maps

Retrieves map configuration and metadata.

```graphql
maps(slug: [String]): [Map]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `[String]` | Array of map slugs |

**Example:**
```graphql
query {
  maps(slug: ["old-world", "new-world"]) {
    name
    slug
    desc
    group
    centerx
    centery
    minzoom
    maxzoom
    zoom
    tiles
    places {
      name
      slug
    }
  }
}
```

**Returns:** Array of `Map` objects with configuration and associated places.

---

### mapstory

Retrieves a journey/story on a map.

```graphql
mapstory(slug: String, map: String): [MapStory]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `String` | Story slug identifier |
| `map` | `String` | Map slug to filter stories |

**Example:**
```graphql
query {
  mapstory(slug: "lehis-journey") {
    slug
    guid
    title
    description
    moves {
      seq
      startPlace {
        name
        lat
        lng
      }
      endPlace {
        name
        lat
        lng
      }
      travelers
      duration
      description
    }
  }
}
```

**Returns:** Array of `MapStory` objects with journey waypoints.

---

### mapstories

Retrieves all stories for specified maps.

```graphql
mapstories(map: [String]!): [MapStory]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `map` | `[String]!` | Array of map slugs (required) |

**Example:**
```graphql
query {
  mapstories(map: ["old-world"]) {
    slug
    title
    description
    moves {
      seq
      description
    }
  }
}
```

**Returns:** Array of all `MapStory` objects for the specified maps.

---

### timeline

Retrieves timeline events.

```graphql
timeline(slug: [String]): [Event]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `[String]` | Array of event slugs |

**Example:**
```graphql
query {
  timeline(slug: ["event-001"]) {
    id
    date
    slug
    file
    reference
    link
    html
    heading
    text {
      content
    }
  }
}
```

**Returns:** Array of `Event` objects with chronological information.

---

## Utility Queries (BomUtils)

These queries provide utility functions for search, navigation, and content transformation.

### labels

Retrieves all UI labels for internationalization.

```graphql
labels: [Label]
```

**Arguments:** None

**Example:**
```graphql
query {
  labels {
    key
    val
  }
}
```

**Returns:** Array of `Label` key-value pairs.

---

### menu

Retrieves navigation menu items.

```graphql
menu(slug: [String]): [Menu]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `[String]` | Menu section slugs |

**Example:**
```graphql
query {
  menu(slug: ["main"]) {
    label
    link
  }
}
```

**Returns:** Array of `Menu` items with labels and links.

---

### books

Retrieves all books with chapter information.

```graphql
books(seed: String): [Book]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `seed` | `String` | Optional seed for ordering |

**Example:**
```graphql
query {
  books {
    book
    chapters
  }
}
```

**Returns:** Array of `Book` objects with book names and chapter counts.

---

### search

Searches scripture content by keyword.

```graphql
search(query: String): [SearchResult]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `query` | `String` | Search query string |

**Example:**
```graphql
query {
  search(query: "faith") {
    reference
    text
    section
    page
    slug
    speaker
    voice
  }
}
```

**Returns:** Array of `SearchResult` objects with matching passages.

---

### shortlink

Retrieves the full content from a shortened link hash.

```graphql
shortlink(hash: [String]): Shortlinks
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `hash` | `[String]` | Shortlink hash codes |

**Example:**
```graphql
query {
  shortlink(hash: ["abc123"]) {
    hash
    string
  }
}
```

**Returns:** `Shortlinks` object with the decoded string content.

---

### markdown

Retrieves markdown content by slug.

```graphql
markdown(slug: [String]): [Markdown]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `slug` | `[String]` | Markdown document slugs |

**Example:**
```graphql
query {
  markdown(slug: ["about"]) {
    slug
    markdown
  }
}
```

**Returns:** Array of `Markdown` objects with raw markdown content.

---

### scripture

Retrieves scripture verses with optional version specification.

```graphql
scripture(ref: String, verse_ids: [Int], version: String): ScriptureResults
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `ref` | `String` | Scripture reference string |
| `verse_ids` | `[Int]` | Array of verse IDs |
| `version` | `String` | Bible/scripture version identifier |

**Example:**
```graphql
query {
  scripture(ref: "1 Nephi 1:1-5") {
    ref
    passages {
      reference
      heading
      verses {
        verse_id
        reference
        text
      }
    }
    verses {
      verse_id
      book
      chapter
      verse
      text
    }
  }
}
```

**Returns:** `ScriptureResults` object with passages and individual verses.

---

### verses

Retrieves verses by their IDs.

```graphql
verses(verse_ids: [Int]): [Scripture]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `verse_ids` | `[Int]` | Array of verse IDs to retrieve |

**Example:**
```graphql
query {
  verses(verse_ids: [1, 2, 3]) {
    verse_id
    reference
    book
    chapter
    verse
    text
  }
}
```

**Returns:** Array of `Scripture` objects.

---

### versehighlights

Retrieves highlight comparisons between verse pairs.

```graphql
versehighlights(verse_pairs: [[Int]]): [ScriptureHighlights]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `verse_pairs` | `[[Int]]` | Array of verse ID pairs for comparison |

**Example:**
```graphql
query {
  versehighlights(verse_pairs: [[100, 5000], [101, 5001]]) {
    bom_verse_id
    bible_verse_id
    bom_highlight
    bible_highlight
    isQuote
  }
}
```

**Returns:** Array of `ScriptureHighlights` objects showing textual parallels.

---

## Community Queries (BomCommunity)

These queries handle study groups, feeds, leaderboards, and community features.

### homefeed

Retrieves the home feed with group activity.

```graphql
homefeed(token: String, channel: [String], message: [String]): HomeFeed
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |
| `channel` | `[String]` | Filter by channel URLs |
| `message` | `[String]` | Filter by message IDs |

**Example:**
```graphql
query {
  homefeed(token: "user-token") {
    groups {
      url
      name
      description
      members {
        nickname
      }
    }
    feed {
      id
      timestamp
      msg
      user {
        nickname
        picture
      }
      likes
      replycount
    }
  }
}
```

**Returns:** `HomeFeed` object with groups and feed items.

---

### homethread

Retrieves a conversation thread.

```graphql
homethread(token: String, channel: String, message: String): [HomeFeedItem]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |
| `channel` | `String` | Channel URL |
| `message` | `String` | Parent message ID |

**Example:**
```graphql
query {
  homethread(token: "user-token", channel: "channel-url", message: "msg-123") {
    id
    timestamp
    msg
    user {
      nickname
    }
  }
}
```

**Returns:** Array of `HomeFeedItem` objects in the thread.

---

### homegroups

Retrieves user's study groups.

```graphql
homegroups(token: String, grouping: String): [HomeGroup]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |
| `grouping` | `String` | Group category filter |

**Example:**
```graphql
query {
  homegroups(token: "user-token") {
    url
    name
    description
    privacy
    picture
    members {
      nickname
      progress
    }
  }
}
```

**Returns:** Array of `HomeGroup` objects.

---

### postcomments

Retrieves comments on a post.

```graphql
postcomments(token: String, message: Int): [HomeFeedItem]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |
| `message` | `Int` | Message ID |

**Example:**
```graphql
query {
  postcomments(token: "user-token", message: 123) {
    id
    msg
    user {
      nickname
    }
    timestamp
  }
}
```

**Returns:** Array of `HomeFeedItem` comments.

---

### moregroups

Retrieves additional groups for discovery.

```graphql
moregroups(token: String, grouping: String): [HomeGroup]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |
| `grouping` | `String` | Group category filter |

**Example:**
```graphql
query {
  moregroups(token: "user-token", grouping: "public") {
    url
    name
    description
    member_count
  }
}
```

**Returns:** Array of `HomeGroup` objects available to join.

---

### requestedUsers

Retrieves users who have requested to join a group.

```graphql
requestedUsers(token: String, channel: String): [HomeUser]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token (must be group admin) |
| `channel` | `String` | Channel URL |

**Example:**
```graphql
query {
  requestedUsers(token: "admin-token", channel: "channel-url") {
    user_id
    nickname
    picture
    progress
  }
}
```

**Returns:** Array of `HomeUser` objects with pending join requests.

---

### leaderboard

Retrieves study progress leaderboard.

```graphql
leaderboard(token: String): LeaderBoard
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |

**Example:**
```graphql
query {
  leaderboard(token: "user-token") {
    recentFinishers {
      nickname
      picture
      finished
    }
    currentProgress {
      nickname
      progress
      bookmark
    }
  }
}
```

**Returns:** `LeaderBoard` object with recent finishers and current progress rankings.

---

### readingplan

Retrieves a reading plan with progress.

```graphql
readingplan(token: String, slug: String): ReadingPlan
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |
| `slug` | `String` | Reading plan slug |

**Example:**
```graphql
query {
  readingplan(token: "user-token", slug: "year-plan") {
    guid
    slug
    title
    startdate
    duedate
    progress
    segments {
      guid
      period
      title
      duedate
      progress
    }
  }
}
```

**Returns:** `ReadingPlan` object with schedule and progress.

---

### readingplansegment

Retrieves a specific reading plan segment.

```graphql
readingplansegment(token: String, guid: String): ReadingPlanSegment
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |
| `guid` | `String` | Segment GUID |

**Example:**
```graphql
query {
  readingplansegment(token: "user-token", guid: "segment-guid") {
    guid
    period
    ref
    url
    title
    duedate
    progress
    sections {
      title
      slug
    }
  }
}
```

**Returns:** `ReadingPlanSegment` object with reading assignment details.

---

### botlist

Retrieves available study group bots.

```graphql
botlist: [Bot]
```

**Arguments:** None

**Example:**
```graphql
query {
  botlist {
    id
    name
    description
    picture
    enabled
  }
}
```

**Returns:** Array of `Bot` objects available for study groups.

---

### loadGroupsFromHash

Loads study groups from invitation hashes.

```graphql
loadGroupsFromHash(hash: [String]): [StudyGroup]
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `hash` | `[String]` | Array of invitation hash codes |

**Example:**
```graphql
query {
  loadGroupsFromHash(hash: ["invite-hash"]) {
    name
    member_count
    custom_type
    channel_url
    cover_url
    members {
      user_id
      nickname
    }
  }
}
```

**Returns:** Array of `StudyGroup` objects.

---

### studygrouphistory

Retrieves study history for a group.

```graphql
studygrouphistory(token: String, studyGroupID: String): StudyGroupHistory
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `token` | `String` | User authentication token |
| `studyGroupID` | `String` | Study group identifier |

**Example:**
```graphql
query {
  studygrouphistory(token: "user-token", studyGroupID: "group-id") {
    studyGroupID
    studyGroupName
    dates
    userHistories {
      user
      dates
      completed
    }
  }
}
```

**Returns:** `StudyGroupHistory` object with member progress over time.

---

## Messenger Queries (BomMessenger)

These queries handle the real-time messaging system for channels, messages, and users.

### messengerUser

Retrieves a user by their ID.

```graphql
messengerUser(userId: String!): MessengerUser
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `userId` | `String!` | User ID (required) |

**Example:**
```graphql
query {
  messengerUser(userId: "user-123") {
    user_id
    nickname
    profile_url
    metadata
    is_online
    last_seen_at
    is_bot
  }
}
```

**Returns:** `MessengerUser` object with profile information.

---

### messengerUsers

Retrieves multiple users by their IDs.

```graphql
messengerUsers(userIds: [String!]!): [MessengerUser!]!
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `userIds` | `[String!]!` | Array of user IDs (required) |

**Example:**
```graphql
query {
  messengerUsers(userIds: ["user-1", "user-2"]) {
    user_id
    nickname
    is_online
  }
}
```

**Returns:** Array of `MessengerUser` objects.

---

### messengerBots

Lists available bot users.

```graphql
messengerBots(lang: String): [MessengerUser!]!
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `lang` | `String` | Filter bots by language |

**Example:**
```graphql
query {
  messengerBots(lang: "en") {
    user_id
    nickname
    profile_url
    is_bot
  }
}
```

**Returns:** Array of `MessengerUser` objects that are bots.

---

### messengerChannel

Retrieves a channel by its URL.

```graphql
messengerChannel(channelUrl: String!): MessengerChannel
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `channelUrl` | `String!` | Channel URL identifier (required) |

**Example:**
```graphql
query {
  messengerChannel(channelUrl: "channel-abc") {
    channel_url
    name
    cover_url
    custom_type
    metadata
    members {
      user_id
      nickname
      role
    }
    member_count
    unread_message_count
    last_message {
      message
      created_at
    }
  }
}
```

**Returns:** `MessengerChannel` object with full channel details.

---

### messengerMyChannels

Retrieves channels for the current user.

```graphql
messengerMyChannels(userId: String!, customTypes: [String!], limit: Int): [MessengerChannel!]!
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `userId` | `String!` | User ID (required) |
| `customTypes` | `[String!]` | Filter by channel types |
| `limit` | `Int` | Maximum number of channels |

**Example:**
```graphql
query {
  messengerMyChannels(userId: "user-123", limit: 10) {
    channel_url
    name
    custom_type
    unread_message_count
    last_message {
      message
      user {
        nickname
      }
    }
  }
}
```

**Returns:** Array of `MessengerChannel` objects the user belongs to.

---

### messengerPublicChannels

Retrieves public channels for discovery.

```graphql
messengerPublicChannels(lang: String, customTypes: [String!], limit: Int): [MessengerChannel!]!
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `lang` | `String` | Filter by language |
| `customTypes` | `[String!]` | Filter by channel types |
| `limit` | `Int` | Maximum number of channels |

**Example:**
```graphql
query {
  messengerPublicChannels(lang: "en", limit: 20) {
    channel_url
    name
    cover_url
    member_count
    custom_type
  }
}
```

**Returns:** Array of public `MessengerChannel` objects.

---

### messengerMembers

Retrieves members of a channel.

```graphql
messengerMembers(channelUrl: String!): [MessengerMember!]!
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `channelUrl` | `String!` | Channel URL (required) |

**Example:**
```graphql
query {
  messengerMembers(channelUrl: "channel-abc") {
    user_id
    nickname
    profile_url
    role
    state
    is_online
    is_muted
  }
}
```

**Returns:** Array of `MessengerMember` objects with membership details.

---

### messengerMessages

Retrieves messages for a channel.

```graphql
messengerMessages(channelUrl: String!, before: String, limit: Int): [MessengerMessage!]!
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `channelUrl` | `String!` | Channel URL (required) |
| `before` | `String` | Message ID for pagination (get messages before this) |
| `limit` | `Int` | Maximum number of messages |

**Example:**
```graphql
query {
  messengerMessages(channelUrl: "channel-abc", limit: 50) {
    message_id
    message
    message_type
    user {
      nickname
      profile_url
    }
    created_at
    reactions {
      key
      user_ids
    }
    thread_info {
      reply_count
    }
  }
}
```

**Returns:** Array of `MessengerMessage` objects.

---

### messengerMessage

Retrieves a single message by ID.

```graphql
messengerMessage(channelUrl: String!, messageId: String!): MessengerMessage
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `channelUrl` | `String!` | Channel URL (required) |
| `messageId` | `String!` | Message ID (required) |

**Example:**
```graphql
query {
  messengerMessage(channelUrl: "channel-abc", messageId: "msg-123") {
    message_id
    message
    user {
      nickname
    }
    created_at
    updated_at
    reactions {
      key
      user_ids
    }
  }
}
```

**Returns:** `MessengerMessage` object.

---

### messengerThread

Retrieves replies to a message (thread).

```graphql
messengerThread(parentMessageId: String!): [MessengerMessage!]!
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `parentMessageId` | `String!` | Parent message ID (required) |

**Example:**
```graphql
query {
  messengerThread(parentMessageId: "msg-123") {
    message_id
    message
    user {
      nickname
    }
    created_at
  }
}
```

**Returns:** Array of `MessengerMessage` objects in the thread.

---

### messengerUnreadCount

Retrieves unread message count for a user in a channel.

```graphql
messengerUnreadCount(channelUrl: String!, userId: String!): Int!
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `channelUrl` | `String!` | Channel URL (required) |
| `userId` | `String!` | User ID (required) |

**Example:**
```graphql
query {
  messengerUnreadCount(channelUrl: "channel-abc", userId: "user-123")
}
```

**Returns:** Integer count of unread messages.
