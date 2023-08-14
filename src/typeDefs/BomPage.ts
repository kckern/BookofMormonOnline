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
  }

  # -----------------------------------------------
  # TYPES
  # -----------------------------------------------
  
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
    rows: [Row]
    sectionText: [TextBlock]
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
    link: Int
  }

`;
