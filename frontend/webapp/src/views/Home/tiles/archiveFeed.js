import { featuredWitness } from "./WitnessTile";

/**
 * What the feed's archive tiles already FEATURED, across the payloads on the
 * page (the first sample + every revealed batch): the witness statement slugs,
 * the principal the most recent one featured, and the Joseph Smith statements.
 */
export function featuredArchiveKeys(payloads) {
  const witnessSlugs = new Set();
  const jsSlugs = new Set();
  let lastPrincipal = null;
  (payloads || []).forEach((p) => {
    const fw = featuredWitness(p?.witnesses);
    if (fw) {
      if (fw.slug) witnessSlugs.add(fw.slug);
      lastPrincipal = fw.principal;
    }
    if (p?.josephSmith?.slug) jsSlugs.add(p.josephSmith.slug);
  });
  return { witnessSlugs, jsSlugs, lastPrincipal };
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
export function arrangeArchives(payload, { witnessSlugs, jsSlugs, lastPrincipal } = {}) {
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
  return out;
}
