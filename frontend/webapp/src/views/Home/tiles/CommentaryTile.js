import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";

const excerpt = (c, words = 40) => {
  const stripped = (c.preview || c.text || "")
    .replace(/<[^>]*>/gi, "")
    .trim();
  if (!stripped) return "";
  const parts = stripped.split(/\s+/);
  return parts.slice(0, words).join(" ") + (parts.length > words ? "…" : "");
};

export default function CommentaryTile({ data }) {
  if (!data?.id) return null;
  return (
    <Link to={`/commentary/${data.id}`} className="samplerTileInner commentaryTile">
      <h3 className="tileHeading">{label("commentary")}</h3>
      <div className="commentaryTileTitle">{data.title}</div>
      <p className="commentaryTileExcerpt">{excerpt(data)}</p>
      {data.publication?.source_title ? (
        <div className="commentaryTileSource">— {data.publication.source_title}</div>
      ) : null}
    </Link>
  );
}
