/** @format */

import React from "react";
import { label } from "src/models/Utils";
import { filterAxes, SUBFORM_AXIS } from "./mattersFilterData";
import { useAppController } from "src/contexts/AppControllerContext";
import FilterPanel from "src/views/_Common/FilterPanel/FilterPanel";

/**
 * Matters filter — three axes over the redesigned bom_matters vocabulary.
 *
 *   form        two-level: 5 groups / 17 chips, plus a contextual secondary row
 *   era_culture 6 chips (era + provenance merged; they were 58% redundant)
 *   prominence  4 buckets over nrefs
 *
 * The secondary row writes into its own axis (SUBFORM_AXIS) rather than into
 * `form`, so clearing a form chip leaves no orphaned sub-selection filtering
 * invisibly. Matters.js drops stale sub-selections when their parent is
 * deselected.
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
    chipMode: true, // Matters renders chips on every axis, not switch rows
    ...(a.groups
      ? {
          groups: a.groups.map((g) => ({
            tag: g.tag,
            label: t(g.key, g.label),
            options: g.chips.map((c) => ({ tag: c.tag, label: t(c.key, c.label) })),
          })),
          secondary: Object.fromEntries(
            Object.entries(a.secondary || {}).map(([formTag, chips]) => [
              formTag,
              chips.map((c) => ({ tag: c.tag, label: t(c.key, c.label) })),
            ])
          ),
          secondaryName: a.secondaryName,
        }
      : {
          options: a.chips.map((c) => ({ tag: c.tag, label: t(c.key, c.label) })),
        }),
  }));

  const axisNames = [...filterAxes.map((a) => a.name), SUBFORM_AXIS];
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
