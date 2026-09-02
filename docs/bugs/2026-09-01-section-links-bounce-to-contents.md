# Section links bounce to /contents

**Date:** 2026-09-01
**Area:** `frontend/webapp/src/views/Page/Page.js`
**Reported:** Table-of-contents links "don't work" — URL flashes to the destination then returns to `/contents`. Page-level links (`/lehites`) work; section-level links (`/lehites/lehis-dream`) fail.

## Symptom
Clicking a section link (2-segment slug) in the TOC briefly navigates to e.g. `/lehites/lehis-dream`, then immediately redirects back to `/contents`. No JS console error. Page-level slugs load fine. Reproduced deterministically against the dev backend via `localhost:8201`.

## Root cause
Three layers compound:

1. **Backend** — the `page` GraphQL query only resolves *page-level* slugs. For a section-level slug the resolver returns nothing and the `page` field is **omitted entirely** from the response (observed: `{"data":{"pageprogress":[...]}}` for `page(slug:["lehites/lehis-dream"])`).

2. **`BoMOnlineAPI.js` `structureResults`** maps GraphQL results **positionally** (`apiResults[resultKeys[i]]`). With the `page` field absent, the remaining keys shift up, so the `pageprogress` row is written into `response.page["lehites/lehis-dream"]`. That key ends up holding a truthy object (`{count,completed,started}`) with **no `.sections`**.

3. **`Page.js` `getPageDataFromAPI`** had a parent-fallback (retry with the parent page slug, then let the scroll-spy focus the section) guarded by `if (!response.page[index])`. Because the mis-mapped object is *truthy*, that block was skipped and flow fell through to `if (!response.page[index].sections) return history.push("/contents")` — the bounce. The fallback was effectively dead for exactly the section-slug case it was meant to handle.

## Fix
`Page.js` — trigger the parent-retry whenever the resolved page lacks `.sections`, not only when it is falsy:

```js
if (!response.page[index] || !response.page[index].sections) {
  const parentSlug = pageSlug.split("/").slice(0, -1).join("/");
  if (parentSlug) return getPageDataFromAPI(parentSlug, textId);
  index = Object.keys(response.page).filter((a) => RegExp(pageSlug).test(a)).shift();
}
if (!response.page[index]?.sections) {
  return history.push("/contents");
}
```

`match.url` still carries the section leaf across the recursive call, so the scroll-spy focuses the section after the parent page loads. Removed the now-unused `keys` variable.

## Verification (playwright against localhost:8201)
- `/lehites/lehis-dream` → stays put, loads "Lehites in Jerusalem and Arabia" (15 sections), section `lehites/lehis-dream` scrolled into view (`scrollY 4876`, in viewport).
- `/lehites` → still loads normally.
- `/totally-bogus-slug` → still redirects to `/contents` (correct fallback for genuinely invalid slugs).
- No page errors.

## Follow-up fix — root-caused at the transform layer
The positional mapping was the real footgun, so it was fixed at the source:

- Added `responseKeyOf(queryString)` in `Cache.js` — parses a query's GraphQL response key (an explicit `alias: field` wins, else the bare field name, after skipping any leading `query`/`mutation` keyword).
- `structureResults` (`BoMOnlineAPI.js`) and `prepareCacheObject` (`Cache.js`) now look results up **by name** (`apiResults[responseKeyOf(query.query)]`) instead of by position (`apiResults[Object.keys(apiResults)[i]]`). An omitted or reordered field can no longer shift every subsequent field onto the wrong query. `prepareCacheObject`'s `useCache` membership check is now name-based too.
- `responseKeyOf` lives in `Cache.js` (a lower module) to avoid a `Cache ⇄ GraphQLQueries` import cycle (GraphQLQueries already imports `normalizeVal` from Cache).

With this, `response.page[sectionSlug]` is correctly `null` (not a mis-mapped `pageprogress` object) even before the `Page.js` guard runs — the two fixes are complementary.

Regression tests added to `src/models/__tests__/apiCacheMerge.test.js` (`responseKeyOf` parsing + `structureResults` no-shift-on-omitted-field). Full suite: 187 passed. Browser smoke test across `/contents`, `/lehites`, `/lehites/lehis-dream`, `/home`, `/` — all load with no errors.

### Still open (backend, not done here)
- Optionally have the backend `page` resolver return `page: []` rather than omitting the field entirely. Not required now that the client maps by name, but it would make the response spec-compliant (GraphQL should return the requested field as `null`/`[]`, not drop it).
