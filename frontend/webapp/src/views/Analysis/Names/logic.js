// logic.js — pure logic for the Names view. No React imports here, ever.

/** Facet definitions: state key, entry accessor, singular querystring key. */
export const FIELD_DEFS = [
  { key: "prefix", qs: "prefix", get: (e) => (e.prefix ? [e.prefix] : []) },
  { key: "stems", qs: "stem", get: (e) => e.stems },
  { key: "affix", qs: "affix", get: (e) => (e.affix ? [e.affix] : []) },
  { key: "suffix", qs: "suffix", get: (e) => (e.suffix ? [e.suffix] : []) },
  { key: "cultures", qs: "culture", get: (e) => e.cultures },
  { key: "types", qs: "type", get: (e) => e.types },
];

export const emptyFilters = () =>
  FIELD_DEFS.reduce((acc, f) => ({ ...acc, [f.key]: [] }), {});

const matchesField = (entry, field, selected) =>
  !selected.length || field.get(entry).some((v) => selected.includes(v));

export const applyFilters = (names, filters) =>
  names.filter((entry) =>
    FIELD_DEFS.every((field) => matchesField(entry, field, filters[field.key]))
  );

/** Counts for one facet, computed with that facet's own selection ignored. */
export const facetCounts = (names, filters, facetKey) => {
  const others = { ...filters, [facetKey]: [] };
  const pool = applyFilters(names, others);
  const field = FIELD_DEFS.find((f) => f.key === facetKey);
  const counts = new Map();
  for (const entry of pool)
    for (const v of field.get(entry)) counts.set(v, (counts.get(v) || 0) + 1);
  return counts;
};

const strip = (s) => (s || "").replace(/~/g, "");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Segment a name into [{text, role}] spans (roles: prefix|stem|affix|sep|suffix)
 * by matching prefix + stem1 + affix + stem2 + suffix against the real string,
 * case-insensitively, allowing a single separator char (- or ') between parts.
 * Returns null when the morphemes don't reconstruct the name.
 */
export const segmentName = (entry) => {
  const parts = [];
  if (entry.prefix) parts.push({ role: "prefix", m: strip(entry.prefix) });
  parts.push({ role: "stem", m: strip(entry.stems[0] || "") });
  if (entry.affix) parts.push({ role: "affix", m: strip(entry.affix) });
  if (entry.stems[1]) parts.push({ role: "stem", m: strip(entry.stems[1]) });
  if (entry.suffix) parts.push({ role: "suffix", m: strip(entry.suffix) });

  const pattern = "^" + parts.map((p) => `([-']?)(${esc(p.m)})`).join("") + "$";
  const match = entry.name.match(new RegExp(pattern, "i"));
  if (!match) return null;

  const spans = [];
  let g = 1;
  for (const p of parts) {
    const sep = match[g++];
    const text = match[g++];
    if (sep) spans.push({ text: sep, role: "sep" });
    spans.push({ text, role: p.role });
  }
  return spans;
};

export const filtersToQuery = (filters) => {
  const p = new URLSearchParams();
  for (const f of FIELD_DEFS)
    if (filters[f.key].length) p.set(f.qs, filters[f.key].join(","));
  const s = p.toString();
  return s ? "?" + s : "";
};

export const queryToFilters = (search) => {
  const p = new URLSearchParams(search);
  const filters = emptyFilters();
  for (const f of FIELD_DEFS) {
    const raw = p.get(f.qs);
    if (raw) filters[f.key] = raw.split(",").filter(Boolean);
  }
  return filters;
};

const baseName = (n) => n.replace(/\d+$/, "").trim().toLowerCase();

/** Find person/place slugs for a name in the app's cached entity maps. */
export const entitySlugs = (name, personMap, placeMap) => {
  const target = name.toLowerCase();
  let person = null, place = null;
  for (const p of Object.values(personMap || {}))
    if (baseName(p.name) === target) { person = p.slug; break; }
  for (const p of Object.values(placeMap || {})) {
    const full = baseName(p.name);
    const last = full.split(" ").pop();
    if (full === target || last === target) { place = p.slug; break; }
  }
  return { person, place };
};
