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
