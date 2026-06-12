// Pure helpers for page-comment count assembly. com/img counts come from the
// backend (pagecomments query, spec P1); facsimile counts derive purely from
// the message index (no location lookup), so they stay client-side.

// index.fax keys look like "<verseNum>.<version>" — group versions by verse.
export function countFaxFromIndex(index) {
  const counts = {};
  const fax = index?.fax || {};
  for (const key of Object.keys(fax)) {
    const [num, ver] = key.split(".");
    if (!counts[num]) counts[num] = {};
    if (!counts[num].fax) counts[num].fax = [];
    counts[num].fax.push(ver);
  }
  return counts;
}

// Merge per-verse count objects ({num: {com/img/fax: []}}); later sources
// add keys to existing verses without clobbering.
export function mergeCounts(...sources) {
  const out = {};
  for (const src of sources) {
    if (!src) continue;
    for (const num of Object.keys(src)) {
      out[num] = { ...(out[num] || {}), ...src[num] };
    }
  }
  return out;
}
