import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { flatten, clampWords } from "./textUtils";

/**
 * Featured document, structured: thumb · title · provenance · lead paragraph ·
 * REAL Key-Points bullets (parsed from the teaser's list markup) · citation.
 */
const parseTeaser = (html) => {
  const raw = html || "";
  const bullets = [...raw.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => flatten(m[1]))
    .filter(Boolean)
    .slice(0, 4);
  const lead = clampWords(flatten(raw.split(/key points:/i)[0]), 50);
  return { lead, bullets };
};

export default function HistoryTile({ data }) {
  if (!data?.id) return null;
  const to = data.slug ? `/history/${data.slug}` : "/history";
  const meta = [data.year, data.source || data.archive, data.author].filter(Boolean).join(" · ");
  const { lead, bullets } = parseTeaser(data.teaser);
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
          {lead ? <p className="historyTileTeaser">{lead}</p> : null}
          {bullets.length ? (
            <ul className="historyTileBullets">
              {bullets.map((b, i) => (
                <li key={i}>{clampWords(b, 16)}</li>
              ))}
            </ul>
          ) : null}
          {data.citation ? <div className="historyTileCitation">{flatten(data.citation)}</div> : null}
        </div>
      </div>
    </Link>
  );
}
