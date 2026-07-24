import {
  WITNESSES,
  SIGLA_ORDER,
  CHANGES,
  CHANGE_CODES,
  BARE_CHANGE,
  isSiglum,
  decodeMarker,
  describeChange,
} from "../apparatus";

/** FNV-1a over UTF-16 code units — stable, dependency-free, order-sensitive. */
const hashOf = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

test("covers exactly the 22 sigla, in chronological order", () => {
  expect(SIGLA_ORDER.join("")).toBe("01ABCDEFGHIJKLMNOPQRST");
  expect(Object.keys(WITNESSES).sort()).toEqual([...SIGLA_ORDER].sort());
});

test("printed-edition labels run forward in time", () => {
  // 0 and 1 are the manuscripts; every other label starts with its year.
  const years = SIGLA_ORDER.slice(2).map((s) => {
    const year = /^(\d{4})/.exec(WITNESSES[s].label);
    expect(year).not.toBeNull();
    return Number(year[1]);
  });
  expect(years).toHaveLength(20);
  years.forEach((year, i) => {
    if (i > 0) expect(year).toBeGreaterThanOrEqual(years[i - 1]);
  });
});

test("every witness has a short label and a provenance paragraph", () => {
  for (const s of SIGLA_ORDER) {
    expect(WITNESSES[s].label).toBeTruthy();
    expect(WITNESSES[s].provenance.length).toBeGreaterThan(20);
  }
});

test("no witness label or provenance paragraph is duplicated", () => {
  const labels = SIGLA_ORDER.map((s) => WITNESSES[s].label);
  const provenances = SIGLA_ORDER.map((s) => WITNESSES[s].provenance);
  expect(new Set(labels).size).toBe(SIGLA_ORDER.length);
  expect(new Set(provenances).size).toBe(SIGLA_ORDER.length);
});

test("isSiglum accepts known letters and rejects everything else", () => {
  expect(isSiglum("A")).toBe(true);
  expect(isSiglum("0")).toBe(true);
  expect(isSiglum("U")).toBe(false); // in [A-Z] but not a witness
  expect(isSiglum("a")).toBe(false);
  expect(isSiglum("")).toBe(false);
  expect(isSiglum("constructor")).toBe(false); // inherited, not own
  // no coercion: "0" is a siglum, the number 0 is not
  expect(isSiglum(0)).toBe(false);
  expect(isSiglum(1)).toBe(false);
  expect(isSiglum(null)).toBe(false);
  expect(isSiglum(undefined)).toBe(false);
});

test("the 22 citations still read exactly as transcribed from ATV.js", () => {
  // A failure here means the labels or provenance paragraphs drifted, OR someone
  // deliberately re-transcribed them. Re-verify against the `key` object in
  // ATV.js character by character before updating this constant — these strings
  // are bibliographic citation, not prose to be improved.
  const digest = SIGLA_ORDER.map((s) => WITNESSES[s].label + WITNESSES[s].provenance).join(" ");
  expect(digest).toHaveLength(4035);
  expect(hashOf(digest)).toBe("1a9f8d70");
});

test("the correction-code table reads exactly as specified", () => {
  expect(CHANGES).toEqual({
    "+": "change w/ more ink",
    "–": "change w/ less ink",
    "%": "change w/ erasure of the original ink",
    p: "correction is in pencil",
    b: "correction is in blue ink",
    jg: "corrected by John Gilbert",
    js: "corrected by Joseph Smith",
    "+–": "correction was heavy in ink flow but the second part was weak",
    "%+": "erasure, then a heavier correction",
    "++": "two successive heavy corrections",
    "?": "change is uncertain",
    "%?": "change w/ erasure, uncertain",
    "p–": "correction in pencil, less ink",
    "–?": "change w/ less ink, uncertain",
    "+?": "change w/ more ink, uncertain",
  });
  expect(CHANGE_CODES).toEqual(["jg", "js", "+–", "%+", "++", "%?", "p–", "–?", "+?", "+", "–", "%", "p", "b", "?"]);
  expect(BARE_CHANGE).toBe("change");
});

test("correction codes include the multi-character forms found in the data", () => {
  expect(CHANGES["js"]).toMatch(/Joseph Smith/);
  expect(CHANGES["jg"]).toMatch(/John Gilbert/);
  expect(CHANGES["%"]).toMatch(/erasure/);
});

test("every code attested in the corpus resolves to a description", () => {
  const attested = ["js", "jg", "+", "%", "p", "–", "+–", "%+", "++", "?", "%?", "p–", "–?", "+?"];
  for (const code of attested) {
    expect(typeof CHANGES[code]).toBe("string");
    expect(CHANGES[code].length).toBeGreaterThan(0);
  }
});

