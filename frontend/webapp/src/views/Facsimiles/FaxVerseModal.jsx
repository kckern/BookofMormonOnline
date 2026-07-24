import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { assetUrl, renderBaseUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { unionBox } from "./faxVerseData";
import FaxVerseZoom from "./FaxVerseZoom";

// Desired on-screen width of the verse cutout in the modal (px).
const CUTOUT_TARGET_W = 560;

/**
 * Inspector modal for a single verse: a cropped image of the verse, the
 * speaker/voice avatar, the verse text, and prev/next verse navigation.
 *
 * Image source is HYBRID: a plain single-box verse is CSS-cropped from the page
 * scan (already warm, instant, free zoom context); a notched / multi-box /
 * cross-page verse uses the render-crop API, which composites the fragments and
 * paper-fills the notches server-side — the CSS rect can't do that cleanly.
 *
 * Esc / arrows are window-capture with stopImmediatePropagation so they don't
 * turn a page or exit the viewer to the grid (mirrors ScripturePopup).
 *
 * Props:
 *  - verse: the open verse ({ verse_id, ref, boxes, text, person_slug, voice, pageAssetUrl })
 *  - version: edition slug (for the render-crop API)
 *  - anchorX: viewport x of the spread's optical center (seam); the card centers there
 *  - onPrev/onNext: step to the adjacent verse (may flip the page behind the modal)
 */
export default function FaxVerseModal({ verse, version, pageScale = 700, anchorX = null, onPrev, onNext, onRead, onClose }) {
  useEffect(() => {
    if (!verse) return undefined;
    const onKey = (e) => {
      const stop = () => {
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        e.preventDefault();
      };
      if (e.key === "Escape" || e.keyCode === 27) { stop(); onClose && onClose(); }
      else if (e.key === "ArrowLeft") { stop(); onPrev && onPrev(); }
      else if (e.key === "ArrowRight") { stop(); onNext && onNext(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [verse, onPrev, onNext, onClose]);

  if (!verse) return null;

  const boxes = verse.boxes || [];
  // Reserve the cutout box from the KNOWN verse geometry so the image height is
  // fixed before it loads (no rug pull); the union bbox aspect is close enough.
  const box = unionBox(boxes) || { x: 0, y: 0, w: pageScale, h: pageScale };
  const s = CUTOUT_TARGET_W / box.w;
  const cropW = box.w * s;
  const cropH = box.h * s;

  const cardStyle = {
    position: "absolute",
    left: anchorX != null ? `${anchorX}px` : "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
  };

  const node = (
    <div className="faxVerseModal" role="dialog" aria-modal="true" aria-label={verse.ref}>
      <div className="faxVerseModal-backdrop" onClick={() => onClose && onClose()} />
      <div className="faxVerseModal-card" style={cardStyle}>
        <button type="button" className="faxVerseModal-close" aria-label="Close" onClick={() => onClose && onClose()}>×</button>

        <div className="faxVerseModal-header">
          {onPrev && (
            <button type="button" className="faxVerseModal-nav prev" aria-label="Previous verse" onClick={onPrev}>‹</button>
          )}
          {verse.person_slug && (
            <img
              className="faxVerseModal-avatar"
              src={`${assetUrl}/people/${verse.person_slug}`}
              alt=""
              onError={(e) => { e.target.style.visibility = "hidden"; }}
            />
          )}
          <div className="faxVerseModal-heading">
            {onRead ? (
              <button type="button" className="faxVerseModal-ref as-link" onClick={() => onRead(verse)} title="Open in the Reader">
                {verse.ref}
              </button>
            ) : (
              <div className="faxVerseModal-ref">{verse.ref}</div>
            )}
            {verse.voice && <div className="faxVerseModal-voice">{label(verse.voice)}</div>}
          </div>
          {onNext && (
            <button type="button" className="faxVerseModal-nav next" aria-label="Next verse" onClick={onNext}>›</button>
          )}
        </div>

        {version ? (
          // Native-res render crop in a hover magnifier. Fills the modal width at a
          // fixed landscape ratio (reserves height -> no rug pull). `wfull` so the
          // zoom shows real scan detail.
          <div className="faxVerseModal-cutout landscape" style={{ aspectRatio: `${box.w} / ${box.h}` }}>
            <FaxVerseZoom
              key={verse.verse_id}  /* remount so the previous verse's crop can't linger */
              src={`${renderBaseUrl}/fax/render/${version}/crop/wfull/ids/${verse.verse_id}.jpg`}
            />
          </div>
        ) : verse.pageAssetUrl ? (
          // Fallback with no render service: CSS crop of the page scan.
          <div className="faxVerseModal-cutout" style={{ width: cropW, height: cropH }}>
            <img
              key={verse.verse_id}
              src={verse.pageAssetUrl}
              alt=""
              style={{ position: "absolute", width: pageScale * s, maxWidth: "none", left: -box.x * s, top: -box.y * s }}
            />
          </div>
        ) : null}

        {verse.text && <p className="faxVerseModal-text">{verse.text}</p>}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
