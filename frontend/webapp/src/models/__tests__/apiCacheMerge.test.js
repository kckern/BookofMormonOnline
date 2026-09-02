import { mergeResults, structureResults } from "../BoMOnlineAPI";
import { prepareCacheObject, responseKeyOf } from "../Cache";
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

// Regression tests for docs/bugs/2026-09-01-section-links-bounce-to-contents.md:
// the backend omits a field entirely when a query resolves nothing (e.g. `page`
// for a section-level slug). structureResults/prepareCacheObject used to map
// results by POSITION, so an omitted field shifted every later field onto the
// wrong query — the pageprogress row landed on `page`, giving a truthy but
// section-less object that made Page.js redirect to /contents.
describe("responseKeyOf — GraphQL response key from a query string", () => {
  test("bare field name", () => {
    expect(responseKeyOf(`division (slug: ["x"]) { slug }`)).toBe("division");
  });
  test("alias wins over the underlying field", () => {
    expect(responseKeyOf(`personList: person (slug: []) { slug }`)).toBe("personList");
  });
  test("tolerates leading whitespace", () => {
    expect(responseKeyOf(`  pageprogress(token:"t") { count }`)).toBe("pageprogress");
  });
  test("named mutation", () => {
    expect(responseKeyOf(`mutation shortlink{shortlink(string:"a"){hash}}`)).toBe("shortlink");
  });
  test("anonymous mutation", () => {
    expect(responseKeyOf(`mutation { requestPasswordReset(email: "a") }`)).toBe("requestPasswordReset");
  });
});

describe("structureResults — name-based mapping (section links bounce)", () => {
  test("does not shift a later field onto a query whose field the server omitted", () => {
    const queries = [
      {
        type: "page",
        key: "slug",
        val: ["lehites/lehis-dream"],
        query: `page (slug: "lehites/lehis-dream") { slug sections { slug } }`,
      },
      {
        type: "pageprogress",
        key: 0,
        val: { token: "t", slug: ["lehites/lehis-dream"] },
        query: ` pageprogress(token:"t",slug:["lehites/lehis-dream"]) { count completed started }`,
      },
    ];
    // Server resolves nothing for the section-level slug → the `page` field is
    // ABSENT from the response (only pageprogress comes back).
    const apiResults = { pageprogress: [{ count: 0, completed: 0, started: 0 }] };
    const structured = structureResults(queries, apiResults);
    // page must be null for the missing slug — NOT the mis-mapped pageprogress
    // object (which is what triggered the redirect to /contents).
    expect(structured.page["lehites/lehis-dream"]).toBeNull();
    expect(structured.pageprogress).toBeDefined();
    expect(structured.pageprogress.count).toBe(0);
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
