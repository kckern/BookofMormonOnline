# BoMOnlineAPI client reference

The frontend's single entry point for talking to the backend. Lives at
`frontend/webapp/src/models/BoMOnlineAPI.js`. It batches GraphQL queries,
transparently caches results in IndexedDB, and returns a results object
keyed by operation name.

> **Scope of this doc.** Behavior of the client wrapper. For the GraphQL
> schema itself (fields, return types, mutations), see `docs/api/`.

## Imports

```js
import BoMOnlineAPI, { assetUrl, ApiBaseUrl, fbPixel, exitBeacon } from "../../models/BoMOnlineAPI";
```

| Export | Type | Purpose |
|---|---|---|
| `BoMOnlineAPI` (default) | `async (input, options?) => results` | The call. |
| `assetUrl` | `string` | `"https://media.bookofmormon.online"`. CDN base for `/people/<slug>` etc. |
| `ApiBaseUrl` | `string` | API base, derived from `window.location`. Empty string when running on `localhost:3000` (CRA proxy). |
| `fbPixel` | `string` | Facebook Pixel ID. |
| `exitBeacon(appController)` | `(appController) => void` | Fires a `closetab` GraphQL mutation via `navigator.sendBeacon` on tab close. |

## Calling shape

```js
const result = await BoMOnlineAPI(input, options);
```

### `input` — what to fetch

An object whose **keys are operation names** and whose values are operation
arguments. Multiple keys batch into a single GraphQL request:

```js
const data = await BoMOnlineAPI({
    read: "1 Nephi 1",                      // single string arg
    person: ["nephi", "lehi"],              // array of ids
    passagenotes_a: [123, 124, 125],        // arbitrary alias key
});
```

- **The handler is matched by key, not by alias.** Aliasing for the same
  operation in one batch (e.g. fetching passage notes for multiple sections
  at once) is supported by `GraphQLQueries.js`'s `prepareQueries()` only when
  the same handler is used under different keys — see "Aliased keys" below.
- If a key has no matching handler in `queries` (the table in
  `frontend/webapp/src/models/GraphQLQueries.js`), it is silently dropped.
- Argument shape varies by operation. Inspect the relevant handler in
  `GraphQLQueries.js` to see what it expects.

### `options` — optional second argument

| Field | Type | Default | Effect |
|---|---|---|---|
| `useCache` | `boolean \| string[]` | `true` | `false` → bypass the IndexedDB cache for both reads and writes. Array of operation names → only those operations get written back to the cache. |
| `token` | `string` | `undefined` | Forwarded to handlers that take a token (auth-gated queries/mutations). |

Other fields (e.g. `signal`) are accepted by callers but **not currently
honored** — see "Known gaps" below.

### `result` — what comes back

An object keyed by **operation name** (the input key, normalized through
each handler's `type`). Each value is either:

- The raw payload, when the operation returned a single value or a list
  without a per-item key (e.g. `lookup`, `search`, `verses`, `mapstories`,
  `verse_highlights`).
- A **dictionary keyed by the operation's `key` field** (typically `id` or
  the input value), when the operation returns multiple keyed records.

Example:

```js
const { read, person } = await BoMOnlineAPI({
    read: "1 Nephi 1",
    person: ["nephi", "lehi"],
});

read["1 Nephi 1"];   // → { ref, verse_id, sections: [...], ... }
person["nephi"];     // → { name, image, ... }
person["lehi"];      // → { name, image, ... }
```

If the network call succeeds but GraphQL returned no `data`, the function
resolves to `{ error: <raw response> }` instead of throwing. Callers should
defensively check `!data.error` before reading fields.

If `axios` times out (45 s) the function resolves to `{ data: null }` —
**not** rejected. Other axios errors reject the promise.

## Caching

- Backed by IndexedDB, keyed by `<operation>.<value>` per item.
- `getCache(input)` runs first; only the **missing** items become a network
  request.
- New results are merged into the cache via `setCache` after the call.
- The `read` and `page` operations have hard-coded freshness checks (e.g.
  `page` cache misses are forced when `!item.sections`).
- Pass `useCache: false` to bypass entirely. Pass an array
  (`useCache: ["read"]`) to write back only specific operations.

## Endpoint resolution

```text
ApiBaseUrl = currentProtocol + "//" + currentDomain + (port ≠ 80,443 ? ":" + port : "")
           = "" if running on :3000 (let CRA proxy handle it)
```

