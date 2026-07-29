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
import { prominenceBucket, chipLevels } from "./mattersFilterData";
import { MatterChipLevels } from "./MatterChipLevels";
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
    form_group: new Set(),
    era_culture: new Set(),
    prominence: new Set(),
    form: new Set(),
    subform_label: new Set(),
    search: null,
  };
  const [matterFilters, setFilterRaw] = useState(emptyFilters);

  /**
   * Drop cascade selections whose parent is no longer selected.
   * Without this, switching off a Kind group leaves its form chips still
   * filtering while nothing on screen explains the empty result.
   */
  const setFilter = (next) => {
    for (const level of chipLevels) {
      const parent = next[level.parent] ?? new Set();
      const own = next[level.name] ?? new Set();
      if (!own.size) continue;
      if (!parent.size) {
        next = { ...next, [level.name]: new Set() };
        continue;
      }
      const reachable = new Set(
        [...parent].flatMap((p) => (level.map[p] || []).map((o) => o.tag))
      );
      const kept = new Set([...own].filter((v) => reachable.has(v)));
      if (kept.size !== own.size) next = { ...next, [level.name]: kept };
    }
    setFilterRaw(next);
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
    for (const axis of ["form_group", "form", "subform_label", "era_culture"]) {
      const set = matterFilters[axis];
      if (set && set.size > 0 && !set.has(item[axis])) return false;
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
        <MatterChipLevels matterFilters={matterFilters} setFilter={setFilter} />
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
                          {entityInitials(obj.name)}
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
