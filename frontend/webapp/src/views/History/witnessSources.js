/**
 * Date logic for BOTH `bom_xtras_history` archives — witnesses AND reception.
 *
 * READ DATE_STRATEGY BELOW FIRST. The two archives disagree about which column
 * carries a trustworthy date, so date resolution is dispatched on `src.archive`.
 * Nothing else in this file makes sense until you know which strategy a row gets.
 * (The filename says "witnessSources" for historical reasons — it was built for
 * the Witnesses view. It is not witnesses-only.)
 *
 * This is the pure pipeline the view layer sits on, running parse → derive → key
 * → order → count → filter (parseYearMonth, compositionDate / recalledEvent,
 * ymKey, byCompositionDesc, accountSources, matchesYearMonth, isPosthumousComp).
 * Everything here is a pure function of a source row, so it is testable without
 * React. Presentation formatting deliberately stays in the view layer —
 * formatComposition, month names, and the `↳ recalling` string are rendering
 * decisions, not date logic, and belong with the components that show them.
 *
 * `ymOrdinal` is the odd one out in that list: it isn't a row-level function (it
 * takes a year/month pair, not a source), it's the shared math primitive the
 * row-level functions above build on — `isPosthumousComp` and WitnessLifeHeatmap's
 * own death/excommunication/event era logic both compare dates through it, which
 * is the whole point (see isPosthumousComp's docblock for why that sharing matters).
 *
 * Within the witnesses archive, `event_year` and `event_date` disagree on 44
 * rows, so they are read independently rather than treated as one field — see
 * compositionDate.
 *
 * compositionDate and recalledEvent both return null, but for different reasons,
 * and callers should not treat them as interchangeable: compositionDate returns
 * null when the source is UNUSABLE (no year at all — it cannot be placed on a
 * timeline), whereas recalledEvent returns null when the annotation is NOT
 * APPLICABLE (the source is fine, it simply does not recount an earlier
 * occasion). A source with a composition date and no recalled event is the
 * common case, and every reception row is one.
 */

/**
 * Which column a row's month precision may be taken from, keyed by archive.
 * Verified against all 1024 live rows:
 *
 *   witnesses (444) — `date` is CORRUPT: 76 rows diverge from `year`, holding
 *                     publication/reprint dates, data-entry timestamps and typos
 *                     (`8795`, `4806`). Month comes from `event_date`, gated on
 *                     event_date's own year. See compositionDate's docblock for
 *                     the Cowdery/Moyle shapes that gate exists for.
 *   reception (580) — has NO `event_year`/`event_date` at all (580/580 null),
 *                     and `date` is CLEAN: 0 rows diverge from `year`, every
 *                     value parses. Month comes from `date`.
 *
 * Dispatch is on the ARCHIVE, never on row shape. A per-row "use event_date if
 * present, else fall back to date" rule is tempting and wrong: 16 witnesses rows
 * have no `event_date`, and the fallback would read the corrupt column on
 * precisely those rows. Whether `date` is trustworthy is a fact about the
 * archive, not about the row.
 *
 * Adding an archive means registering it here. The fallback is deliberately the
 * CONSERVATIVE strategy, not the common one: an unregistered archive resolves
 * year-only rather than trusting a column nobody has profiled. Degraded-but-
 * honest beats a fabricated month — the principle the `parsed.year === year`
 * guard below encodes too.
 *
 * (The plan's Task 3b text specified a `date` fallback on the grounds that
 * reception's shape is the more common one. That is the wrong criterion —
 * blast radius is — and it breaks 6 existing tests, since no fixture in either
 * suite sets `archive` and the render suite asserts that rows carrying
 * date:"8795" still resolve through event_date. Flagged rather than implemented.)
 *
 * A Map rather than an object literal so the lookup cannot hit an inherited key:
 * with an object, `archive: "constructor"` resolves to a truthy non-'event'
 * value and silently falls through to reading `date`.
 */
const DATE_STRATEGY = new Map([
    ['witnesses', 'event'],
    ['reception', 'date'],
]);
const FALLBACK_STRATEGY = 'event';

