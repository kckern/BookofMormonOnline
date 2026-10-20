import React, { useState } from "react";
import { Link } from "react-router-dom";
import ScriptureExcerpt, { readPath } from "src/views/_Common/ScriptureExcerpt";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import { capAspect } from "./_ds/mediaAspect";
import labelOr from "./_ds/labelOr";

/**
 * Standalone artwork tile. The shared uppercase eyebrow, then the title in the
 * heading tier (left-aligned, no fill) above the piece, which shows at its real aspect with the artist credited in a
 * translucent ©-badge bottom-right over the image. Title + image are ONE link to
 * the artwork page. Beneath the image, the ACTUAL scripture it illustrates
 * rendered in the Read experience (via ScriptureExcerpt), plus a see-in-context
 * link. The backend hands us a standard-format reference, so even
 * descriptively-headed pieces resolve to a real passage. Picks by index so the
 * default tile and its filler siblings each show a different work.
 *
 * A failed image drops the whole tile (`.tile-art:empty` collapses the shell)
 * rather than leaving a blank frame that still credits an absent picture.
 */
/**
 * Verses fed to the tile excerpt: from the anchor verse -1 onward, enough to
 * fill the fixed excerpt box (Sampler.css --art-excerpt-h), which clips the
 * rest with a fade (R3 B2: a 3-verse excerpt ran 99-564px and resized the tile).
 * The same count is the FLOOR (fillVerses): a one-verse ref is widened with the
 * verses after it, so the fade always cuts text (R6 art-A1-excerpt-box).
 */
export const ART_EXCERPT_VERSES = 6;

export default function ImageArtTile({ payload, artIndex = 0 }) {
  const [failedId, setFailedId] = useState(null);
  const pool = payload?.art || [];
  if (!pool.length) return null;
  const art = pool[artIndex % pool.length];
  if (!art?.id || failedId === art.id) return null;
  // height/width of the frame, portrait-capped (tiles/_ds/mediaAspect): a tall
  // strip is cropped to 3:4 on the tile; /art shows the whole piece (R6 A1/F1)
  const ratio = 1 / capAspect(art.width && art.height ? art.width / art.height : 1 / 0.66);
  const to = art.ref ? readPath(art.ref) : null;
  return (
    <div className="samplerTileInner imageArtTile">
      {/* the Home eyebrow every sibling carries (audit A3): names the category
          before the title ("Dissenters Are Hewn Down" — of what?) */}
      <h3 className="tileHeading imageArtEyebrow">{labelOr("art_eyebrow", "Art")}</h3>
      <Link
        to={`/art/${art.id}`}
        className="imageArtLink"
        aria-label={art.title || undefined}
        aria-describedby={art.artist ? `imageArtCredit-${art.id}` : undefined}
      >
        {art.title ? <span className="imageArtTitleBar">{art.title}</span> : null}
        <span className="imageArtFrame" style={{ aspectRatio: `1 / ${ratio}` }}>
          {/* art has no resized variants on the media host: original only */}
          <TileImage
            path={`art/${art.id}`}
            uncapped /* the frame above is capped; the img covers it */
            widths={[]}
            alt={art.title ? "" : labelOr("artwork", "Artwork")}
            width={art.width || undefined}
            height={art.height || undefined}
            onError={() => setFailedId(art.id)}
          />
          {art.artist ? <span className="imageArtArtistBadge" id={`imageArtCredit-${art.id}`}>&copy;&nbsp;{art.artist}</span> : null}
        </span>
      </Link>
      <div className="imageArtCaption">
        {art.ref ? (
          <div className="imageArtScripture read-content scriptureExcerptCompact">
            {/* the header + "see in context" already navigate — drop the
                redundant Study button. focusVerses: from the anchor verse -1, not
                the whole section range (audit H3); the box clips, See in context has the rest. */}
            <ScriptureExcerpt refText={art.ref} hideStudy refAsPopup highlight={art.title} focusVerses={ART_EXCERPT_VERSES} fillVerses={ART_EXCERPT_VERSES} />
          </div>
        ) : null}
        {to ? <TileDeepLink to={to} always verb="seeInContext" className="imageArtContext" /> : null}
      </div>
    </div>
  );
}
