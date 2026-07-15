import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";

const stripTags = (html) =>
  (html || "").replace(/<[^>]*>/gi, " ").replace(/\s+/g, " ").trim();

export default function CommentaryTile({ data }) {
  if (!data?.id) return null;
  const pub = data.publication || {};
  const author = [pub.source_name, pub.source_title].filter(Boolean).join(" — ");
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
          {/* full text, scrolling when long — no excerpt truncation */}
          <p className="commentaryTileExcerpt">{stripTags(data.text || data.preview)}</p>
          {author ? <div className="commentaryTileSource">— {author}</div> : null}
        </div>
      </div>
    </Link>
  );
}
