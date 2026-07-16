import React, { useEffect } from "react";
import { useRouteMatch, useHistory } from "react-router-dom";
import { parseValue, serialize } from "./urlState";
import { label } from "src/models/Utils";
import Overview from "./Overview";
import AnchorView from "./AnchorView";
import Reader from "./Reader";
import "./crossref.css";

export default function BibleCrossRef() {
  const { params: { value } } = useRouteMatch();
  const history = useHistory();
  const state = parseValue(value);
  const navigate = (next) => history.push(serialize(next));

  useEffect(() => {
    const name =
      state.view === "anchor"
        ? state.book
        : state.view === "reader"
        ? `${state.bomBook} × ${state.bibleBook}`
        : label("menu_analysis");
    document.title = `${name} | ${label("home_title")}`;
    // derived from the URL, never from rendered DOM
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="xref-root">
      {state.view === "anchor" ? (
        <AnchorView state={state} navigate={navigate} />
      ) : state.view === "reader" ? (
        <Reader state={state} navigate={navigate} />
      ) : (
        <Overview navigate={navigate} />
      )}
    </div>
  );
}
