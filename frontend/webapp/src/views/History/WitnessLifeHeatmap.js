import React, { useEffect, useMemo, useRef, useState } from 'react';
import './WitnessLifeHeatmap.css';

const CELL_PX_MAX = 10;
const CELL_PX_MIN = 4;
const GAP_PX = 1;
const MONTHS_COL_PX = 14;
const SIDE_PADDING_PX = 4;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const parseYearMonth = (dateStr) => {
    if (!dateStr) return null;
    const m = String(dateStr).match(/^(\d{4})(?:-(\d{2}))?/);
    if (!m) return null;
    const year = parseInt(m[1], 10);
    const month = m[2] ? parseInt(m[2], 10) : null;
    return { year, month };
};

const colorBucket = (count) => {
    if (!count) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 6) return 3;
    return 4;
};

const HEATMAP_START_YEAR = 1829;

const ymKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
const ymOrdinal = (year, month) => year * 12 + (month - 1);

const WitnessLifeHeatmap = ({ witness, sources, selectedYearMonth, onSelectYearMonth }) => {

    const [hoveredKey, setHoveredKey] = useState(null);
    const wrapperRef = useRef(null);
    const [wrapperWidth, setWrapperWidth] = useState(0);

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

    const { yearStart, yearEnd, sourcesByYm, totalMapped, undated, deathOrdinal, excommunicationOrdinal, birthYear } = useMemo(() => {
        const birth = parseYearMonth(witness?.birthday);
        const death = parseYearMonth(witness?.deathday);
        const excom = parseYearMonth(witness?.excommunication);
        const birthYear = birth?.year ?? null;

        const sourcesByYm = new Map();
        let latestSourceYear = null;
        let undated = 0;
        let totalMapped = 0;

        const maxReasonableYear = new Date().getFullYear() + 5;
        for (const src of sources || []) {
            const parsed = parseYearMonth(src.date);
            if (!parsed) { undated += 1; continue; }
            if (parsed.year < HEATMAP_START_YEAR || parsed.year > maxReasonableYear) { undated += 1; continue; }
            if (latestSourceYear === null || parsed.year > latestSourceYear) latestSourceYear = parsed.year;
            if (parsed.month) {
                const key = ymKey(parsed.year, parsed.month);
                if (!sourcesByYm.has(key)) sourcesByYm.set(key, []);
                sourcesByYm.get(key).push(src);
                totalMapped += 1;
            }
        }

        const yearStart = HEATMAP_START_YEAR;
        const yearEnd = Math.max(latestSourceYear ?? yearStart, death?.year ?? yearStart);
        const deathOrdinal = death && death.month ? ymOrdinal(death.year, death.month)
            : death ? ymOrdinal(death.year, 12) : null;
        const excommunicationOrdinal = excom && excom.month ? ymOrdinal(excom.year, excom.month)
            : excom ? ymOrdinal(excom.year, 12) : null;

        return { yearStart, yearEnd, sourcesByYm, totalMapped, undated, deathOrdinal, excommunicationOrdinal, birthYear };
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

    const widthFor = (cols) => {
        if (!wrapperWidth) return CELL_PX_MAX;
        const available = wrapperWidth - MONTHS_COL_PX - SIDE_PADDING_PX * 2;
        return Math.max(CELL_PX_MIN, Math.min(CELL_PX_MAX, Math.floor(available / cols.length) - GAP_PX));
    };
    const uncompressedCellPx = widthFor(uncompressedColumns);
    const canCompress = compressedColumns.length < uncompressedColumns.length;
    const shouldCompress = wrapperWidth > 0 && canCompress && uncompressedCellPx < COMFORT_CELL_PX;
    const displayColumns = shouldCompress ? compressedColumns : uncompressedColumns;

    const cellPx = widthFor(displayColumns);

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

    return (
        <div className='witness-life-heatmap' ref={wrapperRef} style={{ '--bom-heatmap-cell': `${cellPx}px` }}>
            <div className='witness-life-heatmap-meta'>
                <span>{yearStart}–{yearEnd}</span>
                <span className='dot'>·</span>
                <span>{totalMapped} of {sources.length} sources placed</span>
                {undated > 0 && <><span className='dot'>·</span><span>{undated} undated</span></>}
                {shouldCompress && (
                    <><span className='dot'>·</span><span className='witness-life-heatmap-compressed-note'>
                        {years.length - displayColumns.length} empty years compressed
                    </span></>
                )}
                {selectedYearMonth && (
                    <button className='witness-life-heatmap-clear' onClick={() => onSelectYearMonth(null)}>
                        Clear filter ({selectedYearMonth})
                    </button>
                )}
            </div>
            <div className='witness-life-heatmap-scroll'>
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
                    <div className='witness-life-heatmap-grid' style={{ gridTemplateColumns: `repeat(${displayColumns.length}, var(--bom-heatmap-cell, 8px))` }}>
                        {MONTHS.map((_, mi) => (
                            displayColumns.map((col) => {
                                const month = mi + 1;
                                if (col.type === 'compressed') {
                                    const compKey = `compressed:${col.startYear}-${col.endYear}`;
                                    return (
                                        <div
                                            key={`${compKey}-${month}`}
                                            className='cell era-compressed'
                                            onMouseEnter={() => setHoveredKey(compKey)}
                                            onMouseLeave={() => setHoveredKey(prev => prev === compKey ? null : prev)}
                                        />
                                    );
                                }
                                const year = col.year;
                                const key = ymKey(year, month);
                                const cellSources = sourcesByYm.get(key) || [];
                                const count = cellSources.length;
                                const isSelected = selectedYearMonth === key;
                                const era = eraOf(year, month);
                                const isMarker = era === 'death' || era === 'excommunication' || era === 'event';
                                const cls = [
                                    'cell',
                                    `era-${era}`,
                                    `bucket-${colorBucket(count)}`,
                                    isSelected ? 'selected' : '',
                                    count || isMarker ? 'has-sources' : '',
                                ].filter(Boolean).join(' ');
                                return (
                                    <div
                                        key={key}
                                        className={cls}
                                        onClick={count ? () => onSelectYearMonth(isSelected ? null : key) : undefined}
                                        onMouseEnter={() => setHoveredKey(key)}
                                        onMouseLeave={() => setHoveredKey(prev => prev === key ? null : prev)}
                                    />
                                );
                            })
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
            <WitnessLifeHeatmapHover hoveredKey={hoveredKey} sourcesByYm={sourcesByYm} eraOf={eraOf} witness={witness} birthYear={birthYear} />
            <div className='witness-life-heatmap-legend'>
                <span className='swatch era-event bucket-0' /> <span>witness event (Jun 1829)</span>
                <span className='swatch era-witness bucket-0' /> <span>empty</span>
                <span className='swatch era-witness bucket-2' /> <span>1–3 sources</span>
                <span className='swatch era-witness bucket-4' /> <span>7+ sources</span>
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
        return <div className='witness-life-heatmap-hover witness-life-heatmap-hover-empty'>Hover a cell for details · click to filter</div>;
    }
    if (hoveredKey.startsWith('compressed:')) {
        const [a, b] = hoveredKey.slice('compressed:'.length).split('-').map(s => parseInt(s, 10));
        const span = b - a + 1;
        return (
            <div className='witness-life-heatmap-hover'>
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
        <div className='witness-life-heatmap-hover'>
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

export const matchesYearMonth = (source, yearMonth) => {
    if (!yearMonth) return true;
    const parsed = parseYearMonth(source.date);
    if (!parsed || !parsed.month) return false;
    return `${parsed.year}-${String(parsed.month).padStart(2, '0')}` === yearMonth;
};

export default WitnessLifeHeatmap;
