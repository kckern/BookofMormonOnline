/** @format */

import React, { useState, useEffect } from "react";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { Spinner } from "../_Common/Loader";
import Masonry from "react-masonry-css";
import { isMobile, label, processName, replaceNumbers } from "src/models/Utils";
import { Link, useRouteMatch } from "react-router-dom";
import { Card, CardHeader, CardBody, CardFooter, Button } from "reactstrap";
import "./Objects.css";
import "../Places/Places.css";
import "../People/People.css";

import { ObjectsFilter } from "./ObjectsFilter";
import { categoryChips } from "./objectsFilterData";
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

const objectInitials = (name) => {
  const cleaned = (name || "").replace(/[^\p{L}\s]/gu, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
};

function ObjectsComponent() {
  const appController = useAppController();
  useEffect(() => {
    document.title = label("menu_objects") + " | " + label("home_title");
  }, []);

  const [objectList, setObjectList] = useState(appController.preLoad?.objectList || null);
  const [failedSlugs, setFailedSlugs] = useState(() => new Set());

  const emptyFilters = { category: new Set(), era: new Set(), provenance: new Set(), specificity: new Set(), usage: new Set(), search: null };
  const [objectFilters, setFilter] = useState(emptyFilters);

  const match = useRouteMatch();
  useEffect(() => {
    if (match?.params?.objectSlug) {
      appController.functions.setPopUp({
        type: "object",
        ids: [match.params.objectSlug],
        underSlug: "objects",
      });
    }
  }, [match?.params?.objectSlug]);

  useEffect(() => {
    if (!objectList) {
      BoMOnlineAPI({ objectList: true }).then((result) => {
        setObjectList(result.objectList);
      });
    }
  }, [objectList]);

  const breakpointColumnsObj = {
    default: 8, 1600: 7, 1400: 6, 1200: 5, 1000: 4, 800: 3, 600: 2, 400: 2,
  };

  const handleClick = (slug, e) => {
    e.preventDefault();
    appController.functions.setPopUp({
      type: "object",
      ids: [slug],
      underSlug: "objects",
    });
  };

  // AND across axes; OR within an axis. Empty set on an axis = no filter on that axis.
  const passesFilters = (item) => {
    if (objectFilters.search) {
      const re = new RegExp(objectFilters.search, "gi");
      if (!re.test(item.name) && !re.test(item.subtitle || "")) return false;
    }
    for (const axis of ["category", "era", "provenance", "specificity", "usage"]) {
      const set = objectFilters[axis];
      if (set && set.size > 0 && !set.has(item[axis])) return false;
    }
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

  if (!objectList) {
    return (
      <div className="container noselect" style={{ display: "block" }}>
        <Spinner top={isMobile() ? "50vh" : "60vh"} />
      </div>
    );
  }

  const filtered = objectList.filter(passesFilters).filter(o => o.slug);

  return (
    <div className="container noselect" style={{ display: "block" }}>
      <div id="page">
        <h3 className="title lg-4 text-center">{label("title_objects")}</h3>
        <ObjectsFilter
          objectFilters={objectFilters}
          setFilter={setFilter}
          objectList={objectList}
        />
        <div className="ObjectList">
          {filtered.length === 0 ? (
            <div className="ObjectEmptyState">
              {label("no_objects_match")}{" "}
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
                  to={"/objects/" + obj.slug}
                  onClick={(e) => handleClick(obj.slug, e)}
                >
                  <Card>
                    <CardHeader className="text-center">
                      <h5>{processName(obj.name)}</h5>
                    </CardHeader>
                    {failedSlugs.has(obj.slug) ? (
                      <CardBody
                        className="objectInfo objectFallback"
                        style={{ background: slugGradient(obj.slug) }}
                      >
                        <span className="objectInitials" aria-hidden="true">
                          {objectInitials(obj.name)}
                        </span>
                        {obj.subtitle && (
                          <div className="subtitle">{replaceNumbers(obj.subtitle)}</div>
                        )}
                      </CardBody>
                    ) : (
                      <CardBody
                        className="objectInfo"
                        style={{
                          backgroundImage: `url(${assetUrl}/objects/${obj.slug})`,
                        }}
                      >
                        <img
                          alt=""
                          src={`${assetUrl}/objects/${obj.slug}`}
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
                          title={label("object_cat_" + (obj.category || "").replace(/-/g, "_")) || obj.category}
                        >
                          {(obj.category || "?").charAt(0).toUpperCase()}
                        </span>
                        <span
                          className={"IdBadge era-" + obj.era}
                          title={label("era_" + (obj.era || "").replace(/-/g, "_")) || obj.era}
                        >
                          {(obj.era || "?").charAt(0).toUpperCase()}
                        </span>
                        {obj.specificity === "specific" && (
                          <span
                            className="IdBadge spec-named"
                            title={label("spec_specific") || "Named"}
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

export default ObjectsComponent;
