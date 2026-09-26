import React, { useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useLegacyParams } from "src/models/routeParams";
import { parseValue, serialize } from "./urlState";
import { label } from "src/models/Utils";
import Overview from "./Overview";
import AnchorView from "./AnchorView";
import Reader from "./Reader";
import "./crossref.css";

export default function BibleCrossRef() {
  const { value } = useLegacyParams();
  const routerNavigate = useNavigate();
  const location = useLocation();
  const state = parseValue(value, location.search);
  // This file already had its own `navigate` helper wrapping history.push,
  // so the router hook is bound under a different name.
  const navigate = (next) => routerNavigate(serialize(next));

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
  }, [value, location.search]);

  return (
    <div className="xref-root">
      {state.view === "anchor" ? (
        <AnchorView state={state} navigate={navigate} />
      ) : state.view === "reader" ? (
        <Reader state={state} navigate={navigate} />
      ) : (
        <Overview state={state} navigate={navigate} />
      )}
    </div>
  );
}
