import React from "react";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";

/**
 * Cross-entity relationships (bom_xrels) list, shared by the object, person,
 * and place popups.
 *
 * Row direction matters for reading order:
 *  - direction "src" (object popups): this entity is the row's source —
 *    render verb then name ("held-by — Nephi").
 *  - direction "dst" (person/place popups): the row points AT this entity and
 *    dst_* carry the other party — render name then verb
 *    ("Synagogues — taught-by").
 */
export default function XrelSection({ xrels, showEmpty, noHeading }) {
  const appController = useAppController();
  const hasRows = Array.isArray(xrels) && xrels.length > 0;
  if (!hasRows && !showEmpty) return null;

  const handleXrelClick = (xrel, e) => {
    e.preventDefault();
    if (xrel.dst_type === "people") {
      appController.functions.setPopUp({ type: "people", ids: [xrel.dst_slug], underSlug: "people" });
    } else if (xrel.dst_type === "place") {
      appController.functions.setPopUp({ type: "places", ids: [xrel.dst_slug], underSlug: "places" });
    } else if (xrel.dst_type === "object") {
      appController.functions.setPopUp({ type: "object", ids: [xrel.dst_slug], underSlug: "objects" });
    }
    // group: non-clickable, no-op
  };

  return (
    <>
      {!noHeading && <h4>{label("relationships")}</h4>}
      {hasRows ? (
        <ul className="xrels">
          {xrels.map((x, idx) => {
            const clickable = ["people", "place", "object"].includes(x.dst_type);
            const nameLink = (
              <a href="#" onClick={clickable ? (e) => handleXrelClick(x, e) : (e) => e.preventDefault()}>
                {x.dst_name}
                {x.dst_title && <em> ({x.dst_title})</em>}
              </a>
            );
            const verb = <span className="rel-verb">{x.rel}</span>;
            const reverse = x.direction === "dst";
            return (
              <li
                key={idx}
                className={"xrel xrel-" + x.dst_type + (clickable ? " clickable" : "") + (reverse ? " reverse" : "")}
              >
                {reverse ? (
                  <>
                    {nameLink} {verb}
                  </>
                ) : (
                  <>
                    {verb} {nameLink}
                  </>
                )}
                {x.note && <div className="xrel-note">{x.note}</div>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="xrels-empty">{label("no_relationships") || "No relationships."}</p>
      )}
    </>
  );
}
