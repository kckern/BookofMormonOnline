/** @format */

import React from "react";
import { label } from "src/models/Utils";
import { filterAxes } from "./mattersFilterData";
import { useAppController } from "src/contexts/AppControllerContext";
import FilterPanel from "src/views/_Common/FilterPanel/FilterPanel";

export function MattersFilter({ matterFilters, setFilter, matterList }) {
  const appController = useAppController();

  const axes = filterAxes.map((a) => ({
    name: a.name,
    title: label(a.title) || a.titleEn,
    options: a.chips.map((c) => ({ tag: c.tag, label: label(c.key) || c.label })),
  }));

  const value = Object.fromEntries(filterAxes.map((a) => [a.name, [...matterFilters[a.name]]]));

  const onChange = (next) =>
    setFilter({
      ...matterFilters,
      ...Object.fromEntries(filterAxes.map((a) => [a.name, new Set(next[a.name])])),
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
