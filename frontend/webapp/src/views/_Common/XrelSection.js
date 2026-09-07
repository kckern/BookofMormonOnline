/** @format */
import React, { useEffect } from "react";
import ReactTooltip from "react-tooltip";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import { verbLabel, tagLabel } from "./xrelVerbs";
import EntityThumb from "./EntityThumb";
import "./XrelSection.css";

/** dst_type → media asset folder. `group` has no artwork, hence no entry. */
const ASSET_PATH = { people: "people", place: "places", matter: "matters" };

/**
 * ReactTooltip id="relToolTip" is mounted inside PopUp.js's `Relationships`,
 * which renders on person popups only — a matter popup pointing at it would
 * get nothing. This section carries its own instance under its own id so the
 * two never collide when both render on a person popup.
 */
const TOOLTIP_ID = "xrelToolTip";

/**
 * Bucket rows by relation verb, keeping the first-appearance order of each
 * verb. The incoming array is sorted by verse_id, so first appearance keeps
 * narrative order at the group level.
 *
 * `direction` is part of the key: a "dst" row points AT this entity and reads
 * the other way round, so it cannot share a head with a "src" row of the same
 * verb without one of them lying.
 */
export function groupXrels(xrels) {
  const order = [];
  const byKey = {};
  xrels.forEach((x) => {
    const reverse = x.direction === "dst";
    const key = (x.rel || "") + "|" + (reverse ? "dst" : "src");
    if (!byKey[key]) {
      byKey[key] = { key, rel: x.rel, reverse, rows: [] };
      order.push(key);
    }
    byKey[key].rows.push(x);
  });
  return order.map((k) => byKey[k]);
}

/**
 * Cross-entity relationships (bom_xrels), shared by the matter, person, and
 * place popups. Rows are grouped under a verb head and rendered as a wrapping
 * 2-up card grid, mirroring the `.related_*` cards the person popup already
 * uses: thumbnail, one line of text, title in a tooltip, whole card clickable,
 * and no internal scroll — the popup column scrolls.
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
  // dst_type/src_type values on bom_xrels are 'matter', not the pre-rename 'object'
  // (see the Objects->Matters domain rename, commit aeea69b6) -- matching PopUp.js's
  // own "matters" dispatch and Matters.js/MattersFilter.js's setPopUp calls.
  if (type === "matter") return { type: "matters", ids: [slug], underSlug: "matters" };
  if (type === "group") return { type: "group", ids: [slug], underSlug: "group" };
  return null;
}

export default function XrelSection({ xrels, showEmpty, noHeading }) {
  const appController = useAppController();
  // Cards and the tooltip mount together, but re-render when data arrives late.
  useEffect(() => {
    ReactTooltip.rebuild();
  });

  const hasRows = Array.isArray(xrels) && xrels.length > 0;
  if (!hasRows && !showEmpty) return null;

  // popUpTargetFor (defined above), not ASSET_PATH (that's thumbnails only): it
  // also covers 'group', which has no thumbnail but does have a popup.
  const openXrel = (xrel) => {
    const target = popUpTargetFor(xrel.dst_type, xrel.dst_slug);
    if (target) appController.functions.setPopUp(target);
  };

  const card = (x, idx) => {
    const clickable = !!popUpTargetFor(x.dst_type, x.dst_slug);
    const assetType = ASSET_PATH[x.dst_type];
    return (
      <li
        key={idx}
        className={"xrel xrel-" + x.dst_type + (clickable ? " clickable" : "")}
        data-for={TOOLTIP_ID}
        data-tip={x.dst_title || undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? () => openXrel(x) : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openXrel(x);
                }
              }
            : undefined
        }
      >
        {assetType && (
          <EntityThumb type={assetType} slug={x.dst_slug} name={x.dst_name} size="2.5rem" />
        )}
        <div className="xrel-text">
          <span className={clickable ? "xrel-name nameLink" : "xrel-name xrel-tag"}>
          {clickable ? x.dst_name : tagLabel(x.dst_name)}
        </span>
          {x.note && <div className="xrel-note">{x.note}</div>}
        </div>
      </li>
    );
  };

  return (
    <>
      {!noHeading && <h4>{label("relationships")}</h4>}
      {hasRows ? (
        <>
          <ul className="xrels">
            {groupXrels(xrels).map((g) => (
              <React.Fragment key={g.key}>
                <li className={"xrel-group-head" + (g.reverse ? " reverse" : "")}>
                  {/* A reversed group reads "<card> … held by [this entity]", so the
                      elision sits ahead of the verb rather than the head claiming
                      this entity is the one held. */}
                  {g.reverse && <span className="xrel-group-elide">… </span>}
                  <span className="xrel-group-verb">{verbLabel(g.rel)}</span>
                  {g.rows.length > 1 && <span className="xrel-group-count">{g.rows.length}</span>}
                </li>
                {g.rows.map(card)}
              </React.Fragment>
            ))}
          </ul>
          <ReactTooltip
            id={TOOLTIP_ID}
            place="left"
            effect="solid"
            backgroundColor={"#666"}
            arrowColor={"#666"}
          />
        </>
      ) : (
        <p className="xrels-empty">{label("no_relationships") || "No relationships."}</p>
      )}
    </>
  );
}
