import { mergeResults, structureResults } from "../BoMOnlineAPI";
import { prepareCacheObject } from "../Cache";
import { prepareQueries } from "../GraphQLQueries";

// Regression tests for two shared-cache-layer bugs surfaced by the Bible
// cross-reference reader (docs/bugs/2026-08-07-*):
//   1. mergeResults dropped warm-cached verses on a partial-warm batch → blank cells.
//   2. versehighlights rows were keyed by input POSITION, so a server that omits
//      pairs-without-highlights mis-keyed every later row → highlights on the
//      wrong verse (or missing).

describe("mergeResults — warm/fresh union (bug 1: blank verse cells)", () => {
  test("unions warm-cached verses with freshly fetched ones instead of dropping cached", () => {
    // fresh: array (verses is served as a raw array); cached: id-keyed object
    const structured = { verses: [{ verse_id: 2, text: "fresh two" }] };
    const found = { verses: { 5: { verse_id: 5, text: "cached five" } } };
    const merged = mergeResults(structured, found);
    const byId = {};
    for (const v of Object.values(merged.verses)) byId[v.verse_id] = v;
    expect(byId[2].text).toBe("fresh two");
    expect(byId[5].text).toBe("cached five"); // the pre-fix code dropped this → blank cell
  });

  test("returns structuredResults unchanged when nothing was cached", () => {
    const structured = { verses: [{ verse_id: 1 }] };
    expect(mergeResults(structured, {})).toBe(structured);
    expect(mergeResults(structured, undefined)).toBe(structured);
  });

  test("merges id-keyed object results (non-array types) by key", () => {
    const merged = mergeResults({ person: { a: 1 } }, { person: { b: 2 } });
    expect(merged.person).toEqual({ a: 1, b: 2 });
  });

  test("keeps fresh array as-is when there is no cached counterpart for that key", () => {
    const merged = mergeResults({ verses: [{ verse_id: 9 }] }, { person: { a: 1 } });
    expect(merged.verses).toEqual([{ verse_id: 9 }]);
    expect(merged.person).toEqual({ a: 1 });
  });
});

describe("structureResults — versehighlights keyed by row ids (bug 2: mis-keyed highlights)", () => {
  test("keys each row by its own bom/bible ids even when the server drops earlier pairs", () => {
    const pairs = [[100, 1], [200, 2], [300, 3]]; // pair [100,1] has NO highlight
    const queries = prepareQueries({ versehighlights: pairs });
    // server returns rows only for the pairs that HAVE highlights, in order
    const apiResults = {
      versehighlights: [
        { bom_verse_id: 200, bible_verse_id: 2, isQuote: true, bom_highlight: ["b"], bible_highlight: ["b"] },
        { bom_verse_id: 300, bible_verse_id: 3, isQuote: false, bom_highlight: ["c"], bible_highlight: ["c"] },
      ],
    };
    const structured = structureResults(queries, apiResults);
    // reader looks up highlights[`${bomVid},${bibleVid}`] — must hit the right pair
    expect(structured.versehighlights["200,2"]).toBeDefined();
    expect(structured.versehighlights["200,2"].bom_highlight).toEqual(["b"]);
    expect(structured.versehighlights["300,3"]).toBeDefined();
    expect(structured.versehighlights["300,3"].bom_highlight).toEqual(["c"]);
    // and must NOT be mis-keyed onto the dropped/first input pair
    expect(structured.versehighlights["100,1"]).toBeUndefined();
  });
});

describe("prepareCacheObject — versehighlights cache keys by row ids (bug 2: poisoned cache)", () => {
  test("stores each highlight under its own pair key, not the input position", () => {
    const pairs = [[100, 1], [200, 2]]; // pair [100,1] has NO highlight
    const queries = prepareQueries({ versehighlights: pairs });
    const apiResults = {
      versehighlights: [{ bom_verse_id: 200, bible_verse_id: 2, isQuote: true }],
    };
    const cacheObj = prepareCacheObject(queries, apiResults);
    expect(cacheObj["versehighlights.200,2"]).toBeDefined();
    expect(cacheObj["versehighlights.100,1"]).toBeUndefined();
  });
});
