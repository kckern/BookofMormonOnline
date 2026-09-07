import React, { useEffect, useMemo, useRef, useState } from 'react';
import './WitnessLifeHeatmap.css';
import { compositionDate, accountSources, ymKey, parseYearMonth, ymOrdinal, isPosthumousComp } from './witnessSources';

const CELL_PX_MAX = 18;
const CELL_PX_MIN = 4;
const ROW_PX_MAX = 9;   // cap cell HEIGHT independently — cells fill width but stay short (rectangles)
const GAP_PX = 1;
const MONTHS_COL_PX = 14;
const SIDE_PADDING_PX = 4;
const TOUCH_CELL_FLOOR_PX = 12;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const colorBucket = (count) => {
    if (!count) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 6) return 3;
    return 4;
};

const HEATMAP_START_YEAR = 1829;
// All witnesses — and any plausible contemporary posthumous account — predate this.
// Later dates (e.g. a modern republication/import artifact stamped 2003) are data
// errors for a 19th-century life timeline, so they're treated as undated, not placed.
const HEATMAP_END_YEAR = 1930;

const WitnessLifeHeatmap = ({ witness, sources, selectedYearMonth, onSelectYearMonth }) => {

    // Hover and focus are tracked separately so a mouse merely passing over a
    // cell can't strand a keyboard user's detail panel. If they shared one
    // piece of state, tabbing to cell A then letting the mouse drift across
    // cell B (no click, focus untouched) would clear the state to null when
    // the mouse left B — the panel would go empty even though focus is still
    // visibly on A. Mouse takes precedence while actively hovering (matches
    // sighted-mouse-user expectation); leaving with the mouse falls back to
    // whatever is focused rather than going empty.
    const [hoveredKey, setHoveredKey] = useState(null);
    const [compressOverride, setCompressOverride] = useState(null);
    const [focusedKey, setFocusedKey] = useState(null);
    const activeKey = hoveredKey ?? focusedKey;
    const wrapperRef = useRef(null);
    const [wrapperWidth, setWrapperWidth] = useState(0);

    // Roving tabindex's "current" cell — a separate piece of state from `focusedKey`/
    // `hoveredKey` above. See the docblock beside `rovingKeyResolved` further down for why:
    // in short, `focusedKey` is display state for the hover panel and is cleared on blur,
    // while `rovingKey` is navigation memory that must survive a blur so Tabbing back into
    // the grid returns to where the user left off.
    const [rovingKey, setRovingKey] = useState(null);
    // DOM refs for clickable cells only, keyed by ymKey. Arrow-key navigation calls
    // `.focus()` on these directly — roving tabindex requires real DOM focus movement, not
    // just an attribute change. Populated/cleared via each cell's ref callback below, so a
    // cell that stops being clickable (or disappears under compression) removes its own
    // entry rather than leaving a stale reference behind.
    const cellRefs = useRef(new Map());

    // SELF-REFERENTIAL MEASUREMENT — read before changing either side of this loop.
    //
    // wrapperRef is attached to `.witness-life-heatmap` below, the SAME element the CSS sizes
    // with `width: fit-content` (see WitnessLifeHeatmap.css). This ResizeObserver measures that
    // element's rendered width; `widthFor()` below turns the measurement into `cellPx`; `cellPx`
    // (via the `--bom-heatmap-cell` custom property) is exactly what determines the grid's
    // rendered width, which is exactly what `fit-content` sizes the wrapper to. Do not "simplify"
    // this by measuring wrapperRef's parent instead without re-running the analysis below — a
    // stably-sized ancestor breaks the loop but also breaks the min-width floor's "shrink to fit
    // a short-lived witness" behavior, which depends on the wrapper itself being fit-content.
    //
    // On mount wrapperWidth is 0, and widthFor() has a `!wrapperWidth` guard that returns
    // CELL_PX_MAX unconditionally, so first paint renders at max cell size with the FULL
    // uncompressed column count — the widest any witness's grid is ever asked to be. After that,
    // each ResizeObserver callback feeds the previous render's width back into widthFor(), which
    // computes a new cellPx, which changes the grid's natural width, which is what gets measured
    // next. This is provably bounded, not just "probably fine": cellPx is clamped to
    // [CELL_PX_MIN, CELL_PX_MAX], and the wrapper's rendered width is separately clamped between
    // `min-width` (640px, or 100% below that) and `max-width: 100%` — so the sequence can't run
    // away in either direction, and each step's clamp-to-clamp mapping is monotonic, so it can't
    // oscillate either (verified against all 19 real witnesses in Witnesses.js's `data` via a
    // standalone simulation of this exact loop against live bom_xtras_history rows — every one
    // converges to a fixed point within 10 render passes, most within 1-2).
    //
    // What that simulation also showed, worth knowing before touching widthFor()'s constants:
    // for witnesses with many month-precise sources spread across a long, hard-to-compress
    // lifespan (David Whitmer, Martin Harris, William Smith, Katherine Smith, John Whitmer, Emma
    // Smith, Willard Chase — the ones with the MOST source coverage), the fixed point tends to
    // land measurably below CELL_PX_MAX, bounded by the 640px min-width floor rather than by the
    // viewport — because widthFor() reserves MONTHS_COL_PX + SIDE_PADDING_PX*2 (22px) of overhead
    // per measurement, which does not exactly match the months-column/padding/flex-gap the CSS
    // actually renders, so each iteration's cellPx estimate is a little conservative and the
    // sequence ratchets down a step at a time before locking onto the floor. This is a
    // pre-existing characteristic of widthFor(), not something this task's CSS changes caused,
    // and it converges cleanly either way — but it means "cells reach max size on desktop" is not
    // true for every witness, just the ones with fewer or more compressible sources. Recalibrating
    // widthFor()'s overhead constants to close that gap is a reasonable follow-up; it was left
    // alone here to keep this task's diff to the three CSS/JS changes it was scoped for.
    //
    // FOLLOW-UP, verified with the same harness: the wrapper's resolved width (640px floor, OR
    // the legend row's own natural width — see WitnessLifeHeatmap.css) is very often WIDER than
    // the grid's actual content, especially for source-sparse witnesses (a 7-column grid is only
    // ~134px wide even at CELL_PX_MAX). Left-aligned, that showed up as a large flush-right dead
    // zone inside the wrapper — a smaller-scale recurrence of the exact defect this task exists
    // to fix. Fixed by centering `.witness-life-heatmap-scroll` (the grid block) within the
    // wrapper instead of letting it fill left-aligned — see that rule's comment. This is a pure
    // CSS/layout change; it does not touch this ResizeObserver loop or its convergence behavior.
    useEffect(() => {
        if (!wrapperRef.current || typeof ResizeObserver === 'undefined') return undefined;
        let rafId = null;
        const ro = new ResizeObserver(entries => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                rafId = null;
                for (const entry of entries) setWrapperWidth(entry.contentRect.width);
            });
        });
        ro.observe(wrapperRef.current);
        setWrapperWidth(wrapperRef.current.getBoundingClientRect().width);
        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            ro.disconnect();
        };
    }, []);

    const { yearStart, yearEnd, sourcesByYm, posthumous, accounting, deathOrdinal, excommunicationOrdinal, birthYear } = useMemo(() => {
        // The witness's own dates are hardcoded literals in Witnesses.js, not
        // bom_xtras_history rows, so they are parsed directly rather than run
        // through compositionDate — there is no archive to dispatch on and no
        // corrupt column to route around.
        const birth = parseYearMonth(witness?.birthday);
        const death = parseYearMonth(witness?.deathday);
        const excom = parseYearMonth(witness?.excommunication);
        const birthYear = birth?.year ?? null;

        // Computed before the loop below (unlike pre-Task-8, where it was derived after) —
        // the loop needs it to decide, per source, whether a composition lands in the grid
        // at all or is pulled out into the posthumous strip.
        const deathOrdinal = death ? ymOrdinal(death.year, death.month || 12) : null;

        const sourcesByYm = new Map();
        const posthumous = [];
        let latestSourceYear = null;

        for (const src of sources || []) {
            const comp = compositionDate(src);
            if (!comp || comp.year < HEATMAP_START_YEAR) continue;
            if (isPosthumousComp(comp, deathOrdinal)) { posthumous.push({ src, comp }); continue; }
            // HEATMAP_END_YEAR guards the grid's own x-axis, not the posthumous strip: a
            // genuinely posthumous account (e.g. composed in 1940 about a witness who died
            // in 1888) already exited above, unbounded, above. This only catches the case
            // a witness with no recorded deathday has a bogus, implausibly modern date
            // (a "2003" data-entry timestamp typo) that would otherwise blow out yearEnd.
            if (comp.year > HEATMAP_END_YEAR) continue;
            if (latestSourceYear === null || comp.year > latestSourceYear) latestSourceYear = comp.year;
            if (!comp.month) continue;
            const key = ymKey(comp.year, comp.month);
            if (!sourcesByYm.has(key)) sourcesByYm.set(key, []);
            sourcesByYm.get(key).push(src);
        }
        posthumous.sort((a, b) => a.comp.year - b.comp.year);

        const yearStart = HEATMAP_START_YEAR;
        // yearEnd needs no special case for the posthumous split: with posthumous rows
        // excluded from latestSourceYear above, Math.max naturally lands on the death year
        // once one exists, since nothing later is left to out-compete it.
        const yearEnd = Math.max(latestSourceYear ?? yearStart, death?.year ?? yearStart);
        const excommunicationOrdinal = excom ? ymOrdinal(excom.year, excom.month || 12) : null;

        return { yearStart, yearEnd, sourcesByYm, posthumous,
                 accounting: accountSources(sources, { deathOrdinal }),
                 deathOrdinal, excommunicationOrdinal, birthYear };
    }, [witness?.birthday, witness?.deathday, witness?.excommunication, sources]);

    if (yearEnd < yearStart) return null;

    const years = [];
    for (let y = yearStart; y <= yearEnd; y++) years.push(y);

    const COMPRESS_THRESHOLD = 3;
    const COMFORT_CELL_PX = 7;
    const deathYear = deathOrdinal !== null ? Math.floor(deathOrdinal / 12) : null;
    const excomYear = excommunicationOrdinal !== null ? Math.floor(excommunicationOrdinal / 12) : null;
    const isMarkerYear = (year) => year === 1829 || year === deathYear || year === excomYear;
    const hasSourcesInYear = (year) => {
        for (let m = 1; m <= 12; m++) if (sourcesByYm.has(ymKey(year, m))) return true;
        return false;
    };

    const compressedColumns = [];
    {
        let runStart = null;
        const flushRun = (start, end) => {
            const len = end - start + 1;
            if (len >= COMPRESS_THRESHOLD) {
                compressedColumns.push({ type: 'compressed', startYear: start, endYear: end });
            } else {
                for (let y = start; y <= end; y++) compressedColumns.push({ type: 'year', year: y });
            }
        };
        for (const year of years) {
            const compressible = !isMarkerYear(year) && !hasSourcesInYear(year);
            if (compressible) {
                if (runStart === null) runStart = year;
            } else {
                if (runStart !== null) { flushRun(runStart, year - 1); runStart = null; }
                compressedColumns.push({ type: 'year', year });
            }
        }
        if (runStart !== null) flushRun(runStart, years[years.length - 1]);
    }
    const uncompressedColumns = years.map(y => ({ type: 'year', year: y }));

    // Touch floor computed here, not in CSS: a `@media (pointer: coarse)` override of
    // --bom-heatmap-cell (set via inline style on this same element) would have to read its
    // own current value to do "raise it if it's below 12px" — a cyclic custom-property
    // self-reference, invalid at computed-value time regardless of !important winning the
    // cascade. Verified empirically against real Chromium, not just derived from the spec
    // text. Full derivation: docs/plans/2026-07-18-witnesses-view-ux-fixes.md, Task 16.
    const isCoarsePointer = typeof window.matchMedia === 'function'
        && window.matchMedia('(pointer: coarse)').matches;

    // The touch floor is applied ONLY to the final, rendered `cellPx` below — never inside
    // this helper itself. `widthFor()` also computes `uncompressedCellPx`, which feeds
    // `shouldCompress`'s COMFORT_CELL_PX comparison (a legibility threshold, unrelated to
    // touch tappability). Flooring inside the helper was tried first and inflated that probe
    // too: a fixture that would otherwise compress (raw cell 4px, well under the 7px comfort
    // threshold) instead measured a floored 12px, read as "already comfortable," and skipped
    // compression it should have applied — the touch floor silently changing an unrelated
    // layout decision. Caught by a test asserting the fine-pointer and coarse-pointer cases
    // agree on `shouldCompress`, which they must, since pointer type has nothing to do with
    // how many columns fit comfortably.
    const widthFor = (cols) => {
        if (!wrapperWidth) return CELL_PX_MAX;
        const available = wrapperWidth - MONTHS_COL_PX - SIDE_PADDING_PX * 2;
        return Math.max(CELL_PX_MIN, Math.min(CELL_PX_MAX, available / cols.length - GAP_PX));
    };
    const uncompressedCellPx = widthFor(uncompressedColumns);
    const canCompress = compressedColumns.length < uncompressedColumns.length;
    const autoCompress = wrapperWidth > 0 && uncompressedCellPx < COMFORT_CELL_PX;
    const shouldCompress = canCompress && (compressOverride === null ? autoCompress : compressOverride);
    const displayColumns = shouldCompress ? compressedColumns : uncompressedColumns;

    const rawCellPx = widthFor(displayColumns);
    const cellPx = isCoarsePointer ? Math.max(rawCellPx, TOUCH_CELL_FLOOR_PX) : rawCellPx;
    const rowPx = Math.min(cellPx, ROW_PX_MAX);

    const labelWidthPx = 32;
    const minLabelEvery = Math.max(1, Math.ceil(labelWidthPx / (cellPx + GAP_PX)));
    const labelEvery = displayColumns.length > 60 ? Math.max(10, minLabelEvery)
        : displayColumns.length > 30 ? Math.max(5, minLabelEvery)
        : Math.max(2, minLabelEvery);
    const lastIdx = displayColumns.length - 1;
    const labelLastYear = lastIdx > 0 && (lastIdx % labelEvery) >= minLabelEvery;
    const isLabeled = (i) => i % labelEvery === 0 || (i === lastIdx && labelLastYear);

    const witnessEventOrdinal = ymOrdinal(1829, 6);

    const eraOf = (year, month) => {
        const ord = ymOrdinal(year, month);
        if (deathOrdinal !== null && ord === deathOrdinal) return 'death';
        if (deathOrdinal !== null && ord > deathOrdinal) return 'posthumous';
        if (excommunicationOrdinal !== null && ord === excommunicationOrdinal) return 'excommunication';
        if (ord === witnessEventOrdinal) return 'event';
        return 'witness';
    };

    const cellLabel = (year, month, count, era) => {
        const when = `${MONTHS_FULL[month - 1]} ${year}`;
        const what = count ? `${count} source${count === 1 ? '' : 's'}` : 'no sources';
        const tag = era === 'death' ? ', death month'
            : era === 'excommunication' ? ', excommunication'
            : era === 'event' ? ', witness event'
            : era === 'posthumous' ? ', posthumous'
            : '';
        return `${when}, ${what}${tag}`;
    };

    // Matches the hover panel's own compressed-run wording ("{span} empty years compressed")
    // so a sighted user hovering and a screen-reader user tabbing/arrowing hear the same fact.
    const compressedCellLabel = (startYear, endYear) =>
        `${startYear}–${endYear}, ${endYear - startYear + 1} empty years compressed`;

    // --- Grid cell matrix + roving-tabindex/arrow-key navigation ---------------------------
    //
    // Built once per render as a plain 2D array (rows = months 0-11, columns = displayColumns)
    // so the JSX below and the arrow-key handlers can both address a cell by [monthIndex]
    // [colIndex] without computing era/count/label logic twice. Compressed-run cells are
    // included (so `role="row"` wraps them too) but marked `clickable: false` and never enter
    // `clickableKeys`: they have no click handler and nothing to activate, so giving them a
    // roving-tabindex/arrow-key stop would invent a "focusable but inert" cell state that
    // nothing else in this component has. The same reasoning excludes ordinary zero-source
    // cells (empty months, marker months with no sources) — they were already outside the tab
    // order before this task (Task 7), and extending arrow-key navigation to include them would
    // be a bigger behavioral change than this task's brief calls for.
    const clickableKeys = [];
    const gridRows = MONTHS.map((_, mi) => {
        const month = mi + 1;
        return displayColumns.map((col, ci) => {
            if (col.type === 'compressed') {
                return {
                    type: 'compressed', mi, ci, clickable: false,
                    key: `compressed:${col.startYear}-${col.endYear}`,
                    startYear: col.startYear, endYear: col.endYear,
                };
            }
            const year = col.year;
            const key = ymKey(year, month);
            const count = (sourcesByYm.get(key) || []).length;
            const isSelected = selectedYearMonth === key;
            const era = eraOf(year, month);
            const isMarker = era === 'death' || era === 'excommunication' || era === 'event';
            const clickable = count > 0;
            if (clickable) clickableKeys.push(key);
            const cls = [
                'cell',
                `era-${era}`,
                `bucket-${colorBucket(count)}`,
                isSelected ? 'selected' : '',
                count || isMarker ? 'has-sources' : '',   // keeps the darker marker fills
                clickable ? 'is-clickable' : '',          // pointer + hit target only where a click does something
            ].filter(Boolean).join(' ');
            return { type: 'year', mi, ci, key, year, month, count, era, isSelected, clickable, cls };
        });
    });

    /**
     * The effective Tab stop. `rovingKey` (state, set only on focus, never cleared on blur —
     * see its declaration above) is trusted first, but re-validated every render: if the
     * previously-current cell stopped being clickable (a resize toggled compression, a data
     * refresh removed its sources), falling back to a stale key would strand the grid with NO
     * tab stop at all — worse than Task 7's flat tab order. The fallback chain is: the roving
     * cell if still clickable, else the selected cell if clickable, else the first clickable
     * cell in the grid, else null (an empty grid contributes nothing to the tab order, which is
     * correct — there is nothing to Tab to).
     */
    const rovingKeyResolved =
        (rovingKey && clickableKeys.includes(rovingKey) && rovingKey) ||
        (selectedYearMonth && clickableKeys.includes(selectedYearMonth) && selectedYearMonth) ||
        clickableKeys[0] ||
        null;

    const focusCellByKey = (key) => {
        const el = key && cellRefs.current.get(key);
        if (el) el.focus();
    };

    // Left/Right walk a row (same month, adjacent year-column); Up/Down walk a column (same
    // year, adjacent month-row) — both skip over non-clickable cells (compressed runs, empty
    // months, marker months with no sources) rather than stopping on them, per the same
    // "arrow keys move within the existing interactive model only" call as clickableKeys above.
    const stepInRow = (mi, ci, dir) => {
        for (let j = ci + dir; j >= 0 && j < displayColumns.length; j += dir) {
            if (gridRows[mi][j].clickable) return gridRows[mi][j];
        }
        return null;
    };
    const stepInCol = (mi, ci, dir) => {
        for (let i = mi + dir; i >= 0 && i < 12; i += dir) {
            if (gridRows[i][ci].clickable) return gridRows[i][ci];
        }
        return null;
    };
    // Home/End: first/last clickable cell in the current row. Not required by the plan, but
    // cheap given this matrix already exists, so included.
    const edgeOfRow = (mi, dir) => {
        for (let j = dir === 1 ? 0 : displayColumns.length - 1; j >= 0 && j < displayColumns.length; j += dir) {
            if (gridRows[mi][j].clickable) return gridRows[mi][j];
        }
        return null;
    };
    const ARROW_NAV = {
        ArrowRight: (cell) => stepInRow(cell.mi, cell.ci, 1),
        ArrowLeft: (cell) => stepInRow(cell.mi, cell.ci, -1),
        ArrowDown: (cell) => stepInCol(cell.mi, cell.ci, 1),
        ArrowUp: (cell) => stepInCol(cell.mi, cell.ci, -1),
        Home: (cell) => edgeOfRow(cell.mi, 1),
        End: (cell) => edgeOfRow(cell.mi, -1),
    };
    const handleCellKeyDown = (e, cell) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectYearMonth(cell.isSelected ? null : cell.key);
            return;
        }
        const nav = ARROW_NAV[e.key];
        if (!nav) return;
        // Consume the keypress even at an edge (no target found) — a grid widget owns arrow
        // keys while a cell inside it is focused, rather than letting them fall through to,
        // say, scrolling `.witness-life-heatmap-scroll`.
        e.preventDefault();
        const target = nav(cell);
        if (target) focusCellByKey(target.key);
    };

    return (
        <div className='witness-life-heatmap' ref={wrapperRef} style={{ '--bom-heatmap-cell': `${cellPx}px`, '--bom-heatmap-row': `${rowPx}px` }}>
            <div className='witness-life-heatmap-meta'>
                <span>{yearStart}–{yearEnd}</span>
                <span className='dot'>·</span>
                <span>{accounting.monthPrecise} of {accounting.total} sources placed</span>
                {accounting.yearOnly > 0 && (
                    <><span className='dot'>·</span><span>{accounting.yearOnly} year-only</span></>
                )}
                {accounting.unusable > 0 && (
                    <><span className='dot'>·</span><span>{accounting.unusable} undated</span></>
                )}
                {accounting.recallsEarlier > 0 && (
                    <><span className='dot'>·</span>
                    <span>{accounting.recallsEarlier} also recall an earlier event</span></>
                )}
                {/* "also" is doing real work — recallsEarlier OVERLAPS the placement counts
                    above it and must not read as a fourth addend. Only monthPrecise,
                    yearOnly, posthumous and undated sum to total. See accountSources' docblock. */}
                {accounting.posthumous > 0 && (
                    <><span className='dot'>·</span>
                    {/* "after death", not "after his death" — data has female witnesses too
                        (Mary Whitmer, Lucy Mack Smith, Katherine Smith, Emma Smith). */}
                    <span>{accounting.posthumous} after death</span></>
                )}
                {shouldCompress && (
                    <><span className='dot'>·</span><span className='witness-life-heatmap-compressed-note'>
                        {years.length - displayColumns.length} empty years compressed
                    </span></>
                )}
                <div className='witness-life-heatmap-controls'>
                    {canCompress && (
                        <label className='witness-life-heatmap-switch'>
                            <input
                                type='checkbox'
                                checked={shouldCompress}
                                onChange={(e) => setCompressOverride(e.target.checked)}
                            />
                            <span className='witness-life-heatmap-switch-track'>
                                <span className='witness-life-heatmap-switch-knob' />
                            </span>
                            <span className='witness-life-heatmap-switch-text'>Compress empty years</span>
                        </label>
                    )}
                </div>
                {/* No clear-filter control here (Task 13, W8): the filter's consequence
                    lives with the cards, so its control does too -- Witnesses.js renders
                    the clear chip above the card grid. */}
            </div>
            <div className='witness-life-heatmap-scroll'>
              <div className={`witness-life-heatmap-timeline${shouldCompress ? ' is-centered' : ''}`}>
                <div className='witness-life-heatmap-ages'>
                    {displayColumns.map((col, i) => {
                        if (col.type === 'compressed') {
                            return <div key={`c-${col.startYear}`} className='age-tick age-tick-compressed' />;
                        }
                        const y = col.year;
                        const isAlive = deathYear === null || y <= deathYear;
                        const age = birthYear !== null && isAlive ? y - birthYear : null;
                        const isDeathYear = deathYear !== null && y === deathYear;
                        const show = isLabeled(i) || isDeathYear;
                        const cls = `age-tick${isDeathYear ? ' age-tick-death' : ''}`;
                        return (
                            <div key={y} className={cls} style={{ visibility: show ? 'visible' : 'hidden' }}>
                                {age !== null && <div className='age-label'>{age}</div>}
                                <div className='tick-mark' />
                            </div>
                        );
                    })}
                </div>
                <div className='witness-life-heatmap-grid-wrap'>
                    <div className='witness-life-heatmap-months'>
                        {MONTHS.map(m => <div key={m} className='month-label'>{m[0]}</div>)}
                    </div>
                    <div
                        className='witness-life-heatmap-grid'
                        role='grid'
                        aria-label={`${witness.name}: sources by month, ${yearStart} to ${yearEnd}`}
                        style={{ gridTemplateColumns: `repeat(${displayColumns.length}, var(--bom-heatmap-cell, 8px))` }}
                    >
                        {gridRows.map((row, mi) => (
                            // `display: contents` keeps this wrapper out of CSS Grid's box-generation —
                            // its children participate in the grid's auto-placement exactly as if the
                            // wrapper weren't there — while still giving `role="row"` the DOM element
                            // `gridcell`'s required parent context calls for. 12 of these, one per month.
                            // No `aria-label` here deliberately: ARIA does not require `role="row"` to
                            // carry its own accessible name, every cell's own label already states the
                            // month, and a named row would have a screen reader announce the month
                            // twice on every vertical arrow move ("June. June 1850, 1 source.") for no
                            // informational gain — nothing consumes the row's name today.
                            <div key={MONTHS[mi]} role='row' style={{ display: 'contents' }}>
                                {row.map((cell) => {
                                    if (cell.type === 'compressed') {
                                        return (
                                            <div
                                                key={cell.key}
                                                className='cell era-compressed'
                                                role='gridcell'
                                                aria-label={compressedCellLabel(cell.startYear, cell.endYear)}
                                                onMouseEnter={() => setHoveredKey(cell.key)}
                                                onMouseLeave={() => setHoveredKey(prev => prev === cell.key ? null : prev)}
                                            />
                                        );
                                    }
                                    const { key, year, month, count, era, isSelected, clickable, cls } = cell;
                                    return (
                                        <div
                                            key={key}
                                            ref={clickable ? (el) => {
                                                if (el) cellRefs.current.set(key, el);
                                                else cellRefs.current.delete(key);
                                            } : undefined}
                                            className={cls}
                                            role='gridcell'
                                            aria-label={cellLabel(year, month, count, era)}
                                            aria-selected={isSelected || undefined}
                                            tabIndex={clickable ? (key === rovingKeyResolved ? 0 : -1) : undefined}
                                            onClick={clickable ? () => onSelectYearMonth(isSelected ? null : key) : undefined}
                                            onKeyDown={clickable ? (e) => handleCellKeyDown(e, cell) : undefined}
                                            onFocus={() => { setFocusedKey(key); if (clickable) setRovingKey(key); }}
                                            onBlur={() => setFocusedKey(prev => prev === key ? null : prev)}
                                            onMouseEnter={() => setHoveredKey(key)}
                                            onMouseLeave={() => setHoveredKey(prev => prev === key ? null : prev)}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
                <div className='witness-life-heatmap-years'>
                    {displayColumns.map((col, i) => {
                        if (col.type === 'compressed') {
                            return <div key={`c-${col.startYear}`} className='year-slot year-slot-compressed' />;
                        }
                        return (
                            <div key={col.year} className='year-slot'>
                                {isLabeled(i) && <span className='year-label'>{col.year}</span>}
                            </div>
                        );
                    })}
                </div>
              </div>
            </div>
            <WitnessLifeHeatmapHover hoveredKey={activeKey} sourcesByYm={sourcesByYm} eraOf={eraOf} witness={witness} birthYear={birthYear} />
            {posthumous.length > 0 && (
                <div className='witness-life-posthumous' role='group'
                     aria-label={`Sources composed after ${witness.name}'s death`}>
                    <span className='posthumous-label'>After death</span>
                    <span className='posthumous-years'>
                        {[...new Set(posthumous.map(p => p.comp.year))].map(y => (
                            <span key={y} className='posthumous-year'>{y}</span>
                        ))}
                    </span>
                    <span className='posthumous-count'>
                        {posthumous.length} source{posthumous.length === 1 ? '' : 's'}
                    </span>
                </div>
            )}
            <div className='witness-life-heatmap-legend'>
                <span className='swatch era-event bucket-0' /> <span>witness event (Jun 1829)</span>
                <span className='swatch era-witness bucket-0' /> <span>empty</span>
                <span className='legend-ramp'>
                    <span className='legend-ramp-label'>fewer</span>
                    <span className='swatch era-witness bucket-1' role='img' aria-label='1 source' title='1 source' />
                    <span className='swatch era-witness bucket-2' role='img' aria-label='2–3 sources' title='2–3 sources' />
                    <span className='swatch era-witness bucket-3' role='img' aria-label='4–6 sources' title='4–6 sources' />
                    <span className='swatch era-witness bucket-4' role='img' aria-label='7+ sources' title='7+ sources' />
                    <span className='legend-ramp-label'>more</span>
                </span>
                {excommunicationOrdinal !== null && <><span className='swatch era-excommunication bucket-0' /> <span>excommunicated</span></>}
                <span className='swatch era-death bucket-0' /> <span>death month</span>
                <span className='swatch era-posthumous bucket-0' /> <span>posthumous</span>
                {shouldCompress && <><span className='swatch era-compressed' /> <span>compressed</span></>}
            </div>
        </div>
    );
};

const WitnessLifeHeatmapHover = ({ hoveredKey, sourcesByYm, eraOf, witness, birthYear }) => {
    if (!hoveredKey) {
        return <div className='witness-life-heatmap-hover witness-life-heatmap-hover-empty' aria-live='polite'>Hover a cell for details · click to filter</div>;
    }
    if (hoveredKey.startsWith('compressed:')) {
        const [a, b] = hoveredKey.slice('compressed:'.length).split('-').map(s => parseInt(s, 10));
        const span = b - a + 1;
        return (
            <div className='witness-life-heatmap-hover' aria-live='polite'>
                <span className='hover-date'>{a}–{b}</span>
                <span className='hover-count'>{span} empty years compressed</span>
                <span className='hover-era era-compressed'>· no sources, no events</span>
            </div>
        );
    }
    const [yearStr, monthStr] = hoveredKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const sources = sourcesByYm.get(hoveredKey) || [];
    const era = eraOf(year, month);
    const age = birthYear !== null ? year - birthYear : null;
    const ageSuffix = age !== null ? ` (age ${age})` : '';
    const eraTag = era === 'death' ? `${witness.name} died${ageSuffix}`
        : era === 'excommunication' ? `${witness.name} excommunicated${ageSuffix}`
        : era === 'event' ? `Three Witnesses event${ageSuffix}`
        : era === 'posthumous' ? 'posthumous' : null;

    return (
        <div className='witness-life-heatmap-hover' aria-live='polite'>
            <span className='hover-date'>{MONTHS_FULL[month - 1]} {year}</span>
            <span className='hover-count'>
                {sources.length === 0 ? 'no sources' : `${sources.length} source${sources.length === 1 ? '' : 's'}`}
            </span>
            {sources.length === 1 && sources[0].document && (
                <span className='hover-doc'>· {sources[0].document}</span>
            )}
            {eraTag && <span className={`hover-era era-${era}`}>· {eraTag}</span>}
        </div>
    );
};

export default WitnessLifeHeatmap;
