import { featuredWitness } from "./WitnessTile";

/**
 * What the feed's archive tiles already FEATURED, across the payloads on the
 * page (the first sample + every revealed batch): the witness statement slugs,
 * the principal the most recent one featured, the Joseph Smith statements, the
 * history documents, and the fax editions (featured and railed).
 */
export function featuredArchiveKeys(payloads) {
  const witnessSlugs = new Set();
  const jsSlugs = new Set();
  const historySlugs = new Set();
  const faxSlugs = new Set(); // editions featured (pages shown)
  const faxRailSlugs = new Set(); // editions listed in an "other editions" rail
  let lastPrincipal = null;
  (payloads || []).forEach((p) => {
    const fw = featuredWitness(p?.witnesses);
    if (fw) {
      if (fw.slug) witnessSlugs.add(fw.slug);
      lastPrincipal = fw.principal;
    }
    if (p?.josephSmith?.slug) jsSlugs.add(p.josephSmith.slug);
    if (p?.history?.slug) historySlugs.add(p.history.slug);
    if (p?.fax?.slug) faxSlugs.add(String(p.fax.slug));
    (p?.faxMore || []).forEach((e) => e?.slug && faxRailSlugs.add(String(e.slug)));
  });
  return { witnessSlugs, jsSlugs, historySlugs, faxSlugs, faxRailSlugs, lastPrincipal };
}

/**
 * Arrange a new infinite batch against what the feed already featured, so the
 * witness and Joseph Smith tiles never repeat a statement (blind audit
 * witness-H4, josephSmith-H1) and consecutive witness tiles feature different
 * people. The witness tile features the first quotable row, so the arrangement
 * lives in the payload — which is what the Home session persists, so Back
 * restores the very same tile. A batch with nothing new left drops that tile
 * (isReady false) rather than show a repeat. Untouched payloads are returned
 * as-is.
 */
// The fax rail keeps at least this many covers; below it, repeats are allowed
// (a short rail of fresh covers beats a tile with no "collection" row).
const RAIL_MIN = 3;

export function arrangeArchives(payload, { witnessSlugs, jsSlugs, historySlugs, faxSlugs, faxRailSlugs, lastPrincipal } = {}) {
  if (!payload) return payload;
  let out = payload;
  const rows = payload.witnesses;
  if (Array.isArray(rows) && rows.length) {
    const quotable = (x) => x?.principal && x?.moneyQuote;
    const fresh = (x) => quotable(x) && !witnessSlugs?.has(x.slug);
    const lead = rows.find((x) => fresh(x) && x.principal !== lastPrincipal) || rows.find(fresh) || null;
    if (lead !== featuredWitness(rows)) {
      out = { ...out, witnesses: lead ? [lead, ...rows.filter((x) => x !== lead)] : [] };
    }
  }
  if (payload.josephSmith?.slug && jsSlugs?.has(payload.josephSmith.slug)) out = { ...out, josephSmith: null };
  // history / fax: one document or edition featured once per feed (blind audit
  // history-H4, fax-H4); the rail prefers editions the feed hasn't listed yet
  if (payload.history?.slug && historySlugs?.has(payload.history.slug)) out = { ...out, history: null };
  if (payload.fax?.slug && faxSlugs?.has(String(payload.fax.slug))) out = { ...out, fax: null };
  if (Array.isArray(payload.faxMore) && payload.faxMore.length && (faxSlugs?.size || faxRailSlugs?.size)) {
    const notFeatured = payload.faxMore.filter((e) => !faxSlugs?.has(String(e?.slug)));
    const fresh = notFeatured.filter((e) => !faxRailSlugs?.has(String(e?.slug)));
    const rail = fresh.length >= RAIL_MIN ? fresh : notFeatured;
    if (rail.length !== payload.faxMore.length) out = { ...out, faxMore: rail };
  }
  return out;
}
