# GraphQL Types

This document provides comprehensive documentation for all GraphQL types in the Book of Mormon Online API.

## Table of Contents

- [User Types](#user-types)
- [Content Types](#content-types)
- [Scripture Types](#scripture-types)
- [People and Places Types](#people-and-places-types)
- [Notes Types](#notes-types)
- [Community Types](#community-types)
- [Messenger Types](#messenger-types)
- [Input Types](#input-types)
- [Utility Types](#utility-types)

---

## User Types

### User

Represents a registered user of the platform.

| Field | Type | Description |
|-------|------|-------------|
| `user` | `String` | User identifier |
| `email` | `String` | User email address |
| `name` | `String` | Display name |
| `bookmark` | `String` | Current reading bookmark location |
| `zip` | `String` | ZIP code for location-based features |
| `complete` | `Float` | Completion percentage |
| `started` | `Float` | Timestamp when user started |
| `time` | `Float` | Total time spent |
| `finished` | `Float` | Timestamp when completed |
| `sessions` | `Int` | Number of study sessions |
| `social` | `Social` | Social login information |
| `progress` | `ProgressScore` | User progress data |
| `history` | `[UserHistory]` | Study history records |
| `networks` | `[Network]` | Connected social networks |

### SignIn

Response type for authentication operations.

| Field | Type | Description |
|-------|------|-------------|
| `isSuccess` | `Boolean` | Whether the sign-in was successful |
| `msg` | `String` | Status message |
| `user` | `User` | Authenticated user object |
| `social` | `Social` | Social login details |
| `profile_url` | `String` | Profile image URL |

### Social

Social login information.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | `String` | Social platform user ID |
| `nickname` | `String` | Social platform nickname |
| `profile_url` | `String` | Profile image URL |
| `access_token` | `String` | OAuth access token |

### Network

Connected social network information.

| Field | Type | Description |
|-------|------|-------------|
| `network` | `String` | Network name (e.g., "google", "facebook") |
| `social_id` | `String` | User ID on the social network |

### ProgressScore

User progress tracking data.

| Field | Type | Description |
|-------|------|-------------|
| `slug` | `String` | Content slug identifier |
| `count` | `Float` | Total count of items |
| `started` | `Float` | Number of started items |
| `completed` | `Float` | Number of completed items |
| `started_items` | `[Float]` | IDs of started items |
| `completed_items` | `[Float]` | IDs of completed items |
| `active_items` | `[Float]` | Currently active items |
| `summary` | `UserStudySummary` | Summary statistics |

### UserHistory

Historical study data for a user.

| Field | Type | Description |
|-------|------|-------------|
| `user` | `String` | User identifier |
| `dates` | `[String]` | Array of date strings |
| `completed` | `[Float]` | Completion values per date |

### StudyLog

Study session log data.

| Field | Type | Description |
|-------|------|-------------|
| `sessions` | `[UserSession]` | List of study sessions |
| `summary` | `UserStudySummary` | Summary of all sessions |

### UserSession

Individual study session record.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `Float` | Unix timestamp of session |
| `datetime` | `String` | Human-readable date/time |
| `duration` | `Float` | Session duration in seconds |
| `description` | `String` | Session description |
| `slug` | `String` | Content slug studied |

### UserStudySummary

Aggregated study statistics.

| Field | Type | Description |
|-------|------|-------------|
| `first` | `Float` | First session timestamp |
| `duration` | `Float` | Total study duration |
| `count` | `Float` | Total session count |
| `finished` | `[Float]` | Timestamps of completed items |

### UserDailyScore

Daily progress scores for charting.

| Field | Type | Description |
|-------|------|-------------|
| `dates` | `[String]` | Array of date strings |
| `progress` | `[Float]` | Progress values per date |

### LogResult

Result of a logging operation.

| Field | Type | Description |
|-------|------|-------------|
| `logged` | `Boolean` | Whether logging succeeded |
| `progress` | `ProgressScore` | Updated progress data |

---

## Content Types

### Division

Top-level content division (e.g., book of scripture).

| Field | Type | Description |
|-------|------|-------------|
| `page` | `String` | Page reference |
| `guid` | `String` | Unique identifier |
| `title` | `String` | Division title |
| `slug` | `String` | URL-friendly identifier |
| `link` | `String` | Navigation link |
| `description` | `String` | Division description |
| `weight` | `Int` | Sort order weight |
| `titlepage` | `Page` | Title page object |
| `pages` | `[Page]` | Child pages |
| `progress` | `ProgressScore` | Reading progress (requires token) |

### Page

Content page within a division.

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `title` | `String` | Page title |
| `ref` | `String` | Scripture reference |
| `counts` | `[Int]` | Content counts |
| `weight` | `Int` | Sort order weight |
| `parent` | `String` | Parent division slug |
| `slug` | `String` | URL-friendly identifier |
| `sections` | `[Section]` | Child sections |
| `text` | `[TextBlock]` | Text content blocks |
| `progress` | `ProgressScore` | Reading progress (requires token) |

### Section

Content section within a page.

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `title` | `String` | Section title |
| `weight` | `Int` | Sort order weight |
| `parent` | `String` | Parent page slug |
| `slug` | `String` | URL-friendly identifier |
| `page` | `Page` | Parent page object |
| `ref` | `String` | Scripture reference |
| `badge` | `String` | Display badge text |
| `rows` | `[Row]` | Content rows |
| `sectionText` | `[TextBlock]` | Text blocks in section |
| `ambient` | `String` | Ambient audio reference |

### Row

Content row within a section.

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `type` | `String` | Row type identifier |
| `weight` | `Int` | Sort order weight |
| `parent` | `String` | Parent section slug |
| `narration` | `Narration` | Narration content |
| `connection` | `Conn` | Connection content |
| `capsulation` | `Caps` | Capsulation content |

### TextBlock

Primary text content unit.

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `parent` | `String` | Parent identifier |
| `parentSlug` | `String` | Parent slug |
| `slug` | `String` | URL-friendly identifier |
| `heading` | `String` | Block heading |
| `content` | `String` | Text content |
| `chrono` | `String` | Chronological reference |
| `duration` | `Float` | Audio duration |
| `quotes` | `[TextBlock]` | Quoted text blocks |
| `status` | `String` | Reading status (requires token) |
| `parent_page` | `Page` | Parent page object |
| `parent_section` | `Section` | Parent section object |
| `narration` | `Narration` | Associated narration |
| `imgIds` | `[String]` | Associated image IDs |
| `comIds` | `[String]` | Associated commentary IDs |
| `imgs` | `[Image]` | Image objects |
| `coms` | `[Commentary]` | Commentary objects |
| `notes` | `[Note]` | Note objects |
| `note_count` | `Int` | Number of notes |
| `people` | `[People]` | Associated people |
| `places` | `[Place]` | Associated places |
| `refs` | `[Reference]` | Cross-references |
| `link` | `Int` | Link reference |
| `next` | `[NarrativePath]` | Next navigation paths |

### Note

Scripture study note.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` | Unique identifier |
| `title` | `String` | Note title |
| `text` | `String` | Note content |

### Reference

Cross-reference to other scriptures.

| Field | Type | Description |
|-------|------|-------------|
| `verse_id` | `Int` | Verse identifier |
| `ref` | `String` | Reference string |
| `significant` | `Int` | Significance level |
| `type` | `String` | Reference type |

### NarrativePath

Navigation path through narrative content.

| Field | Type | Description |
|-------|------|-------------|
| `nextclass` | `String` | CSS class for styling |
| `slug` | `String` | Target slug |
| `text` | `String` | Link text |
| `page` | `String` | Target page |
| `section` | `String` | Target section |
| `narration` | `String` | Narration reference |

### ReadBlock

Block of content for reading view.

| Field | Type | Description |
|-------|------|-------------|
| `ref` | `String` | Scripture reference |
| `verse_id` | `Int` | Starting verse ID |
| `verse_count` | `Int` | Number of verses |
| `next_ref` | `String` | Next reading reference |
| `prev_ref` | `String` | Previous reading reference |
| `sections` | `[ReadSection]` | Reading sections |

### ReadSection

Section within a reading block.

| Field | Type | Description |
|-------|------|-------------|
| `ref` | `String` | Scripture reference |
| `heading` | `String` | Section heading |
| `meta` | `[SectionMeta]` | Metadata key-value pairs |
| `verse_id` | `Int` | Starting verse ID |
| `verse_count` | `Int` | Number of verses |
| `blocks` | `[ReadUnit]` | Reading units |
| `extra` | `[ReadExtra]` | Extra content |

### SectionMeta

Metadata for a section.

| Field | Type | Description |
|-------|------|-------------|
| `verse_id` | `Int` | Associated verse ID |
| `key` | `String` | Metadata key |
| `value` | `String` | Metadata value |

### ReadUnit

Unit of reading content (typically a speaker block).

| Field | Type | Description |
|-------|------|-------------|
| `ref` | `String` | Scripture reference |
| `verse_id` | `Int` | Starting verse ID |
| `verse_count` | `Int` | Number of verses |
| `person_slug` | `String` | Speaker identifier |
| `voice` | `String` | Voice/speaker type |
| `lines` | `[ReadLine]` | Individual lines |

### ReadLine

Individual line of text in reading view.

| Field | Type | Description |
|-------|------|-------------|
| `ref` | `String` | Scripture reference |
| `verse_num` | `Int` | Verse number |
| `verse_id` | `Int` | Verse identifier |
| `text` | `String` | Line text content |
| `format` | `String` | Text formatting |

### ReadExtra

Extra content associated with a reading section.

| Field | Type | Description |
|-------|------|-------------|
| `images` | `[Int]` | Image IDs |
| `commentary` | `[Int]` | Commentary IDs |
| `notes` | `[Int]` | Note IDs |
| `fax` | `[String]` | Facsimile slugs |
| `chiasmus` | `[String]` | Chiasmus IDs |
| `people` | `[String]` | People slugs |
| `places` | `[String]` | Place slugs |
| `references` | `[String]` | Reference strings |
| `maps` | `[String]` | Map slugs |
| `events` | `[String]` | Event IDs |

### Narration

Narrative content element.

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `parent` | `String` | Parent identifier |
| `description` | `String` | Narration description |
| `text` | `TextBlock` | Associated text block |
| `timeline` | `Event` | Timeline event |
| `section` | `Section` | Parent section |

### Conn

Connection element linking content sections.

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `text` | `String` | Connection text |
| `type` | `String` | Connection type |
| `link` | `String` | Target link |
| `slug` | `String` | URL-friendly identifier |
| `parent` | `String` | Parent identifier |
| `isPage` | `Boolean` | Whether link is to a page |

### Caps

Capsulation element (summary/overview).

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `description` | `String` | Capsulation description |
| `reference` | `String` | Scripture reference |
| `link` | `String` | Target link |
| `slug` | `String` | URL-friendly identifier |
| `parent` | `String` | Parent identifier |

---

## Scripture Types

### Scripture

Individual scripture verse.

| Field | Type | Description |
|-------|------|-------------|
| `verse_id` | `Int` | Unique verse identifier |
| `heading` | `String` | Verse or section heading |
| `reference` | `String` | Full reference string |
| `version` | `String` | Scripture version |
| `book` | `String` | Book name |
| `chapter` | `Int` | Chapter number |
| `verse` | `Int` | Verse number |
| `text` | `String` | Verse text content |

### ScriptureResults

Results from a scripture query.

| Field | Type | Description |
|-------|------|-------------|
| `ref` | `String` | Queried reference |
| `passages` | `[Passage]` | Passage objects |
| `verses` | `[Scripture]` | Individual verses |

### Passage

Group of verses forming a passage.

| Field | Type | Description |
|-------|------|-------------|
| `reference` | `String` | Passage reference |
| `heading` | `String` | Passage heading |
| `meta` | `[SectionMeta]` | Passage metadata |
| `verses` | `[Scripture]` | Verses in passage |

### ScriptureHighlights

Highlight comparisons between scriptures.

| Field | Type | Description |
|-------|------|-------------|
| `bom_verse_id` | `Int` | Book of Mormon verse ID |
| `bible_verse_id` | `Int` | Bible verse ID |
| `bom_highlight` | `[String]` | Highlighted text in BoM |
| `bible_highlight` | `[String]` | Highlighted text in Bible |
| `isQuote` | `Boolean` | Whether this is a direct quote |

---

## People and Places Types

### People

Person or group mentioned in scriptures.

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `slug` | `String` | URL-friendly identifier |
| `name` | `String` | Person name |
| `title` | `String` | Title or role |
| `classification` | `String` | Person classification |
| `identification` | `String` | Identification details |
| `unit` | `String` | Associated unit |
| `date` | `String` | Time period |
| `description` | `String` | Person description |
| `index` | `[Index]` | Scripture index entries |
| `relations` | `[Relation]` | Relationships to others |

### Relation

Relationship between people.

| Field | Type | Description |
|-------|------|-------------|
| `relation` | `String` | Relationship type |
| `person` | `People` | Related person |

### PeopleNode

Node in people network visualization.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Person name |
| `slug` | `String` | URL-friendly identifier |
| `title` | `String` | Person title |
| `group` | `String` | Group classification |
| `cluster` | `String` | Cluster identifier |
| `classif` | `String` | Classification |
| `radius` | `Float` | Node radius |
| `degree` | `Float` | Connection degree |
| `fill` | `String` | Fill color |
| `stroke` | `String` | Stroke color |
| `charge` | `Float` | Force charge value |
| `guid` | `String` | Unique identifier |
| `unit` | `String` | Associated unit |

### PeopleLink

Link between nodes in people network.

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `source` | `Int` | Source node index |
| `target` | `Int` | Target node index |
| `value` | `Float` | Link value/weight |
| `strokeWidth` | `Float` | Line width |
| `strokeColor` | `String` | Line color |
| `charge` | `Float` | Force charge value |

### PeopleNetwork

Complete people relationship network.

| Field | Type | Description |
|-------|------|-------------|
| `nodes` | `[PeopleNode]` | Network nodes |
| `links` | `[PeopleLink]` | Network links |

### Place

Geographic location in scriptures.

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `slug` | `String` | URL-friendly identifier |
| `name` | `String` | Place name |
| `aka` | `String` | Alternate names |
| `info` | `String` | Additional information |
| `label` | `String` | Display label |
| `icon` | `String` | Map icon |
| `occupants` | `String` | Known occupants |
| `type` | `String` | Place type |
| `location` | `String` | Location description |
| `description` | `String` | Place description |
| `w` | `Int` | Width (for rendering) |
| `h` | `Int` | Height (for rendering) |
| `ax` | `Int` | Anchor X position |
| `ay` | `Int` | Anchor Y position |
| `minZoom` | `Int` | Minimum zoom level |
| `maxZoom` | `Int` | Maximum zoom level |
| `lat` | `Float` | Latitude coordinate |
| `lng` | `Float` | Longitude coordinate |
| `index` | `[Index]` | Scripture index entries |
| `maps` | `[Map]` | Associated maps |

### Map

Map configuration for geographic visualization.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Map name |
| `slug` | `String` | URL-friendly identifier |
| `desc` | `String` | Map description |
| `group` | `String` | Map group |
| `centerx` | `Float` | Center X coordinate |
| `centery` | `Float` | Center Y coordinate |
| `minzoom` | `Int` | Minimum zoom level |
| `maxzoom` | `Int` | Maximum zoom level |
| `zoom` | `Int` | Default zoom level |
| `tiles` | `Boolean` | Whether map uses tiles |
| `places` | `[Place]` | Places on this map |

### Index

Scripture index entry.

| Field | Type | Description |
|-------|------|-------------|
| `pkey` | `String` | Primary key |
| `type` | `String` | Index type |
| `slug` | `String` | URL-friendly identifier |
| `ref` | `String` | Scripture reference |
| `verse_id` | `String` | Starting verse ID |
| `verse_id_end` | `String` | Ending verse ID |
| `text` | `String` | Index text |

### MapStory

Narrative journey across map locations.

| Field | Type | Description |
|-------|------|-------------|
| `slug` | `String` | URL-friendly identifier |
| `guid` | `String` | Unique identifier |
| `title` | `String` | Story title |
| `description` | `String` | Story description |
| `moves` | `[MapMove]` | Journey movements |

### MapMove

Individual movement in a map story.

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `seq` | `Int` | Sequence order |
| `start` | `String` | Starting location slug |
| `startPlace` | `Place` | Starting place object |
| `end` | `String` | Ending location slug |
| `endPlace` | `Place` | Ending place object |
| `travelers` | `String` | Who traveled |
| `people` | `[People]` | Traveler objects |
| `duration` | `String` | Travel duration |
| `description` | `String` | Movement description |
| `verse_ids` | `[Int]` | Associated verse IDs |

### Event

Timeline event.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` | Unique identifier |
| `date` | `String` | Event date |
| `slug` | `String` | URL-friendly identifier |
| `file` | `String` | Associated file |
| `x` | `Float` | X position on timeline |
| `y` | `Float` | Y position on timeline |
| `w` | `Float` | Width |
| `h` | `Float` | Height |
| `o` | `Float` | Opacity |
| `z` | `Float` | Z-index |
| `p` | `Boolean` | Primary event flag |
| `reference` | `String` | Scripture reference |
| `link` | `String` | Navigation link |
| `text` | `TextBlock` | Associated text block |
| `narr` | `String` | Narration reference |
| `html` | `String` | HTML content |
| `heading` | `String` | Event heading |

---

## Notes Types

### Commentary

Scholarly commentary on scripture passages.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` | Unique identifier |
| `verse_id` | `String` | Associated verse ID |
| `verse_range` | `String` | Verse range covered |
| `reference` | `String` | Scripture reference |
| `location` | `TextBlock` | Location in text |
| `publication` | `Source` | Source publication |
| `title` | `String` | Commentary title |
| `text` | `String` | Full commentary text |
| `preview` | `String` | Preview text |
| `slug` | `String` | URL-friendly identifier |

### Source

Publication source for commentary.

| Field | Type | Description |
|-------|------|-------------|
| `source_id` | `String` | Unique identifier |
| `source_rating` | `String` | Quality rating |
| `source_title` | `String` | Publication title |
| `source_name` | `String` | Author/source name |
| `source_short` | `String` | Short name |
| `source_slug` | `String` | URL-friendly identifier |
| `source_url` | `String` | External URL |
| `source_description` | `String` | Source description |
| `source_publisher` | `String` | Publisher name |
| `source_year` | `Int` | Publication year |
| `excerpt` | `String` | Sample excerpt |

### Fax

Facsimile document reference.

| Field | Type | Description |
|-------|------|-------------|
| `hide` | `String` | Hidden flag |
| `slug` | `String` | URL-friendly identifier |
| `code` | `String` | Document code |
| `title` | `String` | Document title |
| `pages` | `Int` | Number of pages |
| `pgoffset` | `Int` | Page offset |
| `pgfirstVerse` | `Int` | First verse on page |
| `index` | `[String]` | Page index |
| `info` | `String` | Document info |
| `com` | `Int` | Commentary count |
| `fax` | `Int` | Facsimile number |
| `format` | `String` | Document format |
| `indexRef` | `String` | Index reference |
| `bgcolor` | `String` | Background color |

### FaxIndex

Index for facsimile pages.

| Field | Type | Description |
|-------|------|-------------|
| `slug` | `String` | Document slug |
| `pages` | `[[Int]]` | Page-to-verse mappings |

### Image

Image associated with scripture content.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` | Unique identifier |
| `file` | `String` | Filename |
| `title` | `String` | Image title |
| `artist` | `String` | Artist name |
| `link` | `String` | External link |
| `width` | `Int` | Image width |
| `height` | `Int` | Image height |
| `location` | `TextBlock` | Location in text |

### Chiasmus

Chiastic structure in scripture.

| Field | Type | Description |
|-------|------|-------------|
| `chiasmus_id` | `String` | Unique identifier |
| `reference` | `String` | Scripture reference |
| `scheme` | `String` | Chiastic scheme pattern |
| `title` | `String` | Chiasmus title |
| `lines` | `[ChiasmusLine]` | Lines in the structure |

### ChiasmusLine

Individual line in a chiastic structure.

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `line_key` | `String` | Line identifier (A, B, C, etc.) |
| `line_text` | `String` | Line text content |
| `highlights` | `String` | Highlighted portions |
| `label` | `String` | Line label |

### HistoricalDocument

Historical document related to scripture.

| Field | Type | Description |
|-------|------|-------------|
| `seq` | `Int` | Sequence order |
| `id` | `Int` | Unique identifier |
| `slug` | `String` | URL-friendly identifier |
| `year` | `Int` | Document year |
| `date` | `String` | Document date |
| `link` | `String` | External link |
| `type` | `String` | Document type |
| `source` | `String` | Document source |
| `author` | `String` | Author name |
| `document` | `String` | Document name |
| `pages` | `Int` | Number of pages |
| `citation` | `String` | Citation text |
| `teaser` | `String` | Preview text |
| `transcript` | `String` | Full transcript |
| `aspect` | `Float` | Aspect ratio |

### PassageNotes

Aggregated notes for a scripture passage.

| Field | Type | Description |
|-------|------|-------------|
| `commentary` | `[Commentary]` | Commentaries |
| `sources` | `[Source]` | Publication sources |
| `chiasmus` | `[Chiasmus]` | Chiastic structures |
| `people` | `[People]` | People mentioned |
| `places` | `[Place]` | Places mentioned |
| `images` | `[Image]` | Related images |
| `notes` | `[Note]` | Study notes |
| `fax` | `[Fax]` | Facsimiles |
| `mapstory` | `[MapStory]` | Map stories |
| `refs` | `[Reference]` | Cross-references |

---

## Community Types

### StudyGroup

Study group for collaborative reading.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Group name |
| `member_count` | `Float` | Number of members |
| `custom_type` | `String` | Group type identifier |
| `channel_url` | `String` | Chat channel URL |
| `created_at` | `Float` | Creation timestamp |
| `cover_url` | `String` | Cover image URL |
| `max_length_message` | `Float` | Max message length |
| `data` | `String` | Custom data JSON |
| `messages` | `[Message]` | Recent messages |
| `members` | `[SendbirdUser]` | Group members |

### StudyGroupHistory

Historical data for a study group.

| Field | Type | Description |
|-------|------|-------------|
| `studyGroupID` | `String` | Group identifier |
| `studyGroupName` | `String` | Group name |
| `dates` | `[String]` | Date range |
| `userHistories` | `[UserHistory]` | Member histories |

### Message

Chat message in a study group.

| Field | Type | Description |
|-------|------|-------------|
| `message_survival_seconds` | `Float` | Message lifespan |
| `custom_type` | `String` | Message type |
| `mentioned_users` | `[SendbirdUser]` | Mentioned users |
| `updated_at` | `Float` | Update timestamp |
| `is_op_msg` | `Boolean` | Is operator message |
| `is_removed` | `Boolean` | Is deleted |
| `user` | `SendbirdUser` | Message author |
| `message` | `String` | Message content |
| `data` | `String` | Custom data JSON |
| `message_retention_hour` | `Float` | Retention period |
| `silent` | `Boolean` | Is silent message |
| `type` | `String` | Message type |
| `created_at` | `Float` | Creation timestamp |
| `channel_type` | `String` | Channel type |
| `mention_type` | `String` | Mention type |
| `channel_url` | `String` | Channel URL |
| `message_id` | `Float` | Message identifier |

### SendbirdUser

User in the Sendbird chat system.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | `String` | User identifier |
| `is_active` | `Boolean` | Is account active |
| `joined_ts` | `Boolean` | Join timestamp |
| `state` | `String` | User state |
| `role` | `String` | User role |
| `is_online` | `Boolean` | Is currently online |
| `require_auth_for_profile_image` | `Boolean` | Auth required for image |
| `last_seen_at` | `Boolean` | Last seen timestamp |
| `nickname` | `String` | Display name |
| `profile_url` | `String` | Profile image URL |
| `metadata` | `SendbirdUserMetadata` | User metadata |

### SendbirdUserMetadata

Metadata for Sendbird user.

| Field | Type | Description |
|-------|------|-------------|
| `summary` | `String` | User summary |
| `bookmark` | `String` | Current bookmark |

### JoinedGroup

Result of joining a study group.

| Field | Type | Description |
|-------|------|-------------|
| `isSuccess` | `Boolean` | Join succeeded |
| `msg` | `String` | Status message |
| `channel` | `String` | Channel URL |
| `user` | `String` | User ID |

### HomeFeed

Home page feed content.

| Field | Type | Description |
|-------|------|-------------|
| `groups` | `[HomeGroup]` | User's groups |
| `feed` | `[HomeFeedItem]` | Feed items |

### HomeFeedItem

Individual item in the home feed.

| Field | Type | Description |
|-------|------|-------------|
| `channel_url` | `String` | Source channel URL |
| `id` | `Float` | Item identifier |
| `timestamp` | `Float` | Post timestamp |
| `msg` | `String` | Message content |
| `user` | `HomeUser` | Post author |
| `mentioned_users` | `[HomeUser]` | Mentioned users |
| `likes` | `[String]` | User IDs who liked |
| `replycount` | `Int` | Number of replies |
| `repliers` | `[HomeUser]` | Users who replied |
| `link` | `ContentLink` | Associated content link |
| `highlights` | `[String]` | Highlighted text |

### HomeUser

User profile for home feed display.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | `String` | User identifier |
| `nickname` | `String` | Display name |
| `picture` | `String` | Profile picture URL |
| `progress` | `Float` | Reading progress |
| `finished` | `[Float]` | Completion timestamps |
| `lastseen` | `Float` | Last seen timestamp |
| `laststudied` | `String` | Last studied content |
| `bookmark` | `String` | Current bookmark |
| `public` | `Boolean` | Is profile public |
| `isBot` | `Boolean` | Is bot account |

### ContentLink

Link to scripture content.

| Field | Type | Description |
|-------|------|-------------|
| `key` | `String` | Link type |
| `val` | `String` | Link target |

### HomeGroup

Study group for home display.

| Field | Type | Description |
|-------|------|-------------|
| `grouping` | `String` | Group category |
| `url` | `String` | Channel URL |
| `name` | `String` | Group name |
| `description` | `String` | Group description |
| `privacy` | `String` | Privacy setting |
| `picture` | `String` | Cover image URL |
| `latest` | `HomeFeedItem` | Latest activity |
| `requests` | `[String]` | Pending join requests |
| `members` | `[HomeUser]` | Group members |

### LeaderBoard

Leaderboard display data.

| Field | Type | Description |
|-------|------|-------------|
| `recentFinishers` | `[HomeUser]` | Recently completed users |
| `currentProgress` | `[HomeUser]` | Top progress users |

### Bot

Bot user configuration.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` | Bot identifier |
| `name` | `String` | Bot name |
| `description` | `String` | Bot description |
| `picture` | `String` | Bot avatar URL |
| `enabled` | `Boolean` | Is bot enabled |

### ReadingPlan

Scheduled reading plan.

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `slug` | `String` | URL-friendly identifier |
| `title` | `String` | Plan title |
| `startdate` | `String` | Start date |
| `duedate` | `String` | Due date |
| `progress` | `Float` | Completion progress |
| `segments` | `[ReadingPlanSegment]` | Plan segments |

### ReadingPlanSegment

Segment of a reading plan.

| Field | Type | Description |
|-------|------|-------------|
| `guid` | `String` | Unique identifier |
| `period` | `String` | Time period |
| `ref` | `String` | Scripture reference |
| `url` | `String` | Navigation URL |
| `title` | `String` | Segment title |
| `duedate` | `String` | Due date |
| `progress` | `Float` | Completion progress |
| `start` | `Int` | Starting verse ID |
| `end` | `Int` | Ending verse ID |
| `sections` | `[Section]` | Content sections |

---

## Messenger Types

The Messenger types are part of the custom messaging backend (Phase 2: Sendbird Migration).

### MessengerUser

User in the messenger system.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | `String!` | User identifier (required) |
| `nickname` | `String` | Display name |
| `profile_url` | `String` | Profile image URL |
| `metadata` | `JSON` | Custom metadata |
| `is_online` | `Boolean` | Is currently online |
| `last_seen_at` | `Float` | Last seen timestamp |
| `is_bot` | `Boolean` | Is bot account |

### MessengerMember

Channel member with role information.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | `String!` | User identifier (required) |
| `nickname` | `String` | Display name |
| `profile_url` | `String` | Profile image URL |
| `metadata` | `JSON` | Custom metadata |
| `is_online` | `Boolean` | Is currently online |
| `role` | `String!` | Member role (required) |
| `state` | `String!` | Member state (required) |
| `is_muted` | `Boolean` | Is muted |

### MessengerChannel

Chat channel.

| Field | Type | Description |
|-------|------|-------------|
| `channel_url` | `String!` | Channel URL (required) |
| `name` | `String!` | Channel name (required) |
| `cover_url` | `String` | Cover image URL |
| `custom_type` | `String!` | Channel type (required) |
| `data` | `String` | Custom data |
| `metadata` | `JSON` | Channel metadata |
| `members` | `[MessengerMember!]` | Channel members |
| `member_count` | `Int` | Number of members |
| `unread_message_count` | `Int` | Unread messages |
| `last_message` | `MessengerMessage` | Most recent message |
| `created_at` | `Float` | Creation timestamp |
| `lang` | `String` | Channel language |

### MessengerMessage

Chat message.

| Field | Type | Description |
|-------|------|-------------|
| `message_id` | `String!` | Message ID (required) |
| `channel_url` | `String!` | Channel URL (required) |
| `user` | `MessengerUser` | Message author |
| `message_type` | `String!` | Message type (required) |
| `message` | `String!` | Message content (required) |
| `custom_type` | `String` | Custom message type |
| `data` | `String` | Custom data |
| `parent_message_id` | `String` | Parent message for threads |
| `thread_info` | `MessengerThreadInfo` | Thread information |
| `reactions` | `[MessengerReaction!]` | Message reactions |
| `created_at` | `Float!` | Creation timestamp (required) |
| `updated_at` | `Float` | Update timestamp |

### MessengerThreadInfo

Thread metadata.

| Field | Type | Description |
|-------|------|-------------|
| `reply_count` | `Int!` | Number of replies (required) |
| `most_replies` | `[MessengerUser!]` | Top repliers |

### MessengerReaction

Reaction on a message.

| Field | Type | Description |
|-------|------|-------------|
| `key` | `String!` | Reaction key (required) |
| `user_ids` | `[String!]!` | Users who reacted (required) |

### MessengerHighlight

Highlighted text in a message.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String!` | Highlight ID (required) |
| `message_id` | `String!` | Parent message ID (required) |
| `ordinal` | `Int!` | Order position (required) |
| `text` | `String!` | Highlighted text (required) |

---

## Input Types

### QueueInput

Input for queuing content items.

| Field | Type | Description |
|-------|------|-------------|
| `slug` | `String` | Content slug |
| `plan` | `String` | Reading plan slug |
| `reference` | `String` | Scripture reference |
| `blocks` | `[Int!]` | Block IDs to queue |

### MessengerLinkInput

Input for content links in messages.

| Field | Type | Description |
|-------|------|-------------|
| `type` | `String!` | Link type (required) |
| `target` | `String!` | Link target (required) |
| `aux` | `String` | Auxiliary data |

### MessengerPostMessageInput

Input for posting a message.

| Field | Type | Description |
|-------|------|-------------|
| `channelUrl` | `String!` | Channel URL (required) |
| `userId` | `String!` | Sender user ID (required) |
| `message` | `String!` | Message content (required) |
| `messageType` | `String` | Message type |
| `customType` | `String` | Custom type |
| `link` | `MessengerLinkInput` | Content link |
| `highlights` | `[String!]` | Highlighted text |
| `metadata` | `JSON` | Custom metadata |
| `parentMessageId` | `String` | Parent for thread reply |

### MessengerCreateChannelInput

Input for creating a channel.

| Field | Type | Description |
|-------|------|-------------|
| `channelUrl` | `String` | Custom channel URL |
| `name` | `String!` | Channel name (required) |
| `customType` | `String!` | Channel type (required) |
| `userIds` | `[String!]!` | Member user IDs (required) |
| `operatorIds` | `[String!]!` | Operator user IDs (required) |
| `coverUrl` | `String` | Cover image URL |
| `description` | `String` | Channel description |
| `metadata` | `JSON` | Custom metadata |
| `lang` | `String` | Channel language |

---

## Utility Types

### SearchResult

Result from content search.

| Field | Type | Description |
|-------|------|-------------|
| `reference` | `String` | Scripture reference |
| `text` | `String` | Matching text |
| `section` | `String` | Section slug |
| `page` | `String` | Page slug |
| `narration` | `String` | Narration slug |
| `slug` | `String` | Content slug |
| `speaker` | `String` | Speaker name |
| `voice` | `String` | Voice type |
| `lang` | `String` | Language code |

### Label

Key-value label pair.

| Field | Type | Description |
|-------|------|-------------|
| `key` | `String` | Label key |
| `val` | `String` | Label value |

### Menu

Navigation menu item.

| Field | Type | Description |
|-------|------|-------------|
| `label` | `String` | Menu label |
| `link` | `String` | Navigation link |

### Book

Book with chapters.

| Field | Type | Description |
|-------|------|-------------|
| `book` | `String` | Book name |
| `chapters` | `[Int]` | Chapter numbers |

### Markdown

Markdown content document.

| Field | Type | Description |
|-------|------|-------------|
| `slug` | `String` | Document slug |
| `markdown` | `String` | Markdown content |

### Shortlinks

Short URL mapping.

| Field | Type | Description |
|-------|------|-------------|
| `hash` | `String` | Short hash |
| `string` | `String` | Full URL string |

### Test

System test results.

| Field | Type | Description |
|-------|------|-------------|
| `db` | `String` | Database status |
| `http` | `String` | HTTP test result |
| `http2` | `String` | HTTP/2 test result |

---

## Scalar Types

### JSON

The API includes a custom `JSON` scalar type for flexible metadata storage. This allows arbitrary JSON objects to be stored and retrieved without strict typing.

Used in:
- `MessengerUser.metadata`
- `MessengerMember.metadata`
- `MessengerChannel.metadata`
- `MessengerPostMessageInput.metadata`
- `MessengerCreateChannelInput.metadata`
