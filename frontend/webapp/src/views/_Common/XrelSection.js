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
/**
 * Map an xrel endpoint type + slug to a setPopUp payload.
 * Shared by XrelSection and the Read view's RelationshipsPanel — one
 * definition of which entity types open which popup. Returns null for
 * unknown types (no popup surface).
 */
export function popUpTargetFor(type, slug) {
  if (type === "people") return { type: "people", ids: [slug], underSlug: "people" };
  if (type === "place") return { type: "places", ids: [slug], underSlug: "places" };
  if (type === "object") return { type: "object", ids: [slug], underSlug: "objects" };
  if (type === "group") return { type: "group", ids: [slug], underSlug: "group" };
  return null;
}

export default function XrelSection({ xrels, showEmpty, noHeading }) {
  const appController = useAppController();
  const hasRows = Array.isArray(xrels) && xrels.length > 0;
  if (!hasRows && !showEmpty) return null;

  const handleXrelClick = (xrel, e) => {
    e.preventDefault();
    const target = popUpTargetFor(xrel.dst_type, xrel.dst_slug);
    if (target) appController.functions.setPopUp(target);
  };

  return (
    <>
      {!noHeading && <h4>{label("relationships")}</h4>}
      {hasRows ? (
        <ul className="xrels">
          {xrels.map((x, idx) => {
            const clickable = !!popUpTargetFor(x.dst_type, x.dst_slug);
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
