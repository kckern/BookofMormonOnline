import React, { useMemo, useState } from "react";
import "./WitnessLifeStrip.css";

const HEATMAP_START_YEAR = 1829;
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const parseYearMonth = (dateStr) => {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})(?:-(\d{2}))?/);
  if (!m) return null;
  return { year: parseInt(m[1], 10), month: m[2] ? parseInt(m[2], 10) : null };
};

export const colorBucket = (count) => {
  if (!count) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
};

export const buildYearBuckets = (sources, witness) => {
  const death = parseYearMonth(witness?.deathday);
  const excom = parseYearMonth(witness?.excommunication);
  const maxReasonableYear = new Date().getFullYear() + 5;
  const byYear = new Map();
  let latestSourceYear = null;
  let undated = 0;
  for (const s of sources || []) {
    const p = parseYearMonth(s.date);
    if (!p || p.year < HEATMAP_START_YEAR || p.year > maxReasonableYear) { undated += 1; continue; }
    byYear.set(p.year, (byYear.get(p.year) || 0) + 1);
    if (latestSourceYear === null || p.year > latestSourceYear) latestSourceYear = p.year;
  }
  const yearStart = HEATMAP_START_YEAR;
  const yearEnd = Math.max(latestSourceYear ?? yearStart, death?.year ?? yearStart);
  const years = [];
  for (let y = yearStart; y <= yearEnd; y++) years.push(y);
  return {
    years, byYear, undated,
    deathYear: death?.year ?? null,
    excomYear: excom?.year ?? null,
    total: [...byYear.values()].reduce((a, b) => a + b, 0),
  };
};

export const monthChipsForYear = (sources, year) => {
  const counts = new Map();
  for (const s of sources || []) {
    const p = parseYearMonth(s.date);
    if (!p || p.year !== year || !p.month) continue;
    counts.set(p.month, (counts.get(p.month) || 0) + 1);
  }
  return [...counts.keys()].sort((a, b) => a - b).map((month) => ({ month, count: counts.get(month) }));
};

export const matchesYearMonth = (source, key) => {
  if (!key) return true;
  const p = parseYearMonth(source.date);
  if (!p) return false;
  if (/^\d{4}$/.test(key)) return String(p.year) === key;
  if (!p.month) return false;
  return `${p.year}-${String(p.month).padStart(2, "0")}` === key;
};

export { MONTHS_FULL };

const ymKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

export default function WitnessLifeStrip({ witness, sources, selectedYearMonth, onSelectYearMonth }) {
  const { years, byYear, deathYear, excomYear, total, undated } = useMemo(
    () => buildYearBuckets(sources, witness), [sources, witness]
  );
  const activeYear = selectedYearMonth ? parseInt(String(selectedYearMonth).slice(0, 4), 10) : null;
  const [openYear, setOpenYear] = useState(activeYear);
  const [hover, setHover] = useState(null);

  if (!years.length) return null;
  const shownYear = openYear ?? activeYear;
  const chips = shownYear ? monthChipsForYear(sources, shownYear) : [];
  const birthYear = (witness?.birthday && /^\d{4}/.test(witness.birthday)) ? parseInt(witness.birthday.slice(0, 4), 10) : null;

  const onYearClick = (year) => {
    const has = (byYear.get(year) || 0) > 0;
    if (!has) return;
    if (shownYear === year) { setOpenYear(null); onSelectYearMonth(null); }
    else { setOpenYear(year); onSelectYearMonth(String(year)); }
  };

  return (
    <div className='witness-life-strip'>
      <div className='wls-head'>
        <span>{total} of {sources.length} placed</span>
        {undated > 0 && <span className='wls-dot'>· {undated} undated</span>}
        <span className='wls-key' aria-hidden='true'>
          less
          <i className='wls-sw bucket-1' /><i className='wls-sw bucket-2' /><i className='wls-sw bucket-3' /><i className='wls-sw bucket-4' />
          more
        </span>
      </div>
      <div className='wls-track'>
        {years.map((year) => {
          const count = byYear.get(year) || 0;
          const isDeath = year === deathYear;
          const isExcom = year === excomYear;
          const cls = `wls-year bucket-${colorBucket(count)}${count ? ' has' : ''}${shownYear === year ? ' active' : ''}`;
          return (
            <button
              key={year}
              type='button'
              className={cls}
              disabled={!count}
              onClick={() => onYearClick(year)}
              onMouseEnter={(e) => setHover({ year, x: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2 })}
              onMouseLeave={() => setHover((h) => (h && h.year === year ? null : h))}
            >
              {isDeath && <span className='wls-mark wls-death' aria-hidden='true'>✝</span>}
              {isExcom && !isDeath && <span className='wls-mark wls-excom' aria-hidden='true'>×</span>}
            </button>
          );
        })}
        {hover && (
          <div className='wls-tip' style={{ left: `${hover.x}px` }}>
            <b>{hover.year}</b>
            {' · '}{(byYear.get(hover.year) || 0)} source{(byYear.get(hover.year) || 0) === 1 ? '' : 's'}
            {hover.year === deathYear && <span className='wls-tip-era death'> · died{birthYear ? ` (age ${hover.year - birthYear})` : ''}</span>}
            {hover.year === excomYear && hover.year !== deathYear && <span className='wls-tip-era excom'> · excommunicated</span>}
          </div>
        )}
      </div>
      <div className='wls-axis'>
        <span>{years[0]}</span>
        <span>{years[years.length - 1]}</span>
      </div>
      {chips.length > 0 && (
        <div className='wls-chips'>
          {chips.map(({ month, count }) => {
            const key = ymKey(shownYear, month);
            return (
              <button
                key={key}
                type='button'
                className={`wls-chip${selectedYearMonth === key ? ' active' : ''}`}
                onClick={() => onSelectYearMonth(selectedYearMonth === key ? String(shownYear) : key)}
              >
                {MONTHS_FULL[month - 1].slice(0, 3)}{count > 1 ? ` ·${count}` : ''}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
