# Green-Field Backend — GraphQL Surface

What the green-field backend (`/backend`, port 5006, GraphQL-only) serves today, and
where each field lives. The schema contract is the legacy SDL carried over verbatim
(`backend/schema/*.graphql`); this catalogs which root fields are **implemented** behind
it. Gate for reads: `TARGET=next npm run test:gql`. Mutations are manual-test
(`docs/reference/backend-mutation-porting-guide.md`).

Legend — **Verify:** `suite` = byte/shape-verified by the regression suite vs prod-captured
baselines; `manual` = stateful write, smoke-tested only. **Truth:** `prod` = baseline from
prod; `next` = re-pinned to the green-field backend (approved contract change); `local` =
prodStale, baseline from local legacy.

## Anonymous reads (36 — all suite-green, en+ko)

### Core — `src/graphql/resolvers.ts` + repositories/loaders
| Query | Returns | Verify | Truth | Notes |
|---|---|---|---|---|
| `labels` | `[Label]` | suite | prod | UI labels (excl. `peoplerel`); translated. |
| `division` (contents/divisionShell) | `[Division]` | suite | prod | TOC: divisions → pages → sections; `counts`. |
| `page` | `[Page]` | suite | **next** | Deepest tree: sections→rows→narration/connection/capsulation→text→quotes/people/places/refs/notes. Quote order fixed vs legacy. |

### scripture — `resolvers/scripture.ts`
| `scripture` (ref or verse_ids) · `verses` | `ScriptureResults` · `[Scripture]` | suite | prod | `verses` keeps heading markers (`｢360｣`), `scripture` strips them — two legacy paths. |

### scriptureread — `resolvers/scriptureread.ts`
| `read` · `lookup` · `versehighlights` | `ReadResult` · `[LookupResult]` · `[ScriptureHighlights]` | suite | prod | `read` builds sections/blocks/lines; Korean `verse_num` is non-integer (errors pinned). |

### scriptureextras — `resolvers/scriptureextras.ts`
| `chiasmus`/`chiasm` · `passagenotes` (+`_N` aliases) | `[Chiasmus]` · `PassageNotes` | suite | prod / **local** | chiasmus: no ORDER BY (InnoDB natural order). passagenotes is prodStale. |

### peopleplaces — `resolvers/peopleplaces.ts`
| `person`/`personList` · `place`/`placeList` | `[People]` · `[Place]` | suite | **next** | `*List` are GraphQL aliases of the same roots. Re-pinned: legacy's relations/index order is a join-buffer artifact. people translations key on **slug**, places on **guid**. |

### maps — `resolvers/maps.ts`
| `maplist`/`map` · `mapstories` | `[Map]` · `[MapStory]` | suite | **next** | `map.places` order re-pinned (optimizer-path artifact). |

### objects — `resolvers/objects.ts`
| `object`/`objectList` | `[ObjectType]` | suite | **local** | prodStale (absent from deployed prod schema). `Index` resolver shared with peopleplaces. |

### media — `resolvers/media.ts`
| `image`/`imageInFeed`/`imageLocations` · `commentary`/`commentaryInFeed`/`commentaryLocations` · `publications` | `[Image]` · `[Commentary]` · `[Publication]` | suite | prod | `location` text headings NOT translated (legacy omitted the include → `SKIP_HEADING_TRANSLATION`). ko publications filter by `source_lang`. |

### mediamisc — `resolvers/mediamisc.ts`
| `fax`/`faxIndex` · `timeline` · `markdown` | `[Fax]` · `[Timeline]` · `[Markdown]` | suite | prod | `fax.filter` is a mode selector (`pdf` vs else). `about` is absent in both schemas (vacuous baseline). |

### feedsmisc — `resolvers/feedsmisc.ts`
| `text` (textInFeed) · `section` (sectionInFeed) | `[TextBlock]` · `[Section]` | suite | prod | feed-card selections; reuse core TextBlock/Section field resolvers. |

