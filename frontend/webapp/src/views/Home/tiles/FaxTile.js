import React, { useState } from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import Lightbox from "./Lightbox";

/**
 * A few real pages side by side (broken thumbs hide themselves — never gray
 * placeholder slots). Clicking a page opens it full-size in a lightbox; the
 * title links through to the full facsimile viewer.
 */
export default function FaxTile({ data, seed = 0 }) {
  const [lightbox, setLightbox] = useState(null); // "NNN" page id or null
  if (!data?.slug) return null;
  // Facsimiles.js builds page assets as `${assetUrl}/fax/pages/${slug}/NNN.<fmt>`
  // and derives the thumbnail by swapping "pages" → "thumb".
  const format = data.format || "jpg";
  // Sample a run from the MIDDLE of the document (front pages are covers and
  // flyleaves — featureless); seeded so the pick is session-stable.
  const total = data.pages || 1;
  const windowStart = total > 6
    ? Math.floor(total * 0.2) + (seed % Math.max(1, Math.floor(total * 0.6)))
    : 1;
  const first = Math.min(Math.max(1, windowStart), Math.max(1, total - 1));
  // Two LARGER samples beat three illegible ones at tile width.
  const pageNums = [first, first + 1].filter((n) => n <= total);
  return (
    <div className="samplerTileInner faxTile">
      <h3 className="tileHeading">
        <Link to={`/fax/${data.slug}`}>{label("facsimiles")}</Link>
      </h3>
      <div className="faxTilePages">
        {pageNums.map((n) => {
          const nnn = String(n).padStart(3, "0");
          return (
            <img
              key={nnn}
              src={`${assetUrl}/fax/thumb/${data.slug}/${nnn}.${format}`}
              alt={`${data.title} p.${n}`}
              loading="lazy"
              onClick={() => setLightbox(nnn)}
              onError={(e) => (e.target.style.display = "none")}
            />
          );
        })}
      </div>
      <Link to={`/fax/${data.slug}`} className="faxTileTitleLink">
        <div className="faxTileTitle">{data.title}</div>
        {data.pages ? <div className="faxTileMeta">{data.pages} pp.</div> : null}
      </Link>
      {lightbox ? (
        <Lightbox
          src={`${assetUrl}/fax/pages/${data.slug}/${lightbox}.${format}`}
          alt={data.title}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}
