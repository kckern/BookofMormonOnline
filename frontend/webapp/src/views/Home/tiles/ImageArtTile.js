import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import ScriptureExcerpt, { readPath } from "src/views/_Common/ScriptureExcerpt";

/**
 * Standalone artwork tile. Shows the piece at its real aspect, its title/artist,
 * then the ACTUAL scripture it illustrates rendered in the Read experience
 * (speaker circle, voice, verse typography) via ScriptureExcerpt, plus a
 * see-in-context link. Picks by index so the default tile and its filler
 * siblings each show a different work.
 */
export default function ImageArtTile({ payload, artIndex = 0 }) {
  const pool = payload?.art || [];
  if (!pool.length) return null;
  const art = pool[artIndex % pool.length];
  if (!art?.id) return null;
  const ratio = art.width && art.height ? art.height / art.width : 0.66;
  const to = readPath(art.ref);
  return (
    <div className="samplerTileInner imageArtTile">
      <Link to={`/art/${art.id}`} className="imageArtFrame" style={{ aspectRatio: `1 / ${ratio}` }}>
        <img
          src={`${assetUrl}/art/${art.id}`}
          alt={art.title || ""}
          loading="lazy"
          onError={(e) => (e.target.style.visibility = "hidden")}
        />
      </Link>
      <div className="imageArtCaption">
        {art.title ? <Link to={`/art/${art.id}`} className="imageArtTitle">{art.title}</Link> : null}
        {art.artist ? <span className="imageArtArtist">{art.artist}</span> : null}
        {art.ref ? (
          <div className="imageArtScripture read-content scriptureExcerptCompact">
            <ScriptureExcerpt refText={art.ref} />
          </div>
        ) : null}
        {to ? <Link to={to} className="imageArtContext tileMoreLink">{label("view_in_context")}</Link> : null}
      </div>
    </div>
  );
}
