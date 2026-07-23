import React from "react";
import { Link } from "react-router-dom";
import { lookupReference, generateReference } from "scripture-guide";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { readPath } from "src/views/_Common/ScriptureExcerpt";
import RefPill from "./RefPill";

/**
 * Standalone artwork tile. The piece shows at its real aspect with the title in
 * a shaded header across the top and the artist credited in a translucent
 * ©-badge bottom-right. Below, the scripture it illustrates is offered as a
 * standard-format scripture_link (RefPill), plus a see-in-context link. Picks by
 * index so the default tile and its filler siblings each show a different work.
 */
export default function ImageArtTile({ payload, artIndex = 0 }) {
  const pool = payload?.art || [];
  if (!pool.length) return null;
  const art = pool[artIndex % pool.length];
  if (!art?.id) return null;
  const ratio = art.width && art.height ? art.height / art.width : 0.66;
  // The backend already emits a standard reference; re-parse defensively so a
  // stale-cached descriptive heading degrades to "no link" rather than a broken
  // scripture_link.
  const stdRef = (() => {
    if (!art.ref) return null;
    const ids = lookupReference(art.ref)?.verse_ids || [];
    return ids.length ? generateReference(ids) : null;
  })();
  const to = stdRef ? readPath(stdRef) : null;
  return (
    <div className="samplerTileInner imageArtTile">
      <Link to={`/art/${art.id}`} className="imageArtFrame" style={{ aspectRatio: `1 / ${ratio}` }}>
        <img
          src={`${assetUrl}/art/${art.id}`}
          alt={art.title || ""}
          loading="lazy"
          onError={(e) => (e.target.style.visibility = "hidden")}
        />
        {art.title ? <div className="imageArtTitleBar">{art.title}</div> : null}
        {art.artist ? <div className="imageArtArtistBadge">&copy;&nbsp;{art.artist}</div> : null}
      </Link>
      <div className="imageArtCaption">
        {stdRef ? <RefPill refText={stdRef} className="imageArtRef" /> : null}
        {to ? <Link to={to} className="imageArtContext tileMoreLink">{label("view_in_context")}</Link> : null}
      </div>
    </div>
  );
}
