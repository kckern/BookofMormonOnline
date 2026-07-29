/** @format */

import React, { useState, useEffect } from "react";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { Spinner } from "../_Common/Loader";
import Masonry from "react-masonry-css";
import { isMobile, label, processName, replaceNumbers } from "src/models/Utils";
import { Link, useRouteMatch } from "react-router-dom";
import { Card, CardHeader, CardBody, CardFooter, Button } from "reactstrap";
import "./Matters.css";
import "../Places/Places.css";
import "../People/People.css";

import { MattersFilter } from "./MattersFilter";
import { prominenceBucket, formsByGroup, subformsByForm } from "./mattersFilterData";
import { useAppController } from "src/contexts/AppControllerContext";

// djb2-ish hash → stable seed for slug-based gradients.
const hashSlug = (slug) => {
  let h = 0;
  const s = slug || "";
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const slugGradient = (slug) => {
  const h = hashSlug(slug);
  const hue1 = h % 360;
  const hue2 = (hue1 + 30 + ((h >> 8) % 50)) % 360;
  const sat  = 45 + ((h >> 16) % 25);
  return `linear-gradient(135deg, hsl(${hue1}, ${sat}%, 48%) 0%, hsl(${hue2}, ${sat}%, 26%) 100%)`;
};

/** Translate with a real fallback — label() echoes the key back when unknown. */
const t = (key, fallback) => {
  const v = label(key);
  return !v || v === key || !String(v).trim() ? fallback : v;
};

/** "Belief & Mind" → "belief-mind", for CSS class names. */
const badgeClass = (v) =>
  (v || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const matterInitials = (name) => {
  const cleaned = (name || "").replace(/[^\p{L}\s]/gu, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
};

function MattersComponent() {
  const appController = useAppController();
  useEffect(() => {
    document.title = label("menu_matters") + " | " + label("home_title");
  }, []);

  const [matterList, setMatterList] = useState(appController.preLoad?.matterList || null);
  const [failedSlugs, setFailedSlugs] = useState(() => new Set());

  // Default state is no filters — every axis empty means "no constraint",
  // so the index opens showing all matters.
  const emptyFilters = {
    era_culture: new Set(),
    form_group: new Set(),
    prominence: new Set(),
    form: new Set(),
    subform_label: new Set(),
    search: null,
  };
  const [matterFilters, setFilterRaw] = useState(emptyFilters);

  /**
   * Keep the dynamic right column honest. Prominence and the detail column
   * share the third slot, and form/subform selections cascade off the Kind:
   *   - Kind empty     → clear form + subform_label (their column is gone).
   *   - Kind non-empty → clear Prominence; drop forms not reachable from the
   *                      selected kinds, then subforms whose parent form dropped.
   */
  const setFilter = (next) => {
    let result = next;
    const kind = result.form_group ?? new Set();
    if (!kind.size) {
      if (result.form?.size) result = { ...result, form: new Set() };
      if (result.subform_label?.size) result = { ...result, subform_label: new Set() };
    } else {
      if (result.prominence?.size) result = { ...result, prominence: new Set() };
      const reachableForms = new Set(
        [...kind].flatMap((g) => (formsByGroup[g] || []).map((f) => f.tag))
      );
      const forms = result.form ?? new Set();
      const keptForms = new Set([...forms].filter((f) => reachableForms.has(f)));
      if (keptForms.size !== forms.size) result = { ...result, form: keptForms };

      const subs = result.subform_label ?? new Set();
      if (subs.size) {
        const validSubs = new Set(
          [...keptForms].flatMap((f) => (subformsByForm[f] || []).map((s) => s.tag))
        );
        const keptSubs = new Set([...subs].filter((s) => validSubs.has(s)));
        if (keptSubs.size !== subs.size) result = { ...result, subform_label: keptSubs };
      }
    }
    setFilterRaw(result);
  };

  const match = useRouteMatch();
  useEffect(() => {
    if (match?.params?.matterSlug) {
      appController.functions.setPopUp({
        type: "matters",
        ids: [match.params.matterSlug],
        underSlug: "matters",
      });
    }
  }, [match?.params?.matterSlug]);

  useEffect(() => {
    if (!matterList) {
      BoMOnlineAPI({ matterList: true }).then((result) => {
        setMatterList(result.matterList);
      });
    }
  }, [matterList]);

  const breakpointColumnsObj = {
    default: 8, 1600: 7, 1400: 6, 1200: 5, 1000: 4, 800: 3, 600: 2, 400: 2,
  };

  const handleClick = (slug, e) => {
    e.preventDefault();
    appController.functions.setPopUp({
      type: "matters",
      ids: [slug],
      underSlug: "matters",
    });
  };

  // AND across axes; OR within an axis. Empty set on an axis = no filter on that axis.
  const passesFilters = (item) => {
    if (matterFilters.search) {
      const re = new RegExp(matterFilters.search, "gi");
      if (!re.test(item.name) && !re.test(item.subtitle || "")) return false;
    }
    for (const axis of ["era_culture", "form_group"]) {
      const set = matterFilters[axis];
      if (set && set.size > 0 && !set.has(item[axis])) return false;
    }
    const formSel = matterFilters.form;
    if (formSel && formSel.size > 0 && !formSel.has(item.form)) return false;
    // Per-form subform narrowing: only the item's own form's chips constrain it.
    const subSel = matterFilters.subform_label;
    if (subSel && subSel.size > 0) {
      const active = (subformsByForm[item.form] || [])
        .map((s) => s.tag)
        .filter((tag) => subSel.has(tag));
      if (active.length > 0 && !active.includes(item.subform_label)) return false;
    }
    const prom = matterFilters.prominence;
    if (prom && prom.size > 0 && !prom.has(prominenceBucket(item.nrefs))) return false;
    return true;
  };

  const markFailed = (slug) => {
    setFailedSlugs((prev) => {
      if (prev.has(slug)) return prev;
      const next = new Set(prev);
      next.add(slug);
      return next;
    });
  };

  if (!matterList) {
    return (
      <div className="container noselect" style={{ display: "block" }}>
        <Spinner top={isMobile() ? "50vh" : "60vh"} />
      </div>
    );
  }

  const filtered = matterList.filter(passesFilters).filter(o => o.slug);

  return (
    <div className="container noselect" style={{ display: "block" }}>
      <div id="page">
        <h3 className="title lg-4 text-center">{label("title_matters")}</h3>
        <MattersFilter
          matterFilters={matterFilters}
          setFilter={setFilter}
          matterList={matterList}
        />
        <div className="MatterList">
          {filtered.length === 0 ? (
            <div className="MatterEmptyState">
              {label("no_matters_match")}{" "}
              <Button color="link" onClick={() => setFilter(emptyFilters)}>
                {label("clear_filters")}
              </Button>
            </div>
          ) : (
            <Masonry
              breakpointCols={breakpointColumnsObj}
              className="my-masonry-grid"
              columnClassName="my-masonry-grid_column"
            >
              {filtered.map((obj, i) => (
                <Link
                  key={i}
                  to={"/matters/" + obj.slug}
                  onClick={(e) => handleClick(obj.slug, e)}
                >
                  <Card>
                    <CardHeader className="text-center">
                      <h5>{processName(obj.name)}</h5>
                    </CardHeader>
                    {failedSlugs.has(obj.slug) ? (
                      <CardBody
                        className="matterInfo matterFallback"
                        style={{ background: slugGradient(obj.slug) }}
                      >
                        <span className="matterInitials" aria-hidden="true">
                          {matterInitials(obj.name)}
                        </span>
                        {obj.subtitle && (
                          <div className="subtitle">{replaceNumbers(obj.subtitle)}</div>
                        )}
                      </CardBody>
                    ) : (
                      <CardBody
                        className="matterInfo"
                        style={{
                          backgroundImage: `url(${assetUrl}/matters/${obj.slug})`,
                        }}
                      >
                        <img
                          alt=""
                          src={`${assetUrl}/matters/${obj.slug}`}
                          style={{ display: "none" }}
                          onError={() => markFailed(obj.slug)}
                        />
                        {obj.subtitle && (
                          <div className="subtitle">{replaceNumbers(obj.subtitle)}</div>
                        )}
                      </CardBody>
                    )}
                    <CardFooter className="text-center">
                      <div className="labels">
                        <span
                          className={"IdBadge grp-" + badgeClass(obj.form_group)}
                          title={obj.form || obj.form_group || ""}
                        >
                          {(obj.form_group || "?").charAt(0).toUpperCase()}
                        </span>
                        <span
                          className={"IdBadge ec-" + badgeClass(obj.era_culture)}
                          title={obj.era_culture || ""}
                        >
                          {(obj.era_culture || "?").charAt(0).toUpperCase()}
                        </span>
                        {obj.specificity === "instance" && (
                          <span
                            className="IdBadge spec-named"
                            title={t("spec_instance", "Named")}
                          >
                            ★
                          </span>
                        )}
                      </div>
                      <div className="icons"></div>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </Masonry>
          )}
        </div>
      </div>
    </div>
  );
}

export default MattersComponent;
