/**
 * Reference vocabularies for Royal Skousen's Analysis of Textual Variants
 * apparatus: the witnesses cited by siglum, and the in-document correction
 * codes. Data only — parsing lives in parseATV.js.
 */

/** Freeze a table and every entry in it — the provenance strings are citations. */
const deepFreezeEntries = (table) => {
  for (const entry of Object.values(table)) Object.freeze(entry);
  return Object.freeze(table);
};

/**
 * The 22 witnesses to the Book of Mormon text, in chronological order, as used
 * by Royal Skousen's apparatus. `label` is the short citation form; `provenance`
 * is the full description (unused before this refactor — see spec P7).
 */
export const WITNESSES = deepFreezeEntries({
  "0": { label: "Original Manuscript (𝒪)", provenance: "The original manuscript, 1828–1829 (28 percent extant, not counting the lost 116 pages); written down by Oliver Cowdery and other scribes from dictation by Joseph Smith" },
  "1": { label: "Printer’s Manuscript (𝓟)", provenance: "The printer’s manuscript, August 1829–March 1830; a handwritten copy of the original manuscript" },
  A: { label: "1830", provenance: "The first edition, published in Palmyra, New York; printed by E. B. Grandin, with typesetting by John Gilbert; set from the printer’s manuscript except for Helaman 13– Mormon 9, which was set from the original manuscript" },
  B: { label: "1837", provenance: "The second edition, published in Kirtland, Ohio; printed by the Church, with major editing by Joseph Smith" },
  C: { label: "1840", provenance: "The third edition, published in Nauvoo, Illinois; typeset, stereotyped, and printed in Cincinnati, Ohio, by Shepard and Stearns, with minor editing by Joseph Smith (including a few restored phrases from the original manuscript); various impressions printed with stereotyped plates in Nauvoo (up through 1842)" },
  D: { label: "1841", provenance: "The first British edition, published in Liverpool, England; printed by J. Tompkins for Brigham Young, Heber C. Kimball, and Parley P. Pratt; this edition is basically a retypesetting of the 1837 edition" },
  E: { label: "1849", provenance: "The second British edition, published in Liverpool, England; printed by Richard James for Orson Pratt, with minor editing by Pratt" },
  F: { label: "1852", provenance: "The third British edition, published in Liverpool, England; typeset by William Bowden for Franklin D. Richards, with printing from stereotyped plates; the second impression from the stereotyped plates (also in 1852) includes a considerable number of changes based on the 1840 edition; the stereotyped plates were later taken to Utah and used to print additional issues of this edition (up through 1877)" },
  G: { label: "1858W", provenance: "A private edition published in New York City by James O. Wright (also issued in 1860 with a new introduction by Zadoc Brook); this edition is based on the 1840 edition and was used by RLDS church members until their first edition was published in 1874" },
  H: { label: "1874R", provenance: "The first RLDS edition, published in Plano, Illinois (later issued from Lamoni, Iowa); this edition is based on both the 1840 Nauvoo edition and the 1858 Wright edition" },
  I: { label: "1879", provenance: "A major LDS edition published in Liverpool, England; typeset by William Budge for Orson Pratt, with minor editing by Pratt; two sets of stereotyped plates were produced, of which one set remained in England and the other was taken to Utah; for this edition Pratt divided up the original chapters and assigned the verse numbers that have continued in the LDS text" },
  J: { label: "1888", provenance: "A large-print LDS edition published in Salt Lake City, Utah, by the Juvenile Instructor" },
  K: { label: "1892R", provenance: "The second RLDS edition, published in Lamoni, Iowa; a large-print edition, printed in double columns" },
  L: { label: "1902", provenance: "A missionary edition published in Kansas City, Missouri; printed by Burd and Fletcher" },
  M: { label: "1905", provenance: "A missionary edition published in Chicago, Illinois; prepared by German Ellsworth and printed by Henry C. Etten; for the third impression of this edition (in 1907), Ellsworth made some editorial changes in the plates" },
  N: { label: "1906", provenance: "A large-print edition published in Salt Lake City, Utah, by The Deseret News" },
  O: { label: "1907", provenance: "A vest-pocket edition published in Salt Lake City, Utah, by the Deseret Sunday School Union" },
  P: { label: "1908R", provenance: "The third RLDS edition, a major edition published in Lamoni, Iowa, with numerous corrections based on the printer’s manuscript" },
  Q: { label: "1911", provenance: "A large-print edition published in Chicago, Illinois; prepared by German Ellsworth and printed by Henry C. Etten (the date 1911 is uncertain)" },
  R: { label: "1920", provenance: "A major LDS edition published in Salt Lake City, Utah; printed in Hammond, Indiana, by W. B. Conkey; double columns and chapter summaries are introduced into the LDS text, with considerable grammatical editing, plus some restoration of readings from earlier editions" },
  S: { label: "1953R", provenance: "The current RLDS edition, published in Independence, Missouri; a minor revision of the 1908 RLDS edition" },
  T: { label: "1981", provenance: "The current LDS edition, published in Salt Lake City, Utah; a revision of the 1920 LDS edition, with some restoration of original readings by examination of the two manuscripts" },
});

