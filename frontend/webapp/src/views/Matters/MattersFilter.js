/** @format */

import React from "react";
import { label, tr } from "src/models/Utils";
import { filterAxes } from "./mattersFilterData";
import { MatterDetailColumn } from "./MatterDetailColumn";
import { useAppController } from "src/contexts/AppControllerContext";
import FilterPanel from "src/views/_Common/FilterPanel/FilterPanel";

// Reuse People's icon set so all three filter panels share one visual language.
import green from "../People/svg/green.svg";
import blue from "../People/svg/blue.svg";
import yellow from "../People/svg/yellow.svg";
import black from "../People/svg/black.svg";
import orange from "../People/svg/orange.svg";
import grey from "../People/svg/grey.svg";
import land from "../People/svg/land.svg";
import society from "../People/svg/society.svg";
import city from "../People/svg/city.svg";
import prophet from "../People/svg/prophet.svg";
import warrior from "../People/svg/warrior.svg";

// Era & Culture → colored dots. The lineage/society values reuse People's
// established colors (Nephite green, Lamanite blue, Jaredite yellow, Israelite
// grey); the non-society eras take the remaining hues.
const ERA_DOT = {
  "Nephite": green,
  "Lamanite": blue,
  "Jaredite": yellow,
  "Israelite/Old World": grey,
  "Christ era": orange,
  "Generic": black,
};

// Kind → repurposed People glyphs; grey circle where no glyph fits (Made Things).
const KIND_ICON = {
  "Natural World": land,
  "Society": society,
  "Made Things": grey,
  "Places & Buildings": city,
  "Belief & Mind": prophet,
  "War & Arms": warrior,
};

/**
 * Matters filter — three switch columns over the redesigned bom_matters vocabulary.
 *
 *   Era & Culture (left)   6 values, era + provenance merged (58% redundant)
 *   Kind          (middle) 6 form groups
 *   Category      (right)  the canonical 3 groups (Narrative/Material/Concepts),
 *                          derived from branch × specificity. Always shown.
 *
 * When a Kind is on, <MatterDetailColumn> (form switches + per-form subform chips)
 * is appended as an extra column via FilterPanel's extraColumn slot.
 */

/**
 * Option label with a leading icon, matching the People/Places pattern. Era &
 * Culture uses full-opacity color dots (className "dot"); Kind uses the muted
 * (.5 opacity) glyphs. Any axis without a mapping renders plain text.
 */
const optionLabel = (axisName, chip, text) => {
  if (axisName === "era_culture") {
    return (
      <span>
        <img className="dot" src={ERA_DOT[chip.tag] || grey} alt="" /> {text}
      </span>
    );
  }
  if (axisName === "form_group") {
    return (
      <span>
        <img src={KIND_ICON[chip.tag] || grey} alt="" /> {text}
      </span>
    );
  }
  return text;
};

export function MattersFilter({ matterFilters, setFilter, matterList, resultCount }) {
  const appController = useAppController();

  const byName = Object.fromEntries(filterAxes.map((a) => [a.name, a]));
  const kindActive = (matterFilters.form_group?.size ?? 0) > 0;

  // Era, Kind and Category are always shown; the Form/Subform detail column is
  // appended (via extraColumn) once a Kind is on.
  const shown = [byName.era_culture, byName.form_group, byName.category];

  const axes = shown.map((a) => ({
    name: a.name,
    title: tr(a.title, a.titleEn),
    exclusive: !!a.exclusive,
    options: a.chips.map((c) => ({
      tag: c.tag,
      label: optionLabel(a.name, c, tr(c.key, c.label)),
    })),
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

  // Mini popover: nest each active Kind's forms/subforms tree-style under that Kind.
  const renderItemDetail = (axisName, tag, on) =>
    axisName === "form_group" && on ? (
      <MatterDetailColumn kind={tag} matterFilters={matterFilters} setFilter={setFilter} />
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
      extraColumnAxis="form_group"
      renderItemDetail={renderItemDetail}
      resultCount={resultCount}
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
