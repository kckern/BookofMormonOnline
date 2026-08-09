import React, { useEffect, useState } from "react";
import { Button } from "reactstrap";
import BootstrapSwitchButton from "bootstrap-switch-button-react";
import { isMobile, label, tr } from "src/models/Utils";
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
 * Two desktop modes (persisted per view in localStorage, default "mini"):
 *  - mini: a compact toolbar of per-axis dropdown buttons (title + count badge);
 *          each opens a popover with that axis's options. `extraColumnAxis` names
 *          the axis whose popover also hosts `extraColumn` (Matters' cascade).
 *  - main: the classic fully-expanded columns.
 * Mobile is unchanged — the columns render inside the pFilter drawer.
 *
 * Props:
 *  - heading: node — the .ppFiltersHeading text.
 *  - axes: [{ name, title, options: [{ tag, label }] }] — title/label are nodes.
 *  - value: { [axisName]: string[] } — selected tags per axis (controlled).
 *  - onChange(nextValue) — panel computes toggle/select-all/clear/clear-all; emits the whole map.
 *  - search?: { placeholder, preLoadData, testFieldNames, assetName, selectItemHandler }
 *  - extraColumn?: node — an extra column (Matters' cascading form/subform detail).
 *  - extraColumnAxis?: string — the axis whose mini popover hosts extraColumn.
 *  - resultCount?: number — shown as "N results" in the mini toolbar.
 */
export default function FilterPanel({ heading, axes, value, onChange, search, extraColumn, extraColumnAxis, resultCount }) {
  const appController = useAppController();
  const [isOpen, setIsOpen] = useState(false);
  const [initSearchString, setInitSearchString] = useState("");
  const hasSearch = Boolean(search);

  const storageKey = `fpMode:${search?.assetName || "default"}`;
  const [mode, setMode] = useState(() => {
    try { return window.localStorage.getItem(storageKey) === "main" ? "main" : "mini"; } catch (e) { return "mini"; }
  });
  const applyMode = (m) => {
    setMode(m);
    try { window.localStorage.setItem(storageKey, m); } catch (e) { /* private mode / SSR */ }
  };
  const [openAxis, setOpenAxis] = useState(null);

  const toggleTag = (axisName, tag) => {
    const cur = value[axisName] || [];
    const next = cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag];
    onChange({ ...value, [axisName]: next });
  };

  const setAll = (axisName, all) => {
    const axis = axes.find((a) => a.name === axisName);
    onChange({ ...value, [axisName]: all ? axis.options.map((o) => o.tag) : [] });
  };

  const clearAll = () => onChange(Object.fromEntries(axes.map((a) => [a.name, []])));

  // The option list for one axis (switches + select-all/clear), reused by both modes.
  const renderAxisList = (axis, { showTitle = true } = {}) => (
    <ul key={axis.name}>
      {showTitle ? <li className="lihead">{axis.title}</li> : null}
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

  // Classic expanded columns — used by desktop main mode AND the mobile drawer.
  const columns = (
    <div className="ppColumns">
      {axes.map((a) => renderAxisList(a))}
      {extraColumn}
    </div>
  );

  const searchButton = search && !isMobile() ? (
    <button className="ppFiltersSearchButton" onClick={() => { setInitSearchString(""); setIsOpen(true); }}>🔍</button>
  ) : null;

  // Mobile drawer body: always the expanded columns (a toolbar of popovers doesn't
  // belong in a side-drawer). Snapshotted into the pFilter popup below.
  const mobilePanel = (
    <>
      <h5 className="ppFiltersHeading">{heading}</h5>
      <div className="ppFilters">
        {searchButton}
        {columns}
      </div>
    </>
  );

  const mainPanel = (
    <>
      <h5 className="ppFiltersHeading">
        {heading}
        <button className="fpModeToggle" onClick={() => applyMode("mini")} title={tr("collapse", "Collapse")} aria-label={tr("collapse", "Collapse")}>⤢</button>
      </h5>
      <div className="ppFilters">
        {searchButton}
        {columns}
        {searchEl}
      </div>
    </>
  );

  const miniPanel = (
    <>
      <div className="fpToolbar">
        {axes.map((axis) => {
          const selected = value[axis.name] || [];
          const n = selected.length;
          // One selection: label the axis button with that selection (no chip).
          // Two or more: keep the axis title and show the count chip.
          const soleLabel = n === 1
            ? (axis.options.find((o) => o.tag === selected[0]) || {}).label
            : null;
          const open = openAxis === axis.name;
          return (
            <div className={`fpAxisWrap${open ? " open" : ""}`} key={axis.name}>
              <button
                type="button"
                className={`fpAxisBtn${n ? " active" : ""}${open ? " open" : ""}`}
                aria-expanded={open}
                onClick={() => setOpenAxis(open ? null : axis.name)}
              >
                <span className="fpAxisLabel">{soleLabel != null ? soleLabel : axis.title}</span>
                {n >= 2 ? <span className="fpBadge">{n}</span> : null}
                <span className="fpCaret" aria-hidden="true">▾</span>
              </button>
              {open ? (
                <div className="fpPopover">
                  <div className="ppColumns fpPopoverCols">
                    {renderAxisList(axis, { showTitle: false })}
                    {extraColumnAxis === axis.name ? extraColumn : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {search ? (
          <button className="fpSearchBtn" onClick={() => { setInitSearchString(""); setIsOpen(true); }}>🔍</button>
        ) : null}
        <div className="fpToolbarEnd">
          {typeof resultCount === "number" ? (
            <span className="fpResultCount">{resultCount} {tr("results", "results")}</span>
          ) : null}
          <button type="button" className="fpClearAll" onClick={clearAll}>{tr("clear_all", "Clear all")}</button>
          <button type="button" className="fpModeToggle" onClick={() => applyMode("main")} title={tr("expand", "Expand")} aria-label={tr("expand", "Expand")}>⤢</button>
        </div>
      </div>
      {searchEl}
    </>
  );

  // Type-to-search + Escape (also closes an open axis popover).
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

  // Close the open axis popover on outside-click or Escape.
  useEffect(() => {
    if (!openAxis) return undefined;
    const onDown = (e) => { if (!e.target.closest(".fpAxisWrap.open")) setOpenAxis(null); };
    const onEsc = (e) => { if (e.key === "Escape") setOpenAxis(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onEsc); };
  }, [openAxis]);

  const valueKey = JSON.stringify(value);
  useEffect(() => {
    if (isMobile() && appController.states.popUp.type === "pFilter") {
      appController.functions.setPopUp({
        ...appController.states.popUp,
        popUpData: { filterBox: mobilePanel },
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
        popUpData: { filterBox: mobilePanel },
      });
    return (
      <div className="filterDrawerButton">
        <Button onClick={openDrawer}>{heading}</Button>
        {search && (
          <button className="ppFiltersSearchButtonMobile" onClick={() => { setInitSearchString(""); setIsOpen(true); }}>🔍</button>
        )}
        {search && searchEl}
      </div>
    );
  }

  return mode === "main" ? mainPanel : miniPanel;
}
