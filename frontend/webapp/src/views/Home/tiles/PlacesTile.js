import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";

export default function PlacesTile({ data }) {
  return (
    <div className="samplerTileInner placesTile">
      <h3 className="tileHeading">
        <Link to="/places">{label("places")}</Link>
      </h3>
      <div className="placesTileStrip">
        {data.map((p) => (
          <Link to={`/places/${p.slug}`} key={p.slug} className="placesTileCard">
            <img
              src={`${assetUrl}/places/${p.slug}`}
              alt={p.name || ""}
              loading="lazy"
              onError={(e) => (e.target.style.visibility = "hidden")}
            />
            <div className="placesTileName">{p.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
