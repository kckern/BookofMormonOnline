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

```graphql
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
```
