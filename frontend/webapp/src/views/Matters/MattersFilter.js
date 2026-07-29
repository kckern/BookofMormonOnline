/** @format */

import React from "react";
import { label } from "src/models/Utils";
import { filterAxes } from "./mattersFilterData";
import { MatterDetailColumn } from "./MatterDetailColumn";
import { useAppController } from "src/contexts/AppControllerContext";
import FilterPanel from "src/views/_Common/FilterPanel/FilterPanel";

/**
 * Matters filter — three switch columns over the redesigned bom_matters vocabulary.
 *
 *   Era & Culture (left)   6 values, era + provenance merged (58% redundant)
 *   Kind          (middle) 5 form groups
 *   dynamic slot  (right)  Prominence (4 nrefs buckets) by default; the instant
 *                          a Kind is on, it swaps to <MatterDetailColumn> — form
 *                          switches with per-form subform chips — passed to
 *                          FilterPanel via its extraColumn slot. Prominence is
 *                          gone while a Kind is active.
 */
/**
 * Translate with a real fallback.
 *
 * Utils.label() returns the KEY itself when the dictionary has no entry, and
 * " " before the dictionary loads — both truthy, so the usual
 * `label(key) || fallback` never falls back and the UI renders raw keys like
 * "matter_form_living_world". These keys are not in the dictionary yet.
 */
const t = (key, fallback) => {
  const v = label(key);
  if (!v || v === key || !String(v).trim()) return fallback;
  return v;
};

export function MattersFilter({ matterFilters, setFilter, matterList }) {
  const appController = useAppController();

  const byName = Object.fromEntries(filterAxes.map((a) => [a.name, a]));
  const kindActive = (matterFilters.form_group?.size ?? 0) > 0;

  // Right column is Prominence until a Kind is on, then the detail column.
  const shown = kindActive
    ? [byName.era_culture, byName.form_group]
    : [byName.era_culture, byName.form_group, byName.prominence];

  const axes = shown.map((a) => ({
    name: a.name,
    title: t(a.title, a.titleEn),
    options: a.chips.map((c) => ({ tag: c.tag, label: t(c.key, c.label) })),
  }));

  const axisNames = shown.map((a) => a.name);
  const value = Object.fromEntries(axisNames.map((n) => [n, [...(matterFilters[n] || [])]]));

  const onChange = (next) =>
    setFilter({
      ...matterFilters,
      ...Object.fromEntries(axisNames.map((n) => [n, new Set(next[n] || [])])),
    });

  const extraColumn = kindActive ? (
    <MatterDetailColumn matterFilters={matterFilters} setFilter={setFilter} />
  ) : null;

  const selectItemHandler = (slug) =>
    appController.functions.setPopUp({ type: "matters", ids: [slug], underSlug: "matters" });

  return (
    <FilterPanel
      heading={label("selectors")}
      axes={axes}
      value={value}
      onChange={onChange}
      extraColumn={extraColumn}
      search={{
        placeholder: "search_for_a_matter",
        preLoadData: matterList,
        testFieldNames: { primary: "name", secondary: "subtitle" },
        assetName: "matters",
        selectItemHandler,
      }}
    />
  );
}
