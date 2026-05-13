import React, { useMemo } from 'react';
import './WitnessLifeHeatmap.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

    const { yearStart, yearEnd, counts, totalMapped, undated, deathOrdinal, birthYear } = useMemo(() => {
        const birth = parseYearMonth(witness?.birthday);
        const death = parseYearMonth(witness?.deathday);
        const birthYear = birth?.year ?? null;

        const counts = new Map();
        let latestSourceYear = null;
        let undated = 0;
        let totalMapped = 0;

        for (const src of sources || []) {
            const parsed = parseYearMonth(src.event_date || src.date);
            if (!parsed) { undated += 1; continue; }
            if (parsed.year < HEATMAP_START_YEAR) continue;
            if (latestSourceYear === null || parsed.year > latestSourceYear) latestSourceYear = parsed.year;
            if (parsed.month) {
                counts.set(ymKey(parsed.year, parsed.month), (counts.get(ymKey(parsed.year, parsed.month)) || 0) + 1);
                totalMapped += 1;
            }
        }

        const yearStart = HEATMAP_START_YEAR;
        const yearEnd = Math.max(latestSourceYear ?? yearStart, death?.year ?? yearStart);
        const deathOrdinal = death && death.month ? ymOrdinal(death.year, death.month)
            : death ? ymOrdinal(death.year, 12) : null;

        return { yearStart, yearEnd, counts, totalMapped, undated, deathOrdinal, birthYear };
    }, [witness?.birthday, witness?.deathday, sources]);

    if (yearEnd < yearStart) return null;

    const years = [];
    for (let y = yearStart; y <= yearEnd; y++) years.push(y);

    const labelEvery = years.length > 60 ? 10 : years.length > 30 ? 5 : 2;

    const eraOf = (year, month) => {
        const ord = ymOrdinal(year, month);
        if (deathOrdinal !== null && ord === deathOrdinal) return 'death';
        if (deathOrdinal !== null && ord > deathOrdinal) return 'posthumous';
        return 'witness';
    };

    return (
        <div className='witness-life-heatmap'>
            <div className='witness-life-heatmap-meta'>
                <span>{yearStart}–{yearEnd}</span>
                <span className='dot'>·</span>
                <span>{totalMapped} of {sources.length} sources placed</span>
                {undated > 0 && <><span className='dot'>·</span><span>{undated} undated</span></>}
                {selectedYearMonth && (
                    <button className='witness-life-heatmap-clear' onClick={() => onSelectYearMonth(null)}>
                        Clear filter ({selectedYearMonth})
                    </button>
                )}
            </div>
            <div className='witness-life-heatmap-ages'>
                {years.map((y, i) => {
                    const age = birthYear !== null ? y - birthYear : null;
                    const show = i % labelEvery === 0 || i === years.length - 1;
                    return (
                        <div key={y} className='age-tick' style={{ visibility: show ? 'visible' : 'hidden' }}>
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
                <div className='witness-life-heatmap-grid' style={{ gridTemplateColumns: `repeat(${years.length}, var(--bom-heatmap-cell, 8px))` }}>
                    {MONTHS.map((_, mi) => (
                        years.map((year) => {
                            const month = mi + 1;
                            const key = ymKey(year, month);
                            const count = counts.get(key) || 0;
                            const isSelected = selectedYearMonth === key;
                            const era = eraOf(year, month);
                            const cls = [
                                'cell',
                                `era-${era}`,
                                `bucket-${colorBucket(count)}`,
                                isSelected ? 'selected' : '',
                                count ? 'has-sources' : '',
                            ].filter(Boolean).join(' ');
                            const eraLabel = era === 'death' ? ' · died' : era === 'posthumous' ? ' · posthumous' : '';
                            return (
                                <div
                                    key={key}
                                    className={cls}
                                    title={`${MONTHS[mi]} ${year}${eraLabel}: ${count ? `${count} source${count === 1 ? '' : 's'}` : 'no sources'}`}
                                    onClick={count ? () => onSelectYearMonth(isSelected ? null : key) : undefined}
                                />
                            );
                        })
                    ))}
                </div>
            </div>
            <div className='witness-life-heatmap-years'>
                {years.map((y, i) => (
                    <div key={y} className='year-label' style={{ visibility: (i % labelEvery === 0 || i === years.length - 1) ? 'visible' : 'hidden' }}>{y}</div>
                ))}
            </div>
            <div className='witness-life-heatmap-legend'>
                <span className='swatch era-witness bucket-0' /> <span>empty</span>
                <span className='swatch era-witness bucket-2' /> <span>1–3 sources</span>
                <span className='swatch era-witness bucket-4' /> <span>7+ sources</span>
                <span className='swatch era-death bucket-0' /> <span>death month</span>
                <span className='swatch era-posthumous bucket-0' /> <span>posthumous</span>
            </div>
        </div>
    );
};

export const matchesYearMonth = (source, yearMonth) => {
    if (!yearMonth) return true;
    const parsed = parseYearMonth(source.event_date || source.date);
    if (!parsed || !parsed.month) return false;
    return `${parsed.year}-${String(parsed.month).padStart(2, '0')}` === yearMonth;
};

export default WitnessLifeHeatmap;