/**
 * Parse a `YYYY` or `YYYY-MM` prefix out of a date string.
 *
 * Two decisions worth keeping:
 *   - It is a PREFIX match, so trailing text is tolerated — `1918-04-25` and
 *     `1918-04-25 (approx)` both yield April 1918. The archive's date strings
 *     are not uniformly formatted.
 *   - An out-of-range month yields `month: null` rather than failing the parse
 *     outright, so a row with a bad month still lands on its year instead of
 *     vanishing. Do not drop this guard: without it `1918-13` produces month 13
 *     and the heatmap indexes past the end of its month column.
 *
 * Witness birth/death dates are the same string shape, so this serves both the
 * source-date callers below and WitnessLifeHeatmap.
 */
export const parseYearMonth = (value) => {
    if (!value) return null;
    const m = String(value).match(/^(\d{4})(?:-(\d{2}))?/);
    if (!m) return null;
    const month = m[2] ? parseInt(m[2], 10) : null;
    return {
        year: parseInt(m[1], 10),
        month: month >= 1 && month <= 12 ? month : null,
    };
};

/**
 * Both functions return this shape; precision is derived from month, never set apart from it.
 * `|| null` rather than `?? null` so a 0 month normalizes too — otherwise the factory's own
 * invariant would depend on every caller pre-filtering, which is the bug it exists to prevent.
 */
const ymResult = (year, month) => ({
    year,
    month: month || null,
    precision: month ? 'month' : 'year',
});

/**
 * When the account was composed.
 *
 * `year` is trustworthy in both archives and is always the answer's year. The
 * only question is whether a MONTH can be recovered, and that is where the two
 * archives differ — see DATE_STRATEGY above for which column each one reads.
 *
 * Under the `event` strategy the month comes from event_date, but only when
 * event_date's OWN year matches `year`. Gating on `event_year` instead would be
 * wrong: on ~20 rows event_date carries the composition date while event_year
 * points at the older occasion being recounted. Oliver Cowdery to W. W. Phelps,
 * Letter I is the canonical shape — year=1834, event_date=1834-09-07,
 * event_year=1829: written September 1834, recounting the 1829 translation. An
 * `event_year === year` gate discards that good September. Comparing
 * event_date's own year keeps it, and still declines the month when event_date
 * describes some other year (the Moyle shape: year=1940, event_date=1885-06-28).
 *
 * The `parsed.year === year` guard applies under BOTH strategies. For reception
 * it is a no-op today (0 divergent rows of 580), but it is the same invariant
 * that neutralized the 18 witnesses rows whose event_date carried a data-entry
 * timestamp (`2022-11-02` on an 1830 document). It costs nothing and converts
 * future corruption into degraded-but-honest year precision instead of a
 * fabricated month. Do not drop it from either path.
 */
export const compositionDate = (src) => {
    const year = parseInt(src?.year, 10);
    if (!year) return null;
    const strategy = DATE_STRATEGY.get(src?.archive) ?? FALLBACK_STRATEGY;
    const parsed = parseYearMonth(strategy === 'event' ? src?.event_date : src?.date);
    const describesCompositionYear = parsed && parsed.year === year;
    return ymResult(year, describesCompositionYear ? parsed.month : null);
};

/**
 * The earlier occasion an account recounts, when that is not the composition
 * occasion. Returns null — meaning "no annotation to show" — in three cases:
 * the source has no usable composition date to anchor the recollection to (a
 * card would otherwise read "recalling May 1900" under an empty date), the
 * event IS the composition occasion, or the event postdates composition, which
 * is impossible (one row: year=1840, event_year=1842).
 *
 * This needs no DATE_STRATEGY dispatch: a recalled event is by definition an
 * `event_year` fact, and reception has no `event_year` on any of its 580 rows,
 * so every reception row exits at the `!eventYear` guard. Pinned by test rather
 * than left to inference. It reads `event_date` unconditionally for the same
 * reason — under any archive that has one, it describes the event.
 */
export const recalledEvent = (src) => {
    const year = parseInt(src?.year, 10);
    const eventYear = parseInt(src?.event_year, 10);
    if (!year || !eventYear || eventYear === year) return null;
    if (eventYear > year) return null;
    const event = parseYearMonth(src?.event_date);
    const describesTheEvent = event && event.year === eventYear;
    return ymResult(eventYear, describesTheEvent ? event.month : null);
};

/**
 * The shared cell-key format for the heatmap grid: `YYYY-MM`, month zero-padded.
 * Must stay byte-identical to whatever reads it — WitnessLifeHeatmap's cells,
 * the selectedYearMonth prop, and matchesYearMonth all round-trip through this.
 */
export const ymKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

