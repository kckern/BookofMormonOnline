import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";

const excerpt = (c, words = 50) => {
  const stripped = (c.preview || c.text || "")
    .replace(/<[^>]*>/gi, "")
    .trim();
  if (!stripped) return "";
  const parts = stripped.split(/\s+/);
  return parts.slice(0, words).join(" ") + (parts.length > words ? "…" : "");
};

export default function CommentaryTile({ data }) {
  if (!data?.id) return null;
  const pub = data.publication || {};
  return (
    <Link to={`/commentary/${data.id}`} className="samplerTileInner commentaryTile">
      <h3 className="tileHeading">{label("commentary")}</h3>
      <div className="commentaryTileBody">
        {pub.source_id ? (
          <img
            className="commentaryTileCover"
            src={`${assetUrl}/source/cover/${String(pub.source_id).padStart(3, "0")}`}
            alt={pub.source_title || ""}
            loading="lazy"
            onError={(e) => (e.target.style.display = "none")}
          />
        ) : null}
        <div className="commentaryTileMain">
          {data.reference ? <span className="refChip">{data.reference}</span> : null}
          <div className="commentaryTileTitle">{data.title}</div>
          <p className="commentaryTileExcerpt">{excerpt(data)}</p>
          {pub.source_title ? (
            <div className="commentaryTileSource">— {pub.source_title}</div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
