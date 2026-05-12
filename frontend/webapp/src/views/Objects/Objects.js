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

// Eager import of all 16 category SVGs so webpack bundles them.
import animal       from "./svg/animal.svg";
import building     from "./svg/building.svg";
import weapon       from "./svg/weapon.svg";
import food         from "./svg/food.svg";
import sacredObject from "./svg/sacred-object.svg";
import money        from "./svg/money.svg";
import plant        from "./svg/plant.svg";
import record_      from "./svg/record.svg";
import metal        from "./svg/metal.svg";
import tool         from "./svg/tool.svg";
import apparel      from "./svg/apparel.svg";
import structure    from "./svg/structure.svg";
import vehicle      from "./svg/vehicle.svg";
import landscape    from "./svg/landscape.svg";
import armor        from "./svg/armor.svg";
import treasure     from "./svg/treasure.svg";

const categoryIcon = {
  "animal": animal,
  "building": building,
  "weapon": weapon,
  "food": food,
  "sacred-object": sacredObject,
  "money": money,
  "plant": plant,
  "record": record_,
  "metal": metal,
  "tool": tool,
  "apparel": apparel,
  "structure": structure,
  "vehicle": vehicle,
  "landscape": landscape,
  "armor": armor,
  "treasure": treasure,
};

function ObjectsComponent({ appController }) {
  useEffect(() => {
    document.title = label("menu_objects") + " | " + label("home_title");
  }, []);

  const [objectList, setObjectList] = useState(appController.preLoad?.objectList || null);

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

  const swapToFallback = (e, cat) => {
    if (e.target.dataset.fallback === "1") return;
    e.target.dataset.fallback = "1";
    e.target.src = categoryIcon[cat] || categoryIcon["sacred-object"];
    e.target.classList.add("category-fallback");
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
          appController={appController}
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
                        onError={(e) => swapToFallback(e, obj.category)}
                      />
                      {obj.subtitle && (
                        <div className="subtitle">{replaceNumbers(obj.subtitle)}</div>
                      )}
                    </CardBody>
                    <CardFooter className="text-center">
                      <span className={"CategoryBadge cat-" + obj.category}>
                        {obj.category}
                      </span>
                      <span className={"EraBadge era-" + obj.era}>{obj.era}</span>
                      {obj.specificity === "specific" && (
                        <span className="SpecificityBadge">{label("spec_specific") || "Named"}</span>
                      )}
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
