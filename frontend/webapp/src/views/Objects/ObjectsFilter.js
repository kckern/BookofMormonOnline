/** @format */

import React, { useEffect, useState } from "react";
import { Button } from "reactstrap";
import BootstrapSwitchButton from "bootstrap-switch-button-react";
import { isMobile, label } from "src/models/Utils";
import { SearchPopUp } from "../_Common/SearchPopUp";
import { filterAxes } from "./objectsFilterData";

export function ObjectsFilter({ appController, objectFilters, setFilter, objectList }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initSearchString, setInitSearchString] = useState("");

  const toggleChip = (axis, tag) => {
    const next = { ...objectFilters };
    const set = new Set(next[axis]);
    if (set.has(tag)) set.delete(tag);
    else set.add(tag);
    next[axis] = set;
    setFilter(next);
  };

  const setAxis = (axis, all) => {
    const next = { ...objectFilters };
    next[axis] = all
      ? new Set(filterAxes.find((a) => a.name === axis).chips.map((c) => c.tag))
      : new Set();
    setFilter(next);
  };

  const renderAxis = (axis) => (
    <ul key={axis.name}>
      <li className="lihead">{label(axis.title) || axis.titleEn}</li>
      <li className="lifoot">
        <Button onClick={() => setAxis(axis.name, true)}>{label("select_all")}</Button>
        <Button onClick={() => setAxis(axis.name, false)}>{label("clear")}</Button>
      </li>
      {axis.chips.map((chip, idx) => (
        <li key={idx} className="item" onClick={() => toggleChip(axis.name, chip.tag)}>
          <BootstrapSwitchButton
            checked={objectFilters[axis.name].has(chip.tag)}
            onstyle="success"
            offlabel={label("off")}
            onlabel={label("on")}
            size="xs"
          />
          {label(chip.key) || chip.label}
        </li>
      ))}
    </ul>
  );

  const selectItemHandler = (slug) => {
    appController.functions.setPopUp({
      type: "object",
      ids: [slug],
      underSlug: "objects",
    });
    setIsOpen(false);
  };

  const filterBox = (
    <>
      <h5 className="ppFiltersHeading">{label("selectors")}</h5>
      <div className="ppFilters">
        {!isMobile() && (
          <button className="ppFiltersSearchButton" onClick={() => setIsOpen(true)}>
            🔍
          </button>
        )}
        <div className="ppColumns">{filterAxes.map(renderAxis)}</div>
        {!isMobile() && (
          <SearchPopUp
            placeholder="search_for_an_object"
            preLoadData={objectList}
            selectItemHandler={selectItemHandler}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            testFieldNames={{ primary: "name", secondary: "subtitle" }}
            assetName="objects"
            initSearchString={initSearchString}
          />
        )}
      </div>
    </>
  );

  const handleClick = () => {
    appController.functions.setPopUp({
      type: "pFilter",
      ids: [appController.states.user.social?.user_id],
      underSlug: "objects",
      popUpData: { filterBox, setFilter, objectFilters },
    });
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const ignoreKeys = ["-", "_", "=", "+", "[", "]", "Tab", "\\", "/", "|"];
      if (document.activeElement.tagName !== "INPUT" && ignoreKeys.includes(event.key)) return;
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key === "Escape") setIsOpen(false);
      if (document.activeElement.tagName === "INPUT") { event.stopPropagation(); return; }
      if (event.key.length > 1) return;
      setIsOpen(true);
      setInitSearchString(event.key);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isMobile()) {
    return (
      <div className="filterDrawerButton">
        <Button onClick={handleClick}>{label("selectors")}</Button>
        <button className="ppFiltersSearchButtonMobile" onClick={() => setIsOpen(true)}>🔍</button>
        <SearchPopUp
          placeholder="search_for_an_object"
          preLoadData={objectList}
          selectItemHandler={selectItemHandler}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          testFieldNames={{ primary: "name", secondary: "subtitle" }}
          assetName="objects"
          initSearchString={initSearchString}
        />
      </div>
    );
  }

  return filterBox;
}
