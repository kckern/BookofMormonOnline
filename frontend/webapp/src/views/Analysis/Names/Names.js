import React, { useEffect, useMemo, useState } from "react";
import { MultiSelect } from "react-multi-select-component";
import { useHistory, useLocation } from "react-router-dom";
import { label } from 'src/models/Utils';

import "./Names.css";
import names, { facets } from "./data.js";
import { FIELD_DEFS, emptyFilters, applyFilters, facetCounts, filtersToQuery, queryToFilters } from "./logic";

/** label() returns the key when untranslated — fall back to English copy. */
const t = (key, fallback) => {
  const v = label(key);
  return !v || v === " " || v === key ? fallback : v;
};

const FACET_HELP = {
  prefix: "A short element attached to the front of a base name: Zeezrom = Ze~ + ezrom.",
  stems: "The core building block a family of names shares: Mormon, Moroni, and Morianton all carry Mor.",
  affix: "A linking element inside a name: Cor + iant + umr.",
  suffix: "A closing element: ~iah, ~ihah, ~om, ~um.",
  cultures: "The people a name belongs to, or the language its proposed origin comes from.",
  types: "What the name refers to: a person, place, measure of money, animal, plant…",
};

const FACET_META = {
  prefix: { label: "Prefix", options: facets.prefixes },
  stems: { label: "Stem", options: facets.stems },
  affix: { label: "Affix", options: facets.affixes },
  suffix: { label: "Suffix", options: facets.suffixes },
  cultures: { label: "Culture", options: facets.cultures },
  types: { label: "Type", options: facets.types },
};

function Container() {
  const history = useHistory();
  const location = useLocation();
  const [filters, setFilters] = useState(() => queryToFilters(location.search));
  useEffect(() => { document.title = "Names | " + label("home_title"); }, []);

  useEffect(() => {
    const q = filtersToQuery(filters);
    if (q !== location.search && !(q === "" && location.search === ""))
      history.replace({ pathname: location.pathname, search: q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const filtered = useMemo(() => applyFilters(names, filters), [filters]);
  const hasSelection = FIELD_DEFS.some((f) => filters[f.key].length > 0);
  const setFacet = (key, values) => setFilters((prev) => ({ ...prev, [key]: values }));

  return (
    <div className="container namesView">
      <h3 className="title lg-4 text-center">{t("names_title", "Book of Mormon Names")}</h3>
      <p className="namesIntro">
        {t("names_intro", "Every proper name in the Book of Mormon, broken into its building blocks. Filter by shared elements to see name families, or by culture to see who used them.")}
      </p>
      <FilterBar filters={filters} setFacet={setFacet} />
      <ChipRow facetKey="cultures" filters={filters} setFacet={setFacet} />
      <ChipRow facetKey="types" filters={filters} setFacet={setFacet} />
      <div className="nameFilterStatus">
        <span>
          {filtered.length === names.length
            ? t("names_count_all", `${names.length} names`)
            : t("names_count_filtered", `${filtered.length} of ${names.length} names`)}
        </span>
        {hasSelection && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setFilters(emptyFilters())}>
            {t("names_clear_filters", "Clear filters")}
          </button>
        )}
      </div>
      <div className="nameAnalysisList">
        {filtered.map((entry) => (
          <div key={entry.name} className="nameAnalysisItem" title={[...entry.cultures, ...entry.types].join(" · ")}>
            {entry.name}
          </div>
        ))}
        {!filtered.length && (
          <div className="nameAnalysisEmpty">
            {t("names_empty", "No names match the selected filters. Try removing the last filter you added.")}
          </div>
        )}
      </div>
    </div>
  );
}

const MORPHEME_FACETS = ["prefix", "stems", "affix", "suffix"];

function FilterBar({ filters, setFacet }) {
  const fields = FIELD_DEFS.filter((f) => MORPHEME_FACETS.includes(f.key));
  return (
    <table className="nameform" style={{ width: "100%" }}>
      <thead>
        <tr>
          {fields.map((f) => (
            <th key={f.key}>
              <span className="facetHeader" title={FACET_HELP[f.key]}>
                {FACET_META[f.key].label}
                <sup className="facetHelpMark" aria-hidden="true">?</sup>
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {fields.map((f) => (
            <td key={f.key}>
              <FacetSelect
                facetKey={f.key}
                values={filters[f.key]}
                filters={filters}
                onChange={(vals) => setFacet(f.key, vals)}
              />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function FacetSelect({ facetKey, values, filters, onChange }) {
  const meta = FACET_META[facetKey];
  const counts = useMemo(() => facetCounts(names, filters, facetKey), [filters, facetKey]);
  const options = useMemo(
    () =>
      [...meta.options]
        .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b))
        .map((v) => ({
          label: `${v} (${counts.get(v) || 0})`,
          value: v,
          disabled: !counts.get(v) && !values.includes(v),
        })),
    [counts, meta.options, values]
  );
  return (
    <div className="form-group">
      <MultiSelect
        options={options}
        value={values.map((v) => ({ label: v, value: v }))}
        onChange={(selected) => onChange(selected.map((o) => o.value))}
        labelledBy={meta.label}
        hasSelectAll={false}
      />
    </div>
  );
}

function ChipRow({ facetKey, filters, setFacet }) {
  const meta = FACET_META[facetKey];
  const counts = useMemo(() => facetCounts(names, filters, facetKey), [filters, facetKey]);
  const values = filters[facetKey];
  const toggle = (v) =>
    setFacet(facetKey, values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div className="nameChipRow" role="group" aria-label={meta.label}>
      <span className="nameChipRowLabel" title={FACET_HELP[facetKey]}>{meta.label}</span>
      {meta.options.map((v) => {
        const count = counts.get(v) || 0;
        const active = values.includes(v);
        return (
          <button
            key={v}
            type="button"
            className={"nameChip" + (active ? " active" : "")}
            disabled={!count && !active}
            aria-pressed={active}
            onClick={() => toggle(v)}
          >
            {v} <span className="nameChipCount">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Container;
