import React, { useEffect, useState } from "react";
import { Button } from "reactstrap";
import BootstrapSwitchButton from "bootstrap-switch-button-react";
import { isMobile, label } from "src/models/Utils";
import { SearchPopUp } from "src/views/_Common/SearchPopUp";
import { useAppController } from "src/contexts/AppControllerContext";
import "./FilterPanel.css";

/**
 * FilterPanel — shared, controlled, config-driven filter UI (People/Places/Matters).
 *
 * The parent owns filter state (it also filters its list); this panel renders the
 * axes + toggles + select-all/clear, wires SearchPopUp, and owns the mobile drawer.
 * Selection is normalized: `value` is { axisName: string[] } (selected tags), and
 * `onChange` receives the whole next map. Each view adapts its native format
 * (letter-code string / Set) at the boundary.
 *
 * Props:
 *  - heading: node — the .ppFiltersHeading text.
 *  - axes: [{ name, title, options: [{ tag, label }] }] — title/label are nodes.
 *  - value: { [axisName]: string[] } — selected tags per axis (controlled).
 *  - onChange(nextValue) — panel computes toggle/select-all/clear; emits the whole map.
 *  - search?: { placeholder, preLoadData, testFieldNames, assetName, selectItemHandler }
 *      — when present, renders 🔍 + SearchPopUp (panel owns isOpen + type-to-search).
 *
 * GROUPED / SECONDARY AXES (additive — used by Matters only):
 * An axis may instead supply:
 *  - groups: [{ tag, label, options: [{ tag, label }] }] — renders as compact chip
 *      blocks under group headings. The group heading toggles all its chips.
 *      Used when an axis has too many options for a vertical switch list (Matters'
 *      form axis has 17). Group tags are NOT filter values; only chips are.
 *  - secondary: { [chipTag]: [{ tag, label }] } and secondaryName: string —
 *      a wrapped chip row that appears beneath the axis when a chip owning
 *      secondary options is selected, writing into value[secondaryName].
 *
 * Axes without `groups` render exactly as before (People/Places are untouched).
 */
