//Shortlink, search, lookup



// Login, password CRUD, progress history, log

import { gql } from 'apollo-server-express';

export default gql`
# -----------------------------------------------
# Queries
# -----------------------------------------------

extend type Query {
    labels: [Label]
    menu(slug: [String]): [Menu]
    books(seed: String): [Book]
    search(query: String): [SearchResult]
    shortlink(hash: [String]): Shortlinks
    markdown(slug: [String]): [Markdown]
    scripture(ref: String, verse_ids: [Int]): ScriptureResults
    verses(verse_ids: [Int]): [Scripture]
    versehighlights(verse_pairs: [[Int]]): [ScriptureHighlights]
  }

extend type Mutation {
    shortlink(string: String): Shortlinks
  }

# -----------------------------------------------
# TYPES
# -----------------------------------------------

type Label {
  key: String
  val: String
}
type ScriptureResults {
  ref: String
  passages: [Passage]
  verses: [Scripture]
}

type Passage {
  reference: String
  heading: String
  verses: [Scripture]
}

type Scripture {
  verse_id: Int
  heading: String
  reference: String
  book: String
  chapter: Int
  verse: Int
  text: String
}
type ScriptureHighlights {
  bom_verse_id: Int
  bible_verse_id: Int
  bom_highlight: [String]
  bible_highlight: [String]
  isQuote: Boolean
}

type SearchResult {
  reference: String
  text: String
  section: String
  page: String
  narration: String
  slug: String
  speaker: String
  }

  type Markdown {
    slug: String
    markdown: String
  }

  type Shortlinks {
    hash: String
    string: String
  }

  type Menu {
    label: String
    link: String
  }


  type Book {
    book: String
    chapters: [Int]
  }

`