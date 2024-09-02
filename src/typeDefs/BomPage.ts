import { gql } from 'apollo-server-express';

export default gql`
# -----------------------------------------------
# Queries
# -----------------------------------------------

  extend type Query {
    division(slug: [String]): [Division]
    page(slug: [String]): [Page]
    section(slug: [String]): [Section]
    text(slug: [String]): [TextBlock]
    lookup(ref: [String]): [TextBlock]
    queue(token: String, items: [QueueInput]): [TextBlock]
    read(token: String, ref: String): ReadBlock
  }

  # -----------------------------------------------
  # TYPES
  # -----------------------------------------------
  
  type ReadBlock {
  ref: String
  verse_id: Int
  verse_count: Int
  next_ref: String
  prev_ref: String
  sections: [ReadSection]
  }

  type ReadSection {
    ref: String
    heading: String
    verse_id: Int
    verse_count: Int
    blocks: [ReadUnit]
  }

  type ReadUnit {
    ref: String
    verse_id: Int
    verse_count: Int
    person_slug: String
    voice: String
    lines: [ReadLine]
  }
  type ReadLine {
    ref: String
    verse_num: Int
    verse_id: Int
    text: String
    format: String
  }


    


  type Division {
    page: String
    guid: String
    title: String
    slug: String
    link: String
    description: String
    weight: Int
    titlepage: Page
    pages: [Page]
    progress(token: String): ProgressScore
  }
  type Page {
    guid: String
    title: String
    ref: String
    counts: [Int]
    weight: Int
    parent: String
    slug: String
    sections: [Section]
    text: [TextBlock]
    progress(token: String): ProgressScore
  }
  type Section {
    guid: String
    title: String
    weight: Int
    parent: String
    slug: String
    page: Page
    ref: String
    badge: String
    rows: [Row]
    sectionText: [TextBlock]
    ambient: String
  }
  type Row {
    guid: String
    type: String
    weight: Int
    parent: String
    narration: Narration
    connection: Conn
    capsulation: Caps
  }
  type Narration {
    guid: String
    parent: String
    description: String
    text: TextBlock
    timeline: Event
    section: Section
  }


  type Event {
    id: String
    date: String
    slug: String
    file: String
    x: Float
    y: Float
    w: Float
    h: Float
    o: Float
    z: Float
    p: Boolean
    reference: String
    link: String
    text: TextBlock
    narr: String
    html: String
    heading: String
}


input QueueInput {
  slug: String
  plan: String
  reference: String
  blocks: [Int!]
}

  type Conn {
    guid: String
    text: String
    type: String
    link: String
    slug: String
    parent: String
    isPage: Boolean
  }
  type Caps {
    guid: String
    description: String
    reference: String
    link: String
    slug: String
    parent: String
  }
  
  type TextBlock {
    guid: String
    parent: String
    parentSlug: String
    slug: String
    heading: String
    content: String
    chrono: String
    duration: Float
    quotes: [TextBlock]
    status(token: String): String
    parent_page: Page
    parent_section: Section
    narration: Narration
    imgIds: [String]
    comIds: [String]
    imgs: [Image]
    coms: [Commentary]
    notes: [Note]
    note_count: Int
    people: [People]
    places: [Place]
    refs: [Reference]
    link: Int
    next: [NarrativePath]
  }

  type Note {
    id: String
    title: String
    text: String
  }

  type Reference {
    verse_id: Int
    ref: String
    significant: Int
    type: String
  }

  type NarrativePath {
    nextclass: String
    slug: String
    text: String
    page: String
    section: String
    narration: String
  }

`;
