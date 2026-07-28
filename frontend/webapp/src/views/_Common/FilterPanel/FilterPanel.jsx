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
    onChange({ ...value, [axisName]: all ? axis.options.map((o) => o.tag) : [] });
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
        <div className="ppColumns">{axes.map(renderAxis)}</div>
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

  useEffect(() => {
    if (isMobile() && appController.states.popUp.type === "pFilter") {
      appController.functions.setPopUp({
        ...appController.states.popUp,
        popUpData: { filterBox: panel },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, appController.states.popUp.type]);

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
