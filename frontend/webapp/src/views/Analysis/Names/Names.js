import React, { useEffect, useMemo, useState } from "react";
import { MultiSelect } from "react-multi-select-component";
import { useHistory, useLocation } from "react-router-dom";
import { label } from 'src/models/Utils';
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { useAppController } from "src/contexts/AppControllerContext";

import "./Names.css";
import names, { facets } from "./data.js";
import { FIELD_DEFS, emptyFilters, applyFilters, facetCounts, filtersToQuery, queryToFilters, segmentName, entitySlugs } from "./logic";

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
  const appController = useAppController();
  const [filters, setFilters] = useState(() => queryToFilters(location.search));
  const [detailName, setDetailName] = useState(() => new URLSearchParams(location.search).get("name"));
  const [entities, setEntities] = useState({ people: null, places: null });
  const [showStructure, setShowStructure] = useState(true);
  // Filters start open on desktop, collapsed on narrow screens.
  const [filtersOpen, setFiltersOpen] = useState(
    () => typeof window.matchMedia !== "function" || window.matchMedia("(min-width: 768px)").matches
  );
  useEffect(() => { document.title = "Names | " + label("home_title"); }, []);

  useEffect(() => {
    BoMOnlineAPI({ personList: true, placeList: true }).then((r) =>
      setEntities({ people: r.personList || {}, places: r.placeList || {} })
    );
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(filtersToQuery(filters));
    if (detailName) p.set("name", detailName);
    const s = p.toString();
    const q = s ? "?" + s : "";
    if (q !== location.search) history.replace({ pathname: location.pathname, search: q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, detailName]);

  const detailEntry = useMemo(() => names.find((n) => n.name === detailName) || null, [detailName]);

  const filtered = useMemo(() => applyFilters(names, filters), [filters]);
  const hasSelection = FIELD_DEFS.some((f) => filters[f.key].length > 0);
  const activeCount = FIELD_DEFS.reduce((n, f) => n + filters[f.key].length, 0);
  const setFacet = (key, values) => setFilters((prev) => ({ ...prev, [key]: values }));

  const pickMorpheme = (role, entry) => {
    const map = { prefix: ["prefix", entry.prefix], affix: ["affix", entry.affix], suffix: ["suffix", entry.suffix] };
    if (role === "stem") setFacet("stems", [...new Set([...filters.stems, ...entry.stems])]);
    else if (map[role] && map[role][1]) setFacet(map[role][0], [...new Set([...filters[map[role][0]], map[role][1]])]);
  };

  return (
    <div className="container namesView">
      <h3 className="title lg-4 text-center">{t("names_title", "Book of Mormon Names")}</h3>
      <p className="namesIntro">
        {t("names_intro", "Every proper name in the Book of Mormon, broken into its building blocks. Filter by shared elements to see name families, or by culture to see who used them.")}
      </p>
      <details className="nameFilters" open={filtersOpen} onToggle={(e) => setFiltersOpen(e.target.open)}>
        <summary className="nameFiltersSummary">
          {t("names_filters", "Filters")}{activeCount ? ` (${activeCount})` : ""}
        </summary>
        <FilterBar filters={filters} setFacet={setFacet} />
        <ChipRow facetKey="cultures" filters={filters} setFacet={setFacet} />
        <ChipRow facetKey="types" filters={filters} setFacet={setFacet} />
      </details>
      <div className="nameFilterStatus">
        <span>
          {filtered.length === names.length
            ? t("names_count_all", `${names.length} names`)
            : t("names_count_filtered", `${filtered.length} of ${names.length} names`)}
        </span>
        <span className="nameFilterStatusRight">
          <label className="structureToggle">
            <input
              type="checkbox"
              checked={showStructure}
              onChange={(e) => setShowStructure(e.target.checked)}
            />
            {t("names_show_structure", "Show structure")}
          </label>
          {showStructure && (
            <span className="morphemeLegend" aria-hidden="true">
              {MORPHEME_ROLES.map((r) => (
                <span key={r} className={"morpheme-" + r}>{r}</span>
              ))}
            </span>
          )}
          {hasSelection && (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setFilters(emptyFilters())}>
              {t("names_clear_filters", "Clear filters")}
            </button>
          )}
        </span>
      </div>
      {detailEntry && (
        <NameDetail
          entry={detailEntry}
          entities={entities}
          appController={appController}
          onClose={() => setDetailName(null)}
          onPickMorpheme={pickMorpheme}
        />
      )}
      <div className="nameAnalysisList">
        {filtered.map((entry) => (
          <button
            type="button"
            key={entry.name}
            className={"nameAnalysisItem" + (detailName === entry.name ? " selected" : "")}
            aria-label={entry.name}
            onClick={() => setDetailName(entry.name === detailName ? null : entry.name)}
          >
            {showStructure && SEGMENTS.get(entry.name)
              ? SEGMENTS.get(entry.name).map((s, i) => (
                  <span key={i} className={"morpheme-" + s.role}>{s.text}</span>
                ))
              : entry.name}
          </button>
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
    <table className="nameform">
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

const CULTURE_BADGE = { Nephite: "N", Lamanite: "L", Jaredite: "J", Mulekite: "M", Israelite: "I" };

/** Segmentation is static per dataset — compute once at module load. */
const SEGMENTS = new Map(names.map((n) => [n.name, segmentName(n)]));

const MORPHEME_ROLES = ["prefix", "stem", "affix", "suffix"];

function NameDetail({ entry, entities, appController, onClose, onPickMorpheme }) {
  const spans = segmentName(entry);
  const slugs = entitySlugs(entry.name, entities.people, entities.places);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const openEntity = (type, slug) =>
    appController.functions.setPopUp({ type, ids: [slug], underSlug: type });

  return (
    <div className="nameDetail" role="region" aria-label={entry.name}>
      <div className="nameDetailHeader">
        <span className="nameDetailName">
          {spans
            ? spans.map((s, i) =>
                s.role === "sep" ? (
                  <span key={i}>{s.text}</span>
                ) : (
                  <button
                    key={i}
                    type="button"
                    className={"morpheme morpheme-" + s.role}
                    title={t("names_filter_by_part", "Filter by this part")}
                    onClick={() => onPickMorpheme(s.role, entry)}
                  >
                    {s.text}
                  </button>
                )
              )
            : entry.name}
        </span>
        <button type="button" className="nameDetailClose" aria-label={t("names_close", "Close")} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="nameDetailBadges">
        {entry.cultures.map((c) => (
          <span key={c} className={"IdBadge " + (CULTURE_BADGE[c] || "lang")}>{c}</span>
        ))}
        {entry.types.map((tp) => (
          <span key={tp} className="nameTypeBadge">{tp}</span>
        ))}
      </div>
      {entry.note && <p className="nameDetailNote">{entry.note}</p>}
      <div className="nameDetailLinks">
        {slugs.person && entry.types.includes("person") && (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openEntity("people", slugs.person)}>
            {t("names_view_person", "View person")}
          </button>
        )}
        {slugs.place && entry.types.includes("place") && (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openEntity("places", slugs.place)}>
            {t("names_view_place", "View place")}
          </button>
        )}
      </div>
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
