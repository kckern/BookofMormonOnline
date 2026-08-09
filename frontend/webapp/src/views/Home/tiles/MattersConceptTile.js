import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import { clampWords, flatten } from "./textUtils";

/**
 * Concept matters (branch=concepts) — abstractions like Judgment Seat, Family,
 * Oaths. These read poorly as thumbnail mosaics, so cards are text-forward: name
 * + subtitle + a short description snippet over a muted image background.
 * Description is plain text (no scripture-link parsing) because the whole card is
 * an anchor; live scripture links live in MatterProfileTile. Card → /matters/<slug>.
 */
export default function MattersConceptTile({ data = [], seed = 0, payload }) {
  const cards = data.slice(0, 5);
  const mosaic = data.slice(5, 17);
  const total = payload?.mattersConceptCount || 0;
  return (
    <div className="samplerTileInner mattersTile mattersConceptTile">
      <h3 className="tileHeading">
        <Link to="/matters">{label("menu_matters")}</Link>
      </h3>
      <div className="mattersConceptGrid">
        {cards.map((m) => {
          const desc = flatten(m.description || m.subtitle || "");
          return (
            <Link
              to={`/matters/${m.slug}`}
              className="mattersConceptCard samplerCard"
              key={m.slug}
              style={{ backgroundImage: `url(${assetUrl}/matters/${m.slug})` }}
            >
              <div className="mattersConceptScrim">
                <span className="mattersConceptName">{replaceNumbers(m.name)}</span>
                {m.subtitle ? <span className="mattersConceptSub">{clampWords(m.subtitle, 10)}</span> : null}
                {desc ? <span className="mattersConceptDesc">{clampWords(desc, 24)}</span> : null}
              </div>
            </Link>
          );
        })}
        <Link to="/matters" className="mattersConceptCard viewAllCard mattersConceptViewAll" title={label("view_all")}>
          <div className="mattersConceptScrim">
            <span className="mattersConceptName">
              {total ? `+${total - data.length} ${label("menu_matters")}` : label("view_more")}
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
