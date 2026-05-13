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

const WitnessLifeHeatmap = ({ witness, sources, selectedYearMonth, onSelectYearMonth }) => {

    const { yearStart, yearEnd, counts, totalMapped, undated } = useMemo(() => {
        const birth = parseYearMonth(witness?.birthday);
        const yearStart = birth ? birth.year : null;

        const counts = new Map();
        let yearEnd = null;
        let undated = 0;
        let totalMapped = 0;

        for (const src of sources || []) {
            const parsed = parseYearMonth(src.event_date || src.date);
            if (!parsed) { undated += 1; continue; }
            if (yearEnd === null || parsed.year > yearEnd) yearEnd = parsed.year;
            if (parsed.month) {
                const key = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
                counts.set(key, (counts.get(key) || 0) + 1);
                totalMapped += 1;
            }
        }

        return { yearStart, yearEnd, counts, totalMapped, undated };
    }, [witness?.birthday, sources]);

    if (!yearStart || yearEnd === null || yearEnd < yearStart) return null;

    const years = [];
    for (let y = yearStart; y <= yearEnd; y++) years.push(y);

    const labelEvery = years.length > 60 ? 10 : years.length > 30 ? 5 : 2;

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
            <div className='witness-life-heatmap-grid-wrap'>
                <div className='witness-life-heatmap-months'>
                    {MONTHS.map(m => <div key={m} className='month-label'>{m[0]}</div>)}
                </div>
                <div className='witness-life-heatmap-grid' style={{ gridTemplateColumns: `repeat(${years.length}, var(--bom-heatmap-cell, 8px))` }}>
                    {MONTHS.map((_, mi) => (
                        years.map((year) => {
                            const key = `${year}-${String(mi + 1).padStart(2, '0')}`;
                            const count = counts.get(key) || 0;
                            const isSelected = selectedYearMonth === key;
                            return (
                                <div
                                    key={key}
                                    className={`cell bucket-${colorBucket(count)}${isSelected ? ' selected' : ''}${count ? ' has-sources' : ''}`}
                                    title={count ? `${MONTHS[mi]} ${year}: ${count} source${count === 1 ? '' : 's'}` : `${MONTHS[mi]} ${year}: no sources`}
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