/** Newest composition first; month-dated before year-only within a year; `seq` breaks ties. */
export const byCompositionDesc = (a, b) => {
    const ca = compositionDate(a);
    const cb = compositionDate(b);
    if (!ca || !cb) {
        if (!ca && !cb) return (a.seq || 0) - (b.seq || 0);
        return ca ? -1 : 1;
    }
    if (cb.year !== ca.year) return cb.year - ca.year;
    if ((cb.month || 0) !== (ca.month || 0)) return (cb.month || 0) - (ca.month || 0);
    return (a.seq || 0) - (b.seq || 0);
};

/**
 * Ordinal month index, comparable across years: Jan 1829 = 1829*12+0, Dec 1888 = 1888*12+11.
 * Exported so the heatmap's death/excommunication/event era logic and the posthumous bucket
 * below share one formula — see isPosthumousComp for why that sharing matters.
 */
export const ymOrdinal = (year, month) => year * 12 + (month - 1);

/**
 * Was a composition dated strictly after a witness's death?
 *
 * Ordinal-aware, not year-only: a month-precise composition compares at month precision
 * (`ymOrdinal(comp.year, comp.month) > deathOrdinal`); a year-only composition falls back to
 * comparing years, because no finer comparison is possible. A bare `comp.year > deathYear`
 * check is not enough on its own — it misses sources composed later in the death year itself.
 * This is real, not theoretical: David Whitmer died 25 Jan 1888, and the live archive has two
 * sources composed in Feb 1888 (a Richmond Democrat obituary, an Angus M. Cannon interview) —
 * same calendar year, after the death. (Task 8's dispatch prompt cited four such sources; the
 * live `bom_xtras_history` table verified at implementation time has two. The count moves the
 * data doesn't change the shape of the bug — a bare year check is still wrong either way.)
 *
 * `deathOrdinal` of `null`/`undefined` means "no recorded death" — always false.
 */
export const isPosthumousComp = (comp, deathOrdinal) => {
    if (!comp || deathOrdinal === null || deathOrdinal === undefined) return false;
    return comp.month !== null
        ? ymOrdinal(comp.year, comp.month) > deathOrdinal
        : comp.year > Math.floor(deathOrdinal / 12);
};

/**
 * Placement accounting for the heatmap meta strip.
 *
 * `monthPrecise` / `yearOnly` / `unusable` are exclusive and sum to `total` — that invariant
 * is the whole point, since the strip's job is to explain where every source went.
 * `recallsEarlier` OVERLAPS them: a source can draw a grid cell in its composition month
 * and still recount an older occasion (the Cowdery letter — written Sep 1834 about 1829).
 * It is an annotation, not a placement, so it is never part of the sum.
 *
 * `opts.deathOrdinal`, when given, splits out a fourth exclusive bucket, `posthumous`: Task 8
 * excludes sources composed after a witness's death from the heatmap grid (they render in a
 * separate strip instead), so counting them as "placed" here would make this strip claim more
 * cells than the grid actually draws — precisely the defect Task 8 exists to fix, one function
 * away. Checked BEFORE precision, because a posthumous source is not placed regardless of how
 * precisely it is dated. The invariant becomes
 * `monthPrecise + yearOnly + posthumous + unusable === total`.
 *
 * DEVIATION FROM THE PLAN, both flagged deliberately:
 *
 * 1. The plan's Task 8 text names this option `deathYear` and compares `comp.year > deathYear`
 *    — a year-only check. Doing that here would reopen the exact bug Task 8's own amendment
 *    just fixed one function away: a Feb-1888 Whitmer source would be excluded from the grid
 *    (the grid's exclusion loop is ordinal-aware per the amendment) but still counted
 *    `monthPrecise` here (year-only-aware) — so "N placed" would disagree with the grid's cell
 *    count again, the D3 defect reopened in a new function. `deathOrdinal` plus the shared
 *    `isPosthumousComp` above keeps both call sites on identical math by construction, not by
 *    two authors remembering to keep two formulas in sync.
 *
 * 2. The plan's code unconditionally seeds `posthumous: 0` on the returned object. That breaks
 *    two existing `toEqual` tests below, which assert the pre-Task-8 5-key shape exactly
 *    (`{ total, monthPrecise, yearOnly, unusable, recallsEarlier }`, no `posthumous` key) for
 *    calls that pass no second argument at all — Jest's `toEqual` does not ignore a real 0
 *    value the expected object doesn't mention. `posthumous` is added to the returned object
 *    ONLY when a real options object is passed (regardless of whether `deathOrdinal` inside it
 *    is null), so:
 *      - `accountSources(sources)` and `accountSources(sources, null)` — every pre-Task-8 caller,
 *        plus a caller that computes its options as `null` (e.g.
 *        `witness.deathday ? { deathOrdinal } : null`) — both keep the exact 5-key shape.
 *        `opts != null` (loose) is deliberate: `opts !== undefined` alone would let a `null`
 *        options argument through to `opts.deathOrdinal` and throw.
 *      - `accountSources(sources, { deathOrdinal: null })` — a witness with no `deathday`,
 *        called with an explicit (non-null) options object — gets a 6th key,
 *        `posthumous: 0`, which is what WitnessLifeHeatmap always passes (it always supplies
 *        the options object, death or no death), so through the component
 *        `accounting.posthumous` is always a number, never `undefined`.
 */
