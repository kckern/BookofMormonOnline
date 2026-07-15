import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { enDash } from "./textUtils";
import RefPill from "./RefPill";

const stripTags = (html) =>
  (html || "").replace(/<[^>]*>/gi, " ").replace(/\s+/g, " ").trim();

export default function CommentaryTile({ data }) {
  if (!data?.id) return null;
  const pub = data.publication || {};
  const author = [pub.source_name, pub.source_title].filter(Boolean).join(", ");
  // A title that already carries a verse reference makes the chip a second,
  // often *conflicting* range 8px away (feed anchor vs. coverage) — suppress it.
  const titleHasRef = /\d+\s*:\s*\d+/.test(data.title || "");
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
          {data.reference && !titleHasRef ? <RefPill refText={data.reference} /> : null}
          <div className="commentaryTileTitle">{enDash(data.title)}</div>
          {/* full text, scrolling when long — the fade + cue signal continuation */}
          <div className="commentaryTileScroll">
            <p className="commentaryTileExcerpt">{stripTags(data.text || data.preview)}</p>
          </div>
          {author ? <div className="commentaryTileSource">— {author}</div> : null}
          <div className="commentaryTileMore">{label("view_more")}</div>
        </div>
      </div>
    </Link>
  );
}
