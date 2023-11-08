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
  verses: [Scripture]
}

type Scripture {
  book: String
  chapter: Int
  verse: Int
  text: String
}

type SearchResult {
  reference: String
  text: String
  section: String
  page: String
  narration: String
  slug: String
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