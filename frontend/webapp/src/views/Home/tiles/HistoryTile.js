import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";

import { flatten, clampWords } from "./textUtils";

// The "Key Points:" structured tail reads as an unpunctuated run-on in a teaser.
const teaserText = (html) => clampWords(flatten(html).split(/key points:/i)[0].trim(), 60);

/** One featured historical document: thumb, title, provenance line, teaser. */
export default function HistoryTile({ data }) {
  if (!data?.id) return null;
  const to = data.slug ? `/history/${data.slug}` : "/history";
  const meta = [data.year, data.source || data.archive].filter(Boolean).join(" · ");
  return (
    <Link to={to} className="samplerTileInner historyTile">
      <h3 className="tileHeading">{label("history")}</h3>
      <div className="historyTileBody">
        <img
          className="historyTileThumb"
          src={`${assetUrl}/history/thumbs/${String(data.id).padStart(4, "0")}`}
          alt={data.document || ""}
          loading="lazy"
          onError={(e) => (e.target.style.display = "none")}
        />
        <div className="historyTileMain">
          <div className="historyTileTitle">{data.document}</div>
          {meta ? <div className="historyTileMeta">{meta}</div> : null}
          {data.teaser ? <p className="historyTileTeaser">{teaserText(data.teaser)}</p> : null}
        </div>
      </div>
    </Link>
  );
}
