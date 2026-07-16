import React, { useEffect, useMemo, useState } from "react";
import { MultiSelect } from "react-multi-select-component";
import { label } from 'src/models/Utils';

import "./Names.css";
import names, { facets } from "./data.js";

const asOptions = (values) => values.map((v) => ({ label: v, value: v }));

// One column per facet. `match` decides whether an entry survives that
// column's selection (selections within a column are OR; columns AND together).
const FIELDS = [
  { key: "prefix", label: "Prefix", options: asOptions(facets.prefixes), match: (entry, sel) => sel.includes(entry.prefix) },
  { key: "stems", label: "Stem", options: asOptions(facets.stems), match: (entry, sel) => entry.stems.some((s) => sel.includes(s)) },
  { key: "affix", label: "Affix", options: asOptions(facets.affixes), match: (entry, sel) => sel.includes(entry.affix) },
  { key: "suffix", label: "Suffix", options: asOptions(facets.suffixes), match: (entry, sel) => sel.includes(entry.suffix) },
  { key: "cultures", label: "Culture", options: asOptions(facets.cultures), match: (entry, sel) => entry.cultures.some((c) => sel.includes(c)) },
  { key: "types", label: "Type", options: asOptions(facets.types), match: (entry, sel) => entry.types.some((t) => sel.includes(t)) },
];

const emptyFilters = () => FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: [] }), {});

function Container() {
  const [filters, setFilters] = useState(emptyFilters);

  useEffect(() => { document.title = "Names | " + label("home_title"); }, []);

  const filtered = useMemo(
    () =>
      names.filter((entry) =>
        FIELDS.every(({ key, match }) => {
          const selected = filters[key].map((o) => o.value);
          return !selected.length || match(entry, selected);
        })
      ),
    [filters]
  );

  const hasSelection = FIELDS.some((f) => filters[f.key].length > 0);

  return (
    <div className="container">
      <h3
        className="title lg-4 text-center"
        style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexGrow: 0 }}
      >
        Book of Mormon Names
      </h3>
      <NamesForm filters={filters} setFilters={setFilters} />
      <div className="nameFilterStatus">
        <span>
          {filtered.length === names.length
            ? `${names.length} names`
            : `${filtered.length} of ${names.length} names`}
        </span>
        {hasSelection && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setFilters(emptyFilters())}
          >
            Clear filters
          </button>
        )}
      </div>
      <div className="nameAnalysisList">
        {filtered.map((entry) => (
          <div
            key={entry.name}
            className="nameAnalysisItem"
            title={[...entry.cultures, ...entry.types].join(" · ")}
          >
            {entry.name}
          </div>
        ))}
        {!filtered.length && (
          <div className="nameAnalysisEmpty">No names match the selected filters.</div>
        )}
      </div>
    </div>
  );
}

function NamesForm({ filters, setFilters }) {
  return (
    <table className="nameform" style={{ width: "100%" }}>
      <thead>
        <tr>
          {FIELDS.map((f) => (
            <th key={f.key}>{f.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {FIELDS.map((f) => (
            <td key={f.key}>
              <div className="form-group">
                <MultiSelect
                  options={f.options}
                  value={filters[f.key]}
                  onChange={(selected) => setFilters((prev) => ({ ...prev, [f.key]: selected }))}
                  labelledBy={f.label}
                />
              </div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export default Container;
