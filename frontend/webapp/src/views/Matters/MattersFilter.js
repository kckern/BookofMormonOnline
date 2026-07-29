/** @format */

import React from "react";
import { label } from "src/models/Utils";
import { filterAxes } from "./mattersFilterData";
import { useAppController } from "src/contexts/AppControllerContext";
import FilterPanel from "src/views/_Common/FilterPanel/FilterPanel";

/**
 * Matters filter — three on/off switch axes in the selector box, matching the
 * People and Places panels:
 *
 *   form_group   5 — Natural World, Made Things, Society, Places, Belief & Mind
 *   era_culture  6 — era + provenance merged; they were 58% redundant
 *   prominence   4 — buckets over nrefs
 *
 * The levels beneath these (form, then subform) are NOT in the box. They render
 * as chips between the box and the tile grid — see MatterChipLevels.
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

  const axes = filterAxes.map((a) => ({
    name: a.name,
    title: t(a.title, a.titleEn),
    options: a.chips.map((c) => ({ tag: c.tag, label: t(c.key, c.label) })),
  }));

  const axisNames = filterAxes.map((a) => a.name);
  const value = Object.fromEntries(axisNames.map((n) => [n, [...(matterFilters[n] || [])]]));

  const onChange = (next) =>
    setFilter({
      ...matterFilters,
      ...Object.fromEntries(axisNames.map((n) => [n, new Set(next[n] || [])])),
    });

  const selectItemHandler = (slug) =>
    appController.functions.setPopUp({ type: "matters", ids: [slug], underSlug: "matters" });

  return (
    <FilterPanel
      heading={label("selectors")}
      axes={axes}
      value={value}
      onChange={onChange}
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
