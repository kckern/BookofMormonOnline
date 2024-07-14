import { gql } from 'apollo-server-express';

export default gql`
# -----------------------------------------------
# QUERIES
# -----------------------------------------------
extend type Query {
  fax(filter: String): [Fax]
  image(id: [String]): [Image]
  commentary(id: [String]): [Commentary]
  sources(id: [String]): [Source]
  publications: [Source]
  history(slug: [String]): [HistoricalDocument]
  chiasmus(id: [String]): [Chiasmus]
}




  # -----------------------------------------------
  # TYPES
  # -----------------------------------------------
  

  type Chiasmus {
    chiasmus_id: String
    reference: String
    scheme: String
    title: String
    lines: [ChiasmusLine]
  }
  type ChiasmusLine {
    guid: String
    line_key: String
    line_text: String
    highlights: String
    label: String
  }
  
  type HistoricalDocument {
    seq: Int
    id: Int
    slug: String
    year: Int
    date: String
    link: String
    type: String
    source: String
    author: String
    document: String
    pages: Int
    citation: String
    teaser: String
    transcript: String
    aspect: Float
  }
  
  
  type Commentary {
    id: String
    verse_id: String
    verse_range: String
    reference: String
    location: TextBlock
    publication: Source
    title: String
    text: String
    preview: String
    slug: String
}
  
type Source {
  source_id: String
  source_rating: String
  source_title: String
  source_name: String
  source_short: String
  source_slug: String
  source_url: String
  source_description: String
  source_publisher: String
  source_year: Int
  excerpt: String
}
  type Fax {
    hide: String
    slug: String
    code: String
    title: String
    pages: Int
    pgoffset: Int
    index: [String]
    info: String
    com: Int
    fax: Int
  }
  type Image {
    id: String
    file: String
    title: String
    artist: String
    link: String
    width: Int
    height: Int
    location: TextBlock
  }
`;
