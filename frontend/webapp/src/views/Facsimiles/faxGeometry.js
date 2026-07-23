/**
 * The fax `item` object carries the front-matter page offset under an
 * ambiguous key — some records use `pgOffset`, some `pgoffset`. Resolve to a
 * single non-negative integer. (Audit §2.16.)
 */
export function resolvePgOffset(item) {
  const raw = item && (item.pgOffset != null ? item.pgOffset : item.pgoffset);
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
