import React, { useEffect, useMemo, useState } from "react";
import { MultiSelect } from "react-multi-select-component";
import { label } from 'src/models/Utils';

import "./Names.css";
import names, { facets } from "./data.js";
import { FIELD_DEFS, emptyFilters, applyFilters } from "./logic";

const FACET_META = {
  prefix: { label: "Prefix", options: facets.prefixes },
  stems: { label: "Stem", options: facets.stems },
  affix: { label: "Affix", options: facets.affixes },
  suffix: { label: "Suffix", options: facets.suffixes },
  cultures: { label: "Culture", options: facets.cultures },
  types: { label: "Type", options: facets.types },
};

function Container() {
  const [filters, setFilters] = useState(emptyFilters);
  useEffect(() => { document.title = "Names | " + label("home_title"); }, []);

  const filtered = useMemo(() => applyFilters(names, filters), [filters]);
  const hasSelection = FIELD_DEFS.some((f) => filters[f.key].length > 0);
  const setFacet = (key, values) => setFilters((prev) => ({ ...prev, [key]: values }));

  return (
    <div className="container namesView">
      <h3 className="title lg-4 text-center">Book of Mormon Names</h3>
      <FilterBar filters={filters} setFacet={setFacet} />
      <div className="nameFilterStatus">
        <span>{filtered.length === names.length ? `${names.length} names` : `${filtered.length} of ${names.length} names`}</span>
        {hasSelection && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setFilters(emptyFilters())}>
            Clear filters
          </button>
        )}
      </div>
      <div className="nameAnalysisList">
        {filtered.map((entry) => (
          <div key={entry.name} className="nameAnalysisItem" title={[...entry.cultures, ...entry.types].join(" · ")}>
            {entry.name}
          </div>
        ))}
        {!filtered.length && <div className="nameAnalysisEmpty">No names match the selected filters.</div>}
      </div>
    </div>
  );
}

function FilterBar({ filters, setFacet }) {
  return (
    <table className="nameform" style={{ width: "100%" }}>
      <thead>
        <tr>{FIELD_DEFS.map((f) => <th key={f.key}>{FACET_META[f.key].label}</th>)}</tr>
      </thead>
      <tbody>
        <tr>
          {FIELD_DEFS.map((f) => (
            <td key={f.key}>
              <FacetSelect
                facetKey={f.key}
                values={filters[f.key]}
                onChange={(vals) => setFacet(f.key, vals)}
              />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function FacetSelect({ facetKey, values, onChange }) {
  const meta = FACET_META[facetKey];
  const options = meta.options.map((v) => ({ label: v, value: v }));
  return (
    <div className="form-group">
      <MultiSelect
        options={options}
        value={values.map((v) => ({ label: v, value: v }))}
        onChange={(selected) => onChange(selected.map((o) => o.value))}
        labelledBy={meta.label}
      />
    </div>
  );
}

export default Container;