export const SIGLA_ORDER = Object.freeze(["0", "1", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"]);

/**
 * Correction markers appear in the corpus as HTML entities (`&gt;` 2,203,
 * `&ndash;` 51) and, rarely, as literal characters (17 literal `>js` vs 635
 * `&gt;js`). Decode this closed two-entity set before looking a code up in
 * CHANGES.
 *
 * Marker tokens only. NEVER call this on reading content. Content entities
 * (`&hellip;`, `&mdash;`, `&rsquo;`, `&#120034;`, `&#9312;`) must reach the
 * renderer still encoded. `&amp;` in particular is deliberately not decoded:
 * its 312 occurrences are all the manuscript's own ampersand standing for
 * "and", never a correction code.
 */
export const decodeMarker = (s) =>
  s.replace(/&gt;/g, ">").replace(/&ndash;/g, "–");

/**
 * In-document correction codes, keyed on DECODED characters and WITHOUT the
 * leading ">" — run the raw marker through decodeMarker first.
 *
 * Occurrence counts across the 4,528 header `.source` blocks: `+` 335,
 * `%` 125, `jg` 94, `js` 635, `?` 31, `–` 48, `p` 15, `%?` 6, `%+` 4, `++` 2,
 * `p–` 1, `–?` 1, `+?` 1.
 *
 * There is deliberately NO empty-string key: a bare ">" carries no code, and
 * "" would match at every position in a longest-match tokeniser. Bare markers
 * use BARE_CHANGE instead. To tokenise, iterate CHANGE_CODES (ordered) rather
 * than Object.keys(CHANGES) (insertion order, which would match "+" before
 * "+–" and "%" before "%+"/"%?", truncating three real codes).
 *
 * `b` is unattested in this corpus but is part of Skousen's published legend;
 * kept on purpose so the table stays a faithful copy of the legend.
 *
 * All entries except `%+`, `++`, `?`, `%?`, `p–`, `–?` and `+?` are Skousen's
 * own wording. Those seven are OUR editorial wording for codes the published
 * legend does not gloss — everything else in this module is verbatim citation,
 * so do not assume it. The last three are compositional (like `%?`/`%+`) and
 * were found in the corpus only after the first pass, one occurrence each.
 */
export const CHANGES = Object.freeze({
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

/** Correction codes, longest first — safe to iterate for longest-match tokenising. */
export const CHANGE_CODES = Object.freeze(
  Object.keys(CHANGES).sort((a, b) => b.length - a.length)
);

/**
 * Description for a bare ">" with no code after it. Inherited verbatim from the
 * original table in ATV.js, which keyed it as ">" — not our wording.
 */
export const BARE_CHANGE = "change";

/**
 * Description for a correction code. Bare marker (null/undefined/"") ->
 * BARE_CHANGE; unknown code -> null, so callers can surface it rather than
 * mislabel it as a plain change. Guarded against inherited properties, since
 * the code comes from arbitrary post-marker text and `CHANGES["constructor"]`
 * would otherwise be a truthy function.
 */
export function describeChange(code) {
  if (code === null || code === undefined || code === "") return BARE_CHANGE;
  return Object.prototype.hasOwnProperty.call(CHANGES, code) ? CHANGES[code] : null;
}

/** True for the 22 witness sigla. Strings only — the number 0 is not siglum "0". */
export const isSiglum = (ch) =>
  typeof ch === "string" && Object.prototype.hasOwnProperty.call(WITNESSES, ch);