export default function FilterPanel({ heading, axes, value, onChange, search }) {
  const appController = useAppController();
  const [isOpen, setIsOpen] = useState(false);
  const [initSearchString, setInitSearchString] = useState("");
  const hasSearch = Boolean(search);

  const toggleTag = (axisName, tag) => {
    const cur = value[axisName] || [];
    const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
    onChange({ ...value, [axisName]: next });
  };

  const setAll = (axisName, all) => {
    const axis = axes.find((a) => a.name === axisName);
    const every = axis.options ?? (axis.groups ?? []).flatMap((g) => g.options);
    onChange({ ...value, [axisName]: all ? every.map((o) => o.tag) : [] });
  };

  /** Toggle every chip in a group on/off together. */
  const toggleGroup = (axis, group) => {
    const cur = value[axis.name] || [];
    const tags = group.options.map((o) => o.tag);
    const allOn = tags.every((t) => cur.includes(t));
    const next = allOn ? cur.filter((t) => !tags.includes(t)) : [...new Set([...cur, ...tags])];
    onChange({ ...value, [axis.name]: next });
  };

  /**
   * Secondary chips for the currently-selected chips of a grouped axis.
   * Only chips that actually own secondary options contribute a row, so an axis
   * with no eligible selection renders nothing.
   */
  const secondaryFor = (axis) => {
    if (!axis.secondary || !axis.secondaryName) return [];
    const selected = value[axis.name] || [];
    const seen = new Set();
    const out = [];
    for (const tag of selected) {
      for (const opt of axis.secondary[tag] || []) {
        if (seen.has(opt.tag)) continue;
        seen.add(opt.tag);
        out.push(opt);
      }
    }
    return out;
  };

  /** Compact header: title on the left, small text actions on the right. */
  const axisHead = (axis, count) => (
    <div className="ppAxisHead">
      <span className="ppAxisTitle">
        {axis.title}
        {count > 0 && <span className="ppAxisCount">{count}</span>}
      </span>
      <span className="ppAxisActions">
        <button type="button" onClick={() => setAll(axis.name, true)}>{label("select_all")}</button>
        <button type="button" onClick={() => setAll(axis.name, false)}>{label("clear")}</button>
      </span>
    </div>
  );

  const renderChipAxis = (axis) => {
    const selected = value[axis.name] || [];
    return (
      <div className="ppChipAxis" key={axis.name}>
        {axisHead(axis, selected.length)}
        <div className="ppChips">
          {axis.options.map((opt) => (
            <button
              type="button"
              key={opt.tag}
              className={"ppChip" + (selected.includes(opt.tag) ? " on" : "")}
              onClick={() => toggleTag(axis.name, opt.tag)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderGroupedAxis = (axis) => {
    const selected = value[axis.name] || [];
    const secondary = secondaryFor(axis);
    const subName = axis.secondaryName;
    const subSelected = (subName && value[subName]) || [];
    return (
      <div className="ppGroupedAxis" key={axis.name}>
        {axisHead(axis, selected.length)}
        <div className="ppGroupGrid">
          {axis.groups.map((group) => {
            const tags = group.options.map((o) => o.tag);
            const allOn = tags.every((tg) => selected.includes(tg));
            return (
              <div className="ppGroup" key={group.tag}>
                <button
                  type="button"
                  className={"ppGroupHead" + (allOn ? " on" : "")}
                  onClick={() => toggleGroup(axis, group)}
                  title={label("select_all")}
                >
                  {group.label}
                </button>
                <div className="ppChips">
                  {group.options.map((opt) => (
                    <button
                      type="button"
                      key={opt.tag}
                      className={"ppChip" + (selected.includes(opt.tag) ? " on" : "")}
                      onClick={() => toggleTag(axis.name, opt.tag)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {secondary.length > 0 && (
          <div className="ppSecondary">
            {secondary.map((opt) => (
              <button
                type="button"
                key={opt.tag}
                className={"ppChip sub" + (subSelected.includes(opt.tag) ? " on" : "")}
                onClick={() => toggleTag(subName, opt.tag)}
              >
                {opt.label}
              </button>
            ))}
            {subSelected.length > 0 && (
              <button
                type="button"
                className="ppChip clearSub"
                onClick={() => onChange({ ...value, [subName]: [] })}
              >
                {label("clear")}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAxis = (axis) => (
    <ul key={axis.name}>
      <li className="lihead">{axis.title}</li>
      <li className="lifoot">
        <Button onClick={() => setAll(axis.name, true)}>{label("select_all")}</Button>
        <Button onClick={() => setAll(axis.name, false)}>{label("clear")}</Button>
      </li>
      {axis.options.map((opt) => (
        <li className="item" key={opt.tag} onClick={() => toggleTag(axis.name, opt.tag)}>
          <BootstrapSwitchButton
            checked={(value[axis.name] || []).includes(opt.tag)}
            onstyle="success"
            offlabel={label("off")}
            onlabel={label("on")}
            size="xs"
          />
          {opt.label}
        </li>
      ))}
    </ul>
  );

  const searchEl = search ? (
    <SearchPopUp
      placeholder={search.placeholder}
      preLoadData={search.preLoadData}
      selectItemHandler={(slug) => { search.selectItemHandler(slug); setIsOpen(false); }}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      testFieldNames={search.testFieldNames}
      assetName={search.assetName}
      initSearchString={initSearchString}
    />
  ) : null;

  const panel = (
    <>
      <h5 className="ppFiltersHeading">{heading}</h5>
      <div className="ppFilters">
        {search && !isMobile() && (
          <button className="ppFiltersSearchButton" onClick={() => setIsOpen(true)}>🔍</button>
        )}
        {axes.filter((a) => a.groups).map(renderGroupedAxis)}
        {axes.some((a) => a.chipMode && !a.groups) && (
          <div className="ppChipRow">
            {axes.filter((a) => a.chipMode && !a.groups).map(renderChipAxis)}
          </div>
        )}
        <div className="ppColumns">
          {axes.filter((a) => !a.groups && !a.chipMode).map(renderAxis)}
        </div>
        {!isMobile() && searchEl}
      </div>
    </>
  );

  useEffect(() => {
    if (!hasSearch) return undefined;
    const onKey = (event) => {
      const ignoreKeys = ["-", "_", "=", "+", "[", "]", "Tab", "\\", "/", "|"];
      if (document.activeElement.tagName !== "INPUT" && ignoreKeys.includes(event.key)) return;
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key === "Escape") setIsOpen(false);
      if (document.activeElement.tagName === "INPUT") { event.stopPropagation(); return; }
      if (event.key.length > 1) return;
      setIsOpen(true);
      setInitSearchString(event.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasSearch]);

  const valueKey = JSON.stringify(value);
  useEffect(() => {
    if (isMobile() && appController.states.popUp.type === "pFilter") {
      appController.functions.setPopUp({
        ...appController.states.popUp,
        popUpData: { filterBox: panel },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey, appController.states.popUp.type]);

  if (isMobile()) {
    const openDrawer = () =>
      appController.functions.setPopUp({
        type: "pFilter",
        ids: [appController.states.user.social?.user_id],
        underSlug: search?.assetName,
        popUpData: { filterBox: panel },
      });
    return (
      <div className="filterDrawerButton">
        <Button onClick={openDrawer}>{heading}</Button>
        {search && (
          <button className="ppFiltersSearchButtonMobile" onClick={() => setIsOpen(true)}>🔍</button>
        )}
        {search && searchEl}
      </div>
    );
  }

  return panel;
}
