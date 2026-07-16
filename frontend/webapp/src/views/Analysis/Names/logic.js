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
