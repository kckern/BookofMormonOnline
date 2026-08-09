/** @format */
// Pure helpers: turn a history archive list into a display "COUNT · RANGE" signal.

export function deriveSignal(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return { count: 0, minYear: null, maxYear: null };
  }
  const years = list
    .map((d) => parseInt(d && d.year, 10))
    .filter((y) => Number.isFinite(y));
  return {
    count: list.length,
    minYear: years.length ? Math.min(...years) : null,
    maxYear: years.length ? Math.max(...years) : null,
  };
}

export function formatSignal(count, unit, minYear, maxYear) {
  if (!count) return null;
  const head = `${count} ${String(unit).toUpperCase()}`;
  if (minYear == null || maxYear == null) return head;
  const range = minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`;
  return `${head} · ${range}`;
}
