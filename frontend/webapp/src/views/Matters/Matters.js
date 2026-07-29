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
import { prominenceBucket, secondaryChips, SUBFORM_AXIS } from "./mattersFilterData";
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
    form: new Set(),
    era_culture: new Set(),
    prominence: new Set(),
    [SUBFORM_AXIS]: new Set(),
    search: null,
  };
  const [matterFilters, setFilterRaw] = useState(emptyFilters);

  /**
   * Drop sub-selections whose parent form chip is no longer selected.
   * Without this a secondary chip keeps filtering after its parent is cleared,
   * with nothing on screen to explain the empty result.
   */
  const setFilter = (next) => {
    const forms = next.form ?? new Set();
    const subs = next[SUBFORM_AXIS] ?? new Set();
    if (subs.size && forms.size) {
      const reachable = new Set(
        [...forms].flatMap((f) => (secondaryChips[f] || []).map((c) => c.tag))
      );
      const kept = new Set([...subs].filter((s) => reachable.has(s)));
      if (kept.size !== subs.size) next = { ...next, [SUBFORM_AXIS]: kept };
    } else if (subs.size && !forms.size) {
      next = { ...next, [SUBFORM_AXIS]: new Set() };
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
    for (const axis of ["form", "era_culture", SUBFORM_AXIS]) {
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
                          className={"IdBadge cat-" + obj.category}
                          title={label("matter_cat_" + (obj.category || "").replace(/-/g, "_")) || obj.category}
                        >
                          {(obj.category || "?").charAt(0).toUpperCase()}
                        </span>
                        <span
                          className={"IdBadge era-" + obj.era}
                          title={label("era_" + (obj.era || "").replace(/-/g, "_")) || obj.era}
                        >
                          {(obj.era || "?").charAt(0).toUpperCase()}
                        </span>
                        {obj.specificity === "instance" && (
                          <span
                            className="IdBadge spec-named"
                            title={label("spec_instance") || "Named"}
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
