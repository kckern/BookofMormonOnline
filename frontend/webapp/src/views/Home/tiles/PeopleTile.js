import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";

export default function PeopleTile({ data }) {
  return (
    <div className="samplerTileInner peopleTile">
      <h3 className="tileHeading">
        <Link to="/people">{label("people")}</Link>
      </h3>
      <div className="peopleTileGrid">
        {data.map((p) => (
          <Link to={`/people/${p.slug}`} key={p.slug} className="peopleTileCard">
            <img
              src={`${assetUrl}/people/${p.slug}`}
              alt={p.name || ""}
              loading="lazy"
              onError={(e) => (e.target.style.visibility = "hidden")}
            />
            <div className="peopleTileName">{p.name}</div>
            {p.title ? <div className="peopleTileTitle">{p.title}</div> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
