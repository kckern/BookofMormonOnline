/** @format */

import React, { useState } from "react";
import BootstrapSwitchButton from "bootstrap-switch-button-react";
import { label } from "src/models/Utils";
import { formsByGroup, subformsByForm } from "./mattersFilterData";
import "./MatterDetailColumn.css";

/** label() echoes the key back when the dictionary lacks it — treat that as a miss. */
const t = (key, fallback) => {
  const v = label(key);
  return !v || v === key || !String(v).trim() ? fallback : v;
};

const CAP = 10; // max form rows shown while collapsed

/**
 * The Matters right column, shown once a Kind is active. Primary level: form
 * switches (reusing FilterPanel's li.item chrome). Each ON form reveals its
 * subform chips beneath it; those chips are radio-per-form — picking one clears
 * its siblings. The form list collapses to ~CAP rows (selected forms always
 * shown) with a Show more toggle.
 */
export function MatterDetailColumn({ matterFilters, setFilter }) {
  const [expanded, setExpanded] = useState(false);
  const kinds = matterFilters.form_group ?? new Set();
  const formSel = matterFilters.form ?? new Set();
  const subSel = matterFilters.subform_label ?? new Set();

  // Forms revealed by the selected kinds, deduped, group order preserved.
  const seen = new Set();
  const forms = [];
  for (const g of kinds) {
    for (const f of formsByGroup[g] || []) {
      if (!seen.has(f.tag)) { seen.add(f.tag); forms.push(f); }
    }
  }

  // Collapsed: always show selected forms, fill up to CAP with the rest.
  let visible = forms;
  let hiddenCount = 0;
  if (!expanded && forms.length > CAP) {
    const selected = forms.filter((f) => formSel.has(f.tag));
    const unselected = forms.filter((f) => !formSel.has(f.tag));
    const fill = unselected.slice(0, Math.max(0, CAP - selected.length));
    const keep = new Set([...selected, ...fill].map((f) => f.tag));
    visible = forms.filter((f) => keep.has(f.tag));
    hiddenCount = forms.length - visible.length;
  }

  const toggleForm = (tag) => {
    const next = new Set(formSel);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setFilter({ ...matterFilters, form: next });
  };

  const toggleSub = (formTag, subTag) => {
    const next = new Set(subSel);
    const wasOn = next.has(subTag);
    // Radio within this form: clear its siblings first.
    for (const s of subformsByForm[formTag] || []) next.delete(s.tag);
    if (!wasOn) next.add(subTag);
    setFilter({ ...matterFilters, subform_label: next });
  };

  return (
    <ul className="ppDetailColumn">
      <li className="lihead">{t("matter_axis_detail", "Detail")}</li>
      {visible.map((f) => {
        const on = formSel.has(f.tag);
        const subs = subformsByForm[f.tag] || [];
        return (
          <React.Fragment key={f.tag}>
            <li className="item" onClick={() => toggleForm(f.tag)}>
              <BootstrapSwitchButton
                checked={on}
                onstyle="success"
                offlabel={label("off")}
                onlabel={label("on")}
                size="xs"
              />
              {t(f.key, f.label)}
            </li>
            {on && subs.length > 0 && (
              <li className="ppSubChips">
                {subs.map((s) => (
                  <button
                    type="button"
                    key={s.tag}
                    className={"ppChip" + (subSel.has(s.tag) ? " on" : "")}
                    onClick={() => toggleSub(f.tag, s.tag)}
                  >
                    {t(s.key, s.label)}
                  </button>
                ))}
              </li>
            )}
          </React.Fragment>
        );
      })}
      {hiddenCount > 0 && (
        <li className="ppShowMore">
          <button type="button" onClick={() => setExpanded(true)}>
            {t("show_more", "Show more")} ({hiddenCount})
          </button>
        </li>
      )}
      {expanded && forms.length > CAP && (
        <li className="ppShowMore">
          <button type="button" onClick={() => setExpanded(false)}>
            {t("show_less", "Show less")}
          </button>
        </li>
      )}
    </ul>
  );
}