Requests go to `${ApiBaseUrl}/${lang}` (where `lang` is from
`determineLanguage()`), POST JSON `{ query: <graphql> }`. There is no
separate REST routing in this client — everything is GraphQL.

The dev server in this repo runs the frontend on **:8200** with
`REACT_APP_LOCAL_BACKEND=true`, which makes the frontend hit the local
backend on :5000. Production uses `bom.kckern.net`.

## Aliased keys (multi-fetch)

To fetch the same operation multiple times in one batch with different
arguments, use distinct top-level keys whose **values land in the same
handler**. Example pattern from `Read.js` (passage notes per section):

```js
const apiRequest = {};
sections.forEach((section, i) => {
    apiRequest[`passagenotes_${i}`] = section.verseIds;
});
const data = await BoMOnlineAPI(apiRequest);
// data.passagenotes_0, data.passagenotes_1, ...
```

This works because `prepareQueries()` iterates input keys but emits each as
a separate GraphQL field — provided the alias key is itself recognized as a
handler. (For `passagenotes`, the handler accepts the aliased keys via the
field name; verify in `GraphQLQueries.js` before relying on this pattern
for an operation you haven't used this way before.)

## Operations index

The full list lives in `frontend/webapp/src/models/GraphQLQueries.js`,
~75 entries covering scripture (`read`, `scripture`, `verses`, `lookup`,
`search`), people/places (`person`, `places`, `personList`, `placeList`),
content (`page`, `commentary`, `image`, `chiasm`, `chiasmus`, `markdown`),
auth (`signin`, `signup`, `signout`, `socialsignin`, `tokenSignIn`,
`changePassword`, `editProfile`, `uploadProfileImage`), feeds
(`homefeed`, `homethread`, `homegroups`, `imageInFeed`, `commentaryInFeed`,
`textInFeed`, `sectionInFeed`), study tools (`studylog`, `userprogress`,
`userdailyscores`, `pageprogress`, `pageinfoprogress`, `readingplan`,
`readingplansegment`, `leaderboard`), maps/timeline (`map`, `maplist`,
`mapstories`, `imageLocations`, `commentaryLocations`, `timeline`),
groups (`joinGroup`, `joinOpenGroup`, `requestToJoinGroup`,
`withdrawRequest`, `loadGroupsFromHash`, `requestedUsers`,
`processRequest`), bots (`botlist`, `addBot`, `removeBot`), facsimiles
(`fax`, `faxIndex`), publishing (`publications`, `setShortLink`,
`shortLink`), passage notes (`passagenotes`), and queue/health
(`queue`, `queuestatus`, `sourceUsage`, `about`, `labels`, `log`).

To see exact arguments and the GraphQL selection set for any operation,
search `GraphQLQueries.js` for the operation name.

## Known gaps

- **`options.signal` is not propagated** to the underlying axios call.
  Callers in `views/Read/Read.js` pass `{ signal }` to
  `BoMOnlineAPI({ read: ... }, { signal })` for use with
  `useConcurrentOperations`'s `abortPrevious: true`, but the wrapper
  ignores it — concurrency control happens *around* the call (state guards,
  `signal.aborted` checks) rather than inside it. The in-flight request
  itself runs to completion. Fixable by threading `signal` into the axios
  config.
- **Errors are inconsistent.** Most failures resolve with
  `{ error: ... }`, but `ECONNABORTED` resolves with `{ data: null }`, and
  any other axios error rejects. Callers must handle all three.
- **`exitBeacon`** sends to `ApiBaseUrl` directly (no `/<lang>` suffix), so
  the closetab mutation lands on whatever route handles the bare base URL.
  Verify before relying on it for a non-default-language session.
- **Silent dropping of unknown keys.** `prepareQueries()` skips any input
  key without a matching handler. Typos won't error — they just return
  nothing for that key.

## Related files

- `frontend/webapp/src/models/GraphQLQueries.js` — operation handlers and the
  `prepareQueries` dispatcher.
- `frontend/webapp/src/models/Cache.js` — IndexedDB cache (`getCache`,
  `setCache`, `prepareCacheObject`, `normalizeVal`).
- `frontend/webapp/src/models/Utils.js` — `determineLanguage()` for the
  per-language route suffix.
- `docs/api/` — GraphQL schema reference (queries.md, mutations.md,
  types.md).