export const accountSources = (sources, opts) => {
    // Loose equality catches both `null` and `undefined` -- `opts !== undefined` alone still
    // let `accountSources(sources, null)` through to `opts.deathOrdinal` and throw. No current
    // caller passes `null`, but `accountSources(sources, witness.deathday ? {...} : null)` is a
    // natural future call shape, and this should degrade to the 3-bucket behavior, not crash.
    const trackDeath = opts != null;
    const deathOrdinal = trackDeath && opts.deathOrdinal != null ? opts.deathOrdinal : null;
    const acc = { total: 0, monthPrecise: 0, yearOnly: 0, unusable: 0, recallsEarlier: 0 };
    if (trackDeath) acc.posthumous = 0;
    for (const src of sources || []) {
        acc.total += 1;
        const comp = compositionDate(src);
        if (!comp) acc.unusable += 1;
        else if (isPosthumousComp(comp, deathOrdinal)) acc.posthumous += 1;
        else if (comp.precision === 'month') acc.monthPrecise += 1;
        else acc.yearOnly += 1;
        if (recalledEvent(src)) acc.recallsEarlier += 1;
    }
    return acc;
};

/**
 * Does a source belong to the selected slice?
 *
 * `"YYYY-MM"` is MONTH-STRICT: only month-precise sources match. This keeps every heatmap
 * cell honest — the count on the cell is the count of cards clicking it opens. Year-only
 * sources deliberately do NOT match a month they were never dated to.
 * `"YYYY"` selects the whole year, both precisions — the primitive behind Task 13's
 * "N more are dated YYYY without a month" disclosure, which is how year-only sources
 * stay reachable now that months exclude them.
 */
export const matchesYearMonth = (src, yearMonth) => {
    if (!yearMonth) return true;
    const comp = compositionDate(src);
    if (!comp) return false;
    const [year, month] = String(yearMonth).split('-').map(n => parseInt(n, 10));
    if (!year || comp.year !== year) return false;
    if (!month) return true;              // bare "YYYY" — the whole year
    return comp.month === month;          // month-strict
};

/**
 * Groups an already-sorted list into decade buckets, preserving order within each.
 *
 * Only merges ADJACENT same-decade rows — it does not sort or re-bucket the whole
 * list by decade, it partitions a run. Callers pass a `byCompositionDesc`-sorted
 * list, so in practice every source of a decade is contiguous and this is
 * indistinguishable from a full group-by; the adjacency-only behavior only shows
 * up if a caller passes something unsorted, which is not this module's contract
 * to enforce (see `byCompositionDesc` for the ordering this is meant to sit on top of).
 *
 * `decade: null` / `label: 'Undated'` is the same "unusable" case `compositionDate`
 * itself returns null for — a source with no parseable `year`. Every live row in
 * both archives has a `year` (see the plan's data-profiling table), so this branch
 * is defensive rather than reachable today; kept because `compositionDate` genuinely
 * can return null and a caller should not have to guess what happens to that row.
 */
export const groupByDecade = (sources) => {
    const groups = [];
    let current = null;
    for (const src of sources || []) {
        const comp = compositionDate(src);
        const decade = comp ? Math.floor(comp.year / 10) * 10 : null;
        if (!current || current.decade !== decade) {
            current = { decade, label: decade === null ? 'Undated' : `${decade}s`, sources: [] };
            groups.push(current);
        }
        current.sources.push(src);
    }
    return groups;
};
