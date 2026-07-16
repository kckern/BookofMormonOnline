import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import RefPill from "./RefPill";

// "1 Nephi 4:38" → /read/1-nephi-4/38 (first verse of a range) for the
// see-in-context link. Mirrors ScripturePopup's readPath.
const readPath = (ref) => {
  const m = /^(.+?)\s+(\d+)(?::[–-]?(\d+))?/.exec(ref || "");
  if (!m) return null;
  const bookCh = `${m[1].toLowerCase().replace(/\s+/g, "-")}-${m[2]}`;
  return `/read/${bookCh}${m[3] ? `/${m[3]}` : ""}`;
};

/**
 * Standalone artwork tile. Shows the piece at its real aspect, its title/artist,
 * the scripture reference it illustrates (chip → popup), and a see-in-context
 * link into that passage. Picks by index so the default tile and its filler
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
          <div className="imageArtRefRow">
            <RefPill refText={art.ref} />
            {to ? <Link to={to} className="imageArtContext tileMoreLink">{label("view_in_context")}</Link> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