test("the three compound codes found late in the corpus resolve to a label", () => {
  // p–, –?, +? — one occurrence each; unglossed they would ship the exact
  // P7 defect (a correction with no description) this refactor exists to prevent.
  expect(describeChange("p–")).toBeTruthy();
  expect(describeChange("–?")).toBeTruthy();
  expect(describeChange("+?")).toBeTruthy();
});

test("every correction code maps to a non-empty description", () => {
  const codes = Object.keys(CHANGES);
  expect(codes.length).toBeGreaterThan(0);
  for (const code of codes) {
    expect(typeof CHANGES[code]).toBe("string");
    expect(CHANGES[code].trim().length).toBeGreaterThan(0);
  }
});

test("a bare marker has its own description and no empty-string key", () => {
  // "" would match at every position in a longest-match tokeniser (task 5).
  expect(Object.keys(CHANGES)).not.toContain("");
  expect(BARE_CHANGE).toBeTruthy();
});

test("decodeMarker turns corpus entities into the characters CHANGES is keyed on", () => {
  expect(decodeMarker("&gt;&ndash;")).toBe(">–");
  expect(decodeMarker("&gt;+&ndash;")).toBe(">+–");
  expect(decodeMarker("&gt;js")).toBe(">js");
  expect(decodeMarker(">js")).toBe(">js"); // already literal, unchanged
  expect(CHANGES[decodeMarker("&gt;&ndash;").slice(1)]).toBeTruthy();
  expect(CHANGES[decodeMarker("&gt;+&ndash;").slice(1)]).toBeTruthy();
});

test("decodeMarker leaves content entities alone", () => {
  // &amp; is the manuscript's ampersand (312 occurrences, always content, never
  // a code); task 6 requires it to reach the renderer still encoded.
  expect(decodeMarker("&amp;")).toBe("&amp;");
  expect(decodeMarker("a b &amp; c")).toBe("a b &amp; c");
  for (const entity of ["&hellip;", "&mdash;", "&rsquo;", "&#120034;", "&#9312;"]) {
    expect(decodeMarker(entity)).toBe(entity);
  }
});

test("describeChange covers bare, known and unknown codes", () => {
  expect(describeChange("js")).toBe(CHANGES["js"]);
  expect(describeChange("%?")).toBe(CHANGES["%?"]);
  expect(describeChange(null)).toBe(BARE_CHANGE); // bare ">"
  expect(describeChange(undefined)).toBe(BARE_CHANGE);
  expect(describeChange("")).toBe(BARE_CHANGE);
  // unknown must be null, not BARE_CHANGE — callers surface it, never mislabel it
  expect(describeChange("zz")).toBeNull();
  expect(describeChange("J")).toBeNull(); // a siglum, not a code
  expect(describeChange("constructor")).toBeNull(); // inherited property, not a code
  expect(describeChange("toString")).toBeNull();
});

test("the exported tables are frozen", () => {
  expect(Object.isFrozen(WITNESSES)).toBe(true);
  expect(Object.isFrozen(CHANGES)).toBe(true);
  expect(Object.isFrozen(SIGLA_ORDER)).toBe(true);
  expect(Array.isArray(CHANGE_CODES)).toBe(true); // isFrozen(undefined) is true
  expect(Object.isFrozen(CHANGE_CODES)).toBe(true);
});

test("witness entries are frozen too, so the citations cannot be rewritten", () => {
  const before = WITNESSES.A.label;
  expect(Object.isFrozen(WITNESSES.A)).toBe(true);
  try {
    WITNESSES.A.label = "MUTATED"; // throws under strict mode, no-ops otherwise
  } catch (e) {
    // expected in strict mode
  }
  expect(WITNESSES.A.label).toBe(before);
  for (const s of SIGLA_ORDER) expect(Object.isFrozen(WITNESSES[s])).toBe(true);
});

test("CHANGE_CODES is ordered longest-first for longest-match tokenising", () => {
  CHANGE_CODES.forEach((code, i) => {
    if (i > 0) expect(code.length).toBeLessThanOrEqual(CHANGE_CODES[i - 1].length);
  });
  // the specific collisions that would truncate a real code
  expect(CHANGE_CODES.indexOf("+–")).toBeLessThan(CHANGE_CODES.indexOf("+"));
  expect(CHANGE_CODES.indexOf("%+")).toBeLessThan(CHANGE_CODES.indexOf("%"));
  expect(CHANGE_CODES.indexOf("%?")).toBeLessThan(CHANGE_CODES.indexOf("%"));
});
