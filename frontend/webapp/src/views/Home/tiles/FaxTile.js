import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";

export default function FaxTile({ data }) {
  if (!data?.slug) return null;
  // Facsimiles.js builds page assets as `${assetUrl}/fax/pages/${slug}/NNN.<fmt>`
  // and derives the thumbnail by swapping "pages" → "thumb". Use page 1's thumb.
  const format = data.format || "jpg";
  const thumb = `${assetUrl}/fax/thumb/${data.slug}/001.${format}`;
  return (
    <Link to={`/fax/${data.slug}`} className="samplerTileInner faxTile">
      <h3 className="tileHeading">{label("facsimiles")}</h3>
      <img
        src={thumb}
        alt=""
        loading="lazy"
        onError={(e) => (e.target.style.visibility = "hidden")}
      />
      <div className="faxTileTitle">{data.title}</div>
      {data.pages ? <div className="faxTileMeta">{data.pages} pp.</div> : null}
    </Link>
  );
}
