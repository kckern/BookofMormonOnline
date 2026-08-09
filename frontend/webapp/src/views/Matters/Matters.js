/** @format */

import React, { useState, useEffect } from "react";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { Spinner } from "../_Common/Loader";
import { isMobile, label, processName, replaceNumbers } from "src/models/Utils";
import { Link, useRouteMatch } from "react-router-dom";
import { Card, CardHeader, CardBody, CardFooter, Button } from "reactstrap";
import "./Matters.css";
import "../Places/Places.css";
import "../People/People.css";

import { MattersFilter } from "./MattersFilter";
import { categoryChips, CATEGORY_TEST, formsByGroup, subformsByForm } from "./mattersFilterData";
import { useAppController } from "src/contexts/AppControllerContext";
import { slugGradient, entityInitials } from "../_Common/EntityThumb";

/** Translate with a real fallback — label() echoes the key back when unknown. */
const t = (key, fallback) => {
  const v = label(key);
  return !v || v === key || !String(v).trim() ? fallback : v;
};

/** "Belief & Mind" → "belief-mind", for CSS class names. */
const badgeClass = (v) =>
  (v || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// A `/matters/<group>` URL (narrative | material | concepts) pre-selects that
// Category chip; the same keywords are what the home tiles link to. Order matters
// vs `/matters/:matterSlug`: these keywords are intercepted before the slug is
// treated as a popup target. Category itself is a real filter axis, so the route
// just seeds it — one source of truth (see the seeding effect below).
const CATEGORY_BY_TAG = Object.fromEntries(categoryChips.map((c) => [c.tag, c]));

function MattersComponent() {
  const appController = useAppController();
  useEffect(() => {
    document.title = label("menu_matters") + " | " + label("home_title");
  }, []);

  const [matterList, setMatterList] = useState(appController.preLoad?.matterList || null);
  const [failedSlugs, setFailedSlugs] = useState(() => new Set());

  // Default state is no filters — an empty set on an axis means "no constraint",
  // so the index opens showing every matter.
  const emptyFilters = {
    era_culture: new Set(),
    form_group: new Set(),
    category: new Set(),
    form: new Set(),
    subform_label: new Set(),
    search: null,
  };
  const [matterFilters, setFilterRaw] = useState(emptyFilters);

  /**
   * Keep the cascading Kind → Form → Subform selections honest:
   *   - Kind empty     → clear form + subform_label (their column is gone).
   *   - Kind non-empty → drop forms not reachable from the selected kinds, then
   *                      subforms whose parent form dropped.
   * (Era, Kind and Category are independent axes and are left untouched here.)
   */
  const setFilter = (next) => {
    let result = next;
    const kind = result.form_group ?? new Set();
    if (!kind.size) {
      if (result.form?.size) result = { ...result, form: new Set() };
      if (result.subform_label?.size) result = { ...result, subform_label: new Set() };
    } else {
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
  const routeParam = match?.params?.matterSlug;
  // A group keyword seeds the Category axis; anything else is a real slug → popup.
  const activeGroup = routeParam && CATEGORY_TEST[routeParam] ? routeParam : null;
  useEffect(() => {
    if (routeParam && !CATEGORY_TEST[routeParam]) {
      appController.functions.setPopUp({
        type: "matters",
        ids: [routeParam],
        underSlug: "matters",
      });
    }
  }, [routeParam]);

  // Route → filter: entering /matters/<group> pre-selects that Category chip;
  // /matters (or a slug route) clears it. Keyed on the URL only, so a user's own
  // chip edits afterward stick until they navigate again.
  useEffect(() => {
    setFilterRaw((prev) => ({ ...prev, category: new Set(activeGroup ? [activeGroup] : []) }));
  }, [activeGroup]);

  useEffect(() => {
    if (!matterList) {
      BoMOnlineAPI({ matterList: true }).then((result) => {
        setMatterList(result.matterList);
      });
    }
  }, [matterList]);

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
    // Category is derived (branch × specificity), OR within the axis.
    const cat = matterFilters.category;
    if (cat && cat.size > 0 && ![...cat].some((tag) => CATEGORY_TEST[tag]?.(item))) return false;
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

  // Weight order (ascending): lightest matters first. `weight` is a curated
  // decimal score (a prominence tier plus a verse_id fraction, so ties fall back
  // to scripture order). Missing weights sort last.
  const filtered = matterList
    .filter(passesFilters)
    .filter((o) => o.slug)
    .sort((a, b) => (a.weight ?? Infinity) - (b.weight ?? Infinity));

  return (
    <div className="container noselect" style={{ display: "block" }}>
      <div id="page">
        <h3 className="title lg-4 text-center">
          {label("title_matters")}
          {activeGroup && (
            <>
              <span className="mattersGroupQualifier">
                {t(CATEGORY_BY_TAG[activeGroup].key, CATEGORY_BY_TAG[activeGroup].label)}
              </span>
              <Link className="mattersGroupClear" to="/matters">{t("view_all", "View all")}</Link>
            </>
          )}
        </h3>
        <MattersFilter
          matterFilters={matterFilters}
          setFilter={setFilter}
          matterList={matterList}
          resultCount={filtered.length}
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
            <div className="MatterGrid">
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
                          {entityInitials(obj.name)}
                        </span>
                        {obj.subtitle && (
                          <div className="subtitle">{replaceNumbers(obj.subtitle)}</div>
                        )}
                      </CardBody>
                    ) : (
                      <CardBody className="matterInfo">
                        <div
                          className="matterImg"
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
                        </div>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MattersComponent;