### searchhist — `resolvers/searchhist.ts`
| `search` · `shortlink` (query) · `history` | `[SearchResult]` · `Shortlinks` · `[HistoricalDocument]` | suite | prod / **local** | search is **shape** tier (LIKE result order churns). history is prodStale; translation keys on `id`; `transcript` only on slug-form. |

## User mutations (9 — manual-test, sandbox-write-guarded)

`signin`/`tokensignin` are **Query** (frontend sends them as query ops); the rest are
**Mutation**. All writes go through `runWrite()` (sandbox suppression). Suite note: under
`TARGET=next` (sandbox) these shape-verify, and most pass as a bonus.

| Field | Map | Module | Verify | Notes |
|---|---|---|---|---|
| `signin` | Query | userauth | suite✓ | bcrypt+MD5 dual-verify, organic rehash, token upsert, log relink. |
| `tokensignin` | Query | userauth | suite✓ | user by token; `User.social` → null (shim only on `SignIn.social`). |
| `signup` | Mutation | userauth | manual (sandboxSkip) | `cleanUsername` (email-prefix wins), bcrypt, dup → error code msg. |
| `signout` | Mutation | userauth | suite✓ | deletes token row. |
| `editProfile` | Mutation | userprofile | suite✓ | updates name/email/zip; returns User. |
| `changePassword` | Mutation | userprofile | suite✓ | bcrypt; rejects same-as-current. |
| `uploadProfileImage` | Mutation | userprofile | manual (sandboxSkip) | **S3/sharp write STUBBED** — returns true, no persist. See follow-ups. |
| `log` | Mutation | useractivity | suite✓ | inserts bom_log, scores recent blocks, returns progress. |
| `shortlink` (setShortLink) | Mutation | useractivity | suite✓ | find-or-create by string. |

`User` type field resolvers (scalars, `social`, `networks`, `progress`) live in
`userauth.ts`. `genUserAvatar` (exact dicebear palette algorithm) + `md5`/`cleanUsername`
in `src/auth/identity.ts`; password hashing in `src/auth/password.ts`; sandbox writes in
`src/data/writes.ts`; sendbird social shim in `src/auth/sendbirdShim.ts`.

## NOT yet built (future slices)

- **Authenticated reads:** `studylog`, `userdailyscores`, `userprogress`,
  `divisionProgress`, `divisionProgressDetails`, `pageprogress`, `pageinfoprogress`,
  `readingplan`, `readingplansegment`, `queue`, `queuestatus`, `sourceUsage`, `leaderboard`,
  plus `User.history`/`User.networks` detail and the full progress scorer (summary + items).
  The duplicated lightweight scorers (`userauth.scoreProgressForUser`,
  `useractivity.computeUserProgress`) should consolidate into core here.
- **Parked (Sendbird/OAuth):** `socialsignin`, `joinGroup`/`joinOpenGroup`/
  `requestToJoinGroup`/`withdrawRequest`, `processRequest`, `addBot`/`removeBot`,
  `homegroups`/`homefeed`/`homethread`, `requestedUsers`, `loadGroupsFromHash`, `botlist`.
- **Non-GraphQL REST** (`/coords`, `/translate`, `/mapmarker`, …): out of scope —
  `docs/reference/non-graphql-endpoints.md`.

## Architecture pointers

- Per-domain modules merged by `mergeResolverMaps` (resolvers) and a flat loader registry
  (`context.ts`). Selection-driven: a field resolver + DataLoader per tree edge — nothing
  fetches unless selected; one batched query per edge per request.
- Porting method/gotchas: `docs/reference/backend-resolver-porting-guide.md` (reads),
  `backend-mutation-porting-guide.md` (mutations).
- Contract-change bug docs: `docs/bugs/2026-06-09-*` (quote/places order, page weights,
  lang leak, etc.).
