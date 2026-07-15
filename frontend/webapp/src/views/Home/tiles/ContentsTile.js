import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";

export default function ContentsTile({ data }) {
  if (!data?.slug) return null;
  return (
    <Link to="/contents" className="samplerTileInner contentsTile">
      <h3 className="tileHeading">{label("contents")}</h3>
      <img
        src={`${assetUrl}/home/${data.slug}-1`}
        alt=""
        loading="lazy"
        onError={(e) => (e.target.style.display = "none")}
      />
      <div className="contentsTileTitle">{data.title}</div>
      {data.description ? (
        <p className="contentsTileDesc">{data.description}</p>
      ) : null}
    </Link>
  );
}
