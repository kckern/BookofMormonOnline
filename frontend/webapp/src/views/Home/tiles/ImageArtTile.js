import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ScriptureExcerpt, { readPath } from "src/views/_Common/ScriptureExcerpt";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
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
 * R7 art-B1 (P1): every art tile has ONE frame height (Sampler.css
 * --art-frame-h), whatever the piece — the frame used to take each piece's own
 * aspect, so tiles ran 422–831px against one skeleton and shoved the page when
 * they resolved. The piece is fitted inside (artFit): a mild crop covers the
 * frame, a portrait or a strip is shown whole on the neutral mat.
 *
 * A failed image retries once, then the frame becomes a plain plate and the
 * caption (scripture + See in context) stays (R7 art-B4); no © credit is shown
 * for an absent picture.
 */
/**
 * Verses fed to the tile excerpt: from the anchor verse -1 onward, enough to
 * fill the fixed excerpt box (Sampler.css --art-excerpt-h), which clips the
 * rest with a fade (R3 B2: a 3-verse excerpt ran 99-564px and resized the tile).
 * The same count is the FLOOR (fillVerses): a one-verse ref is widened with the
 * verses after it, so the fade always cuts text (R6 art-A1-excerpt-box).
 */
export const ART_EXCERPT_VERSES = 6;

/** Frame width/height before it is measured (the desktop/phone column at --art-frame-h). */
export const ART_FRAME_ASPECT = 4 / 3;
/** Largest share of the piece `cover` may crop away before it is shown whole. */
export const ART_MAX_CROP = 0.25;

/** "cover" when the piece fills the frame with a mild crop, else "contain". */
export function artFit(pieceAspect, frameAspect = ART_FRAME_ASPECT) {
  const a = Number(pieceAspect);
  const f = Number(frameAspect) > 0 ? Number(frameAspect) : ART_FRAME_ASPECT;
  if (!(a > 0) || !Number.isFinite(a)) return "cover";
  const crop = 1 - Math.min(a, f) / Math.max(a, f);
  return crop <= ART_MAX_CROP ? "cover" : "contain";
}

/** Art ids a payload puts on the page: the default tile and its two fillers. */
export const featuredArtIds = (payload) => (payload?.art || []).slice(0, 3).map((a) => a?.id).filter((id) => id != null);

/** The payload without art pieces already shown up the feed (R7 art-H4). */
export const withoutSeenArt = (payload, seen) => {
  if (!payload || !Array.isArray(payload.art) || !seen?.size) return payload;
  return { ...payload, art: payload.art.filter((a) => !seen.has(a?.id)) };
};

const RETRY_MS = 1500;

/** Measured width/height of the frame (a full-width tablet tile is much wider). */
function useFrameAspect() {
  const ref = useRef(null);
  const [aspect, setAspect] = useState(ART_FRAME_ASPECT);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setAspect(Math.round((r.width / r.height) * 100) / 100);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, aspect];
}

export default function ImageArtTile({ payload, artIndex = 0 }) {
  // { id, n }: failures of the current piece (one retry, then the plate)
  const [failure, setFailure] = useState({ id: null, n: 0 });
  const [retried, setRetried] = useState(null); // id whose image was retried
  const [frameRef, frameAspect] = useFrameAspect();
  const pool = payload?.art || [];
  const art = pool.length ? pool[artIndex % pool.length] : null;
  const fails = art && failure.id === art.id ? failure.n : 0;
  useEffect(() => {
    if (fails !== 1 || retried === art?.id) return undefined;
    const t = setTimeout(() => setRetried(art.id), RETRY_MS);
    return () => clearTimeout(t);
  }, [fails, retried, art?.id]);
  if (!art?.id) return null;
  const failed = fails >= 2;
  const waiting = fails === 1 && retried !== art.id;
  const fit = artFit(art.width && art.height ? art.width / art.height : null, frameAspect);
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
        aria-describedby={art.artist && !failed && !waiting ? `imageArtCredit-${art.id}` : undefined}
      >
        {art.title ? <span className="imageArtTitleBar">{art.title}</span> : null}
        <span ref={frameRef} className={`imageArtFrame${failed ? " isFailed" : ""}`} data-fit={fit}>
          {/* art has no resized variants on the media host: original only */}
          {failed || waiting ? null : (
            <TileImage
              key={retried === art.id ? "retry" : "first"}
              path={`art/${art.id}`}
              uncapped /* the frame is a fixed height; the img is fitted inside it */
              widths={[]}
              alt={art.title ? "" : labelOr("artwork", "Artwork")}
              width={art.width || undefined}
              height={art.height || undefined}
              style={{ objectFit: fit }}
              onError={() => setFailure((f) => ({ id: art.id, n: (f.id === art.id ? f.n : 0) + 1 }))}
            />
          )}
          {failed ? <span className="imageArtUnavailable">{labelOr("art_image_unavailable", "Image unavailable")}</span> : null}
          {art.artist && !failed && !waiting ? <span className="imageArtArtistBadge" id={`imageArtCredit-${art.id}`}>&copy;&nbsp;{art.artist}</span> : null}
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
