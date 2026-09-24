import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { label } from "src/models/Utils";
import { useAppController } from "src/contexts/AppControllerContext";
import { resolveSlug } from "src/models/slugVariants";
import useEntityData from "src/views/_Common/entity/useEntityData";
import { Spinner } from "src/views/_Common/Loader";
import PersonBody, { PersonChooser } from "src/views/_Common/entity/PersonBody";
import PlaceBody, { PlaceChooser } from "src/views/_Common/entity/PlaceBody";
import MatterBody, { MatterChooser } from "src/views/_Common/entity/MatterBody";
import HistoryBody from "src/views/_Common/entity/HistoryBody";
import "./EntityPage.css";

// Per-type wiring. `param` matches the existing route patterns in Routes.js, so
// no route needs renaming. `listKey` is the preLoad list used to resolve an
// ambiguous bare slug (/people/noah → noah1, noah2, noah3). `indexText` is the
// fallback when a label key is missing from the labels table (menu_matters and
// menu_history are not guaranteed to exist) — without it the back link would
// render as a bare "❮".
const TYPES = {
  people: { param: "personName", base: "/people", listKey: "personList", indexLabel: "menu_people", indexText: "People", Body: PersonBody, Chooser: PersonChooser },
  places: { param: "placeName", base: "/places", listKey: "placeList", indexLabel: "menu_places", indexText: "Places", Body: PlaceBody, Chooser: PlaceChooser },
  matters: { param: "matterSlug", base: "/matters", listKey: "matterList", indexLabel: "menu_matters", indexText: "Matters", Body: MatterBody, Chooser: MatterChooser },
  history: { param: "slug", base: "/history", listKey: null, indexLabel: "menu_history", indexText: "History", Body: HistoryBody, Chooser: null },
};

// label() has three degenerate results that are all truthy, so `label(k) || x`
// never falls back: it returns " " when global.dictionary has not loaded yet,
// and echoes the KEY when the dictionary lacks it (models/Utils.js:99-101).
// menu_matters / menu_history are not guaranteed to exist, so go through this.
function text(key, fallback) {
  const value = label(key);
  if (!value || !String(value).trim() || value === key) return fallback;
  return value;
}

/**
 * Standalone page view of a single entity.
 *
 * Only ever mounts on DIRECT arrival. In-app clicks push through
 * models/routeHistory.js, an instance the Router does not listen to, so a click
 * never re-renders <Switch> — the modal opens over whatever was already there.
 * See docs/specs/2026-09-24-entity-url-presentation-model.md.
 */
export default function EntityPage({ type }) {
  const cfg = TYPES[type];
  const params = useParams();
  const routerHistory = useHistory();
  const appController = useAppController();
  const requested = params[cfg.param];
  const { data, status } = useEntityData(type, requested);
  const [PopUpRef, setPopUpRef] = useState(null);

  useEffect(() => {
    const name = data?.name || data?.document;
    if (name) document.title = `${name} | ${text("home_title", "Book of Mormon Online")}`;
  }, [data]);

  // Page → page: clicking a related entity navigates the Router, so the visitor
  // stays in page presentation instead of getting a modal over a stale page.
  const onEntityClick = (slug) => routerHistory.push(`${cfg.base}/${slug}`);
  const onMapClick = (e, mapSlug, placeSlug) => {
    e?.preventDefault?.();
    routerHistory.push(`/map/${mapSlug}/place/${placeSlug}`);
  };

  const backLink = (
    <p className="entity-page-back">
      <a href={cfg.base}>❮ {text(cfg.indexLabel, cfg.indexText)}</a>
    </p>
  );

  // A plain spinner, not the popup's loader: that one renders popup chrome
  // (#popUp card with a close x), which has no place on a page. Importing it
  // would also pull the whole popup module graph into this page.
  const loading = (
    <div className="entity-page">
      <Spinner top={"6em"} />
    </div>
  );

  if (status === "loading") return loading;

  if (status === "missing") {
    const list = cfg.listKey ? appController.preLoad?.[cfg.listKey] || [] : [];
    const resolution = cfg.Chooser
      ? resolveSlug(requested, list.map((x) => x.slug))
      : { kind: "none" };

    // A non-canonical spelling or a lone variant resolves straight through.
    if (resolution.kind === "exact" || resolution.kind === "redirect") {
      routerHistory.replace(`${cfg.base}/${resolution.slug}`);
      return loading;
    }

    if (resolution.kind === "chooser") {
      const candidates = resolution.candidates.map(
        (slug) => list.find((x) => x.slug === slug) || { slug, name: slug, title: null },
      );
      return (
        <div className="entity-page">
          <cfg.Chooser requested={requested} candidates={candidates} onEntityClick={onEntityClick} />
          {backLink}
        </div>
      );
    }

    return (
      <div className="entity-page">
        <div className="emptyState" style={{ padding: "2em", textAlign: "center" }}>
          {text("not_found", "Not found")}
        </div>
        {backLink}
      </div>
    );
  }

  return (
    <div className="entity-page">
      <cfg.Body
        data={data}
        setPopUpRef={setPopUpRef}
        PopUpRef={PopUpRef}
        onEntityClick={onEntityClick}
        onMapClick={onMapClick}
      />
      {backLink}
    </div>
  );
}
