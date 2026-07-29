/** @format */

import React from "react";
import { label } from "src/models/Utils";
import { chipLevels } from "./mattersFilterData";
import "./MatterChipLevels.css";

/**
 * Cascading chip rows, rendered between the selector box and the tile grid.
 *
 * The three axes in the box are on/off switches (Kind, Era & Culture,
 * Prominence). Chips are used only for the levels beneath them: switch on a
 * Kind group and its form chips appear here; pick a form chip and its subform
 * chips appear on the next row.
 *
 * A row renders only when its parent axis has a selection, so with no filters
 * applied nothing shows and the tiles sit directly under the box.
 */

/** label() echoes the key back when the dictionary lacks it — treat that as a miss. */
const t = (key, fallback) => {
  const v = label(key);
  return !v || v === key || !String(v).trim() ? fallback : v;
};

export function MatterChipLevels({ matterFilters, setFilter }) {
  const rows = chipLevels.map((level) => {
    const parentSel = matterFilters[level.parent];
    if (!parentSel || parentSel.size === 0) return null;

    // Union of the options each selected parent reveals, de-duped, parent order preserved.
    const seen = new Set();
    const options = [];
    for (const parentTag of parentSel) {
      for (const opt of level.map[parentTag] || []) {
        if (seen.has(opt.tag)) continue;
        seen.add(opt.tag);
        options.push(opt);
      }
    }
    if (!options.length) return null;

    const selected = matterFilters[level.name] || new Set();
    const toggle = (tag) => {
      const next = new Set(selected);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      setFilter({ ...matterFilters, [level.name]: next });
    };

    return (
      <div className="matterChipRow" key={level.name}>
        {options.map((opt) => (
          <button
            type="button"
            key={opt.tag}
            className={"matterChip" + (selected.has(opt.tag) ? " on" : "")}
            onClick={() => toggle(opt.tag)}
          >
            {t(opt.key, opt.label)}
          </button>
        ))}
        {selected.size > 0 && (
          <button
            type="button"
            className="matterChip clear"
            onClick={() => setFilter({ ...matterFilters, [level.name]: new Set() })}
          >
            {t("clear", "Clear")}
          </button>
        )}
      </div>
    );
  });

  if (!rows.some(Boolean)) return null;
  return <div className="matterChipLevels">{rows}</div>;
}
