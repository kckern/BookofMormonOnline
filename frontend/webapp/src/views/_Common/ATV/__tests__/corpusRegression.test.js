/**
 * Full-corpus regression for the ATV parser.
 *
 * The unit tests pin the parser's SHAPES against hand-picked fixtures. This pins
 * its BEHAVIOUR against the whole production corpus — the only thing that proves
 * a primitive change did not silently move thousands of parses.
 *
 * It is SKIPPED by default: the corpus is third-party copyrighted text (Royal
 * Skousen's Analysis of Textual Variants) and is NOT committed to this repo, so
 * CI has nothing to run and stays green. To run it, point ATV_CORPUS at an
 * untruncated JSON dump and use the normal test runner:
 *
 *   # from the private workspace repo, dump ALL rows (never truncate `text` —
 *   # 929 of 4,528 entries exceed 4,000 chars, the longest 24,889):
 *   node cli/db.mjs --json \
 *     "SELECT id, text FROM bom_xtras_commentary WHERE text REGEXP 'class=.?.?source'" \
 *     > /tmp/atv.json
 *
 *   # from frontend/webapp:
 *   ATV_CORPUS=/tmp/atv.json CI=true npx react-scripts test \
 *     --testPathPattern="corpusRegression" --watchAll=false
 *
 * Baseline recorded 2026-07-24 against the parser at that date. If a count moves,
 * find out WHY before updating it — either the corpus changed or a parser change
 * regressed. Do not reflexively re-baseline.
 *
 * Re-baselined 2026-07-28 (units 4861→4862, totalReadings 11208→11210,
 * multiStateReadings 2134→2135). Cause is a CORPUS edit, not a parser change: the
 * private-workspace data repair sql/2026-07-24-atv-defect-repairs.sql was applied
 * to the DB AFTER the original snapshot. Its fix #4 restored the dropped "0"
 * reading on entry 1369916401, turning the raw-text single-reading bracket
 * [requisite 1ABC…] into a proper two-reading unit
 * [requisites >% requisite 0|requisite 1ABC…] — exactly +1 unit, +2 readings, and
 * +1 multi-state (the "0" reading's requisites→requisite correction chain).
 * Repairs #1–#3 only reshuffle witness sigla inside existing readings, so they
 * move no counts. The parser was UNCHANGED and stays clean corpus-wide (0 throws,
 * 0 warnings, 0 empty segments, 0 unglossed codes, max depth 4).
 */
import fs from "fs";
import { parseApparatus } from "../parseATV";

const CORPUS = process.env.ATV_CORPUS;
const HEADER_RE = /<div class=['"]source['"]>[\s\S]*?<\/div>/;

// Expected totals, verified 2026-07-28 (see re-baseline note above).
const BASELINE = {
  entries: 4528, // rows carrying a .source apparatus block
  units: 4862, // total variation units across all header blocks
  totalReadings: 11210, // pipe-parts across all units
  multiStateReadings: 2135, // readings carrying an in-document correction chain
};

const describeOrSkip = CORPUS && fs.existsSync(CORPUS) ? describe : describe.skip;

if (!CORPUS || !fs.existsSync(CORPUS)) {
  // Jest errors on a file with no tests; leave one explicit marker so the skip
  // is visible in output rather than looking like the suite vanished.
  test("ATV corpus regression is skipped (set ATV_CORPUS to a dump path)", () => {
    expect(true).toBe(true);
  });
}

describeOrSkip("ATV corpus regression", () => {
  // Built in beforeAll, NOT at collection time: a describe.skip still runs its
  // callback body to enumerate tests, so any file read here would throw when
  // CORPUS is unset. beforeAll runs only when the suite is not skipped.
  let stats;

  beforeAll(() => {
    const rows = JSON.parse(fs.readFileSync(CORPUS, "utf8"));
    stats = {
      entries: 0,
      threw: 0,
      threwIds: [],
      units: 0,
      emptyText: 0,
      unitsNoReadings: 0,
      warned: 0,
      warnedIds: [],
      unknownCode: 0,
      unknownIds: [],
      totalReadings: 0,
      multiStateReadings: 0,
      maxStates: 0,
    };

    for (const r of rows) {
      const m = r.text && r.text.match(HEADER_RE);
      if (!m) continue;
      stats.entries++;
      let res;
      try {
        res = parseApparatus(m[0]);
      } catch (e) {
        stats.threw++;
        stats.threwIds.push(r.id);
        continue;
      }
      if (res.warnings.length) {
        stats.warned++;
        stats.warnedIds.push(r.id);
      }
      for (const seg of res.segments) {
        if (seg.kind === "unit") {
          stats.units++;
          if (!seg.readings.length) stats.unitsNoReadings++;
          for (const rd of seg.readings) {
            stats.totalReadings++;
            if (rd.states.length > 1) stats.multiStateReadings++;
            stats.maxStates = Math.max(stats.maxStates, rd.states.length);
            for (const st of rd.states) {
              if (st.via && st.via.code !== null && st.via.label === null) {
                stats.unknownCode++;
                stats.unknownIds.push(`${r.id}:${st.via.code}`);
              }
            }
          }
        } else if (!seg.text.trim()) {
          stats.emptyText++;
        }
      }
    }
  });

  test("no entry throws — a throw blanks the page", () => {
    expect(stats.threwIds).toEqual([]);
  });

  test("every unit has at least one reading, no empty text segments leak", () => {
    expect(stats.unitsNoReadings).toBe(0);
    expect(stats.emptyText).toBe(0);
  });

  test("no unbalanced brackets — the corpus is structurally clean", () => {
    expect(stats.warnedIds).toEqual([]);
  });

  test("every correction code resolves to a label — no P7 gap", () => {
    // A non-null code with a null label is an unglossed correction (spec P7).
    expect(stats.unknownIds).toEqual([]);
  });

  test("entry / unit / reading counts match the recorded baseline", () => {
    expect(stats.entries).toBe(BASELINE.entries);
    expect(stats.units).toBe(BASELINE.units);
    expect(stats.totalReadings).toBe(BASELINE.totalReadings);
    expect(stats.multiStateReadings).toBe(BASELINE.multiStateReadings);
  });

  test("correction chains stay within the observed depth (<= 4 states)", () => {
    expect(stats.maxStates).toBeLessThanOrEqual(4);
  });
});
