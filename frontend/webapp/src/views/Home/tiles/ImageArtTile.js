import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import ScriptureExcerpt, { readPath } from "src/views/_Common/ScriptureExcerpt";

/**
 * Standalone artwork tile. The piece shows at its real aspect with the artist
 * credited in a translucent ©-badge bottom-right over the image. Beneath, a
 * shaded centered header carries the title, then the ACTUAL scripture it
 * illustrates rendered in the Read experience (via ScriptureExcerpt), plus a
 * see-in-context link. The backend hands us a standard-format reference, so even
 * descriptively-headed pieces resolve to a real passage. Picks by index so the
 * default tile and its filler siblings each show a different work.
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
        {art.artist ? <div className="imageArtArtistBadge">&copy;&nbsp;{art.artist}</div> : null}
      </Link>
      {art.title ? <Link to={`/art/${art.id}`} className="imageArtTitleBar">{art.title}</Link> : null}
      <div className="imageArtCaption">
        {art.ref ? (
          <div className="imageArtScripture read-content scriptureExcerptCompact">
            {/* the header + "see in context" already navigate — drop the
                redundant Study button */}
            <ScriptureExcerpt refText={art.ref} hideStudy />
          </div>
        ) : null}
        {to ? <Link to={to} className="imageArtContext tileMoreLink">{label("view_in_context")}</Link> : null}
      </div>
    </div>
  );
}
