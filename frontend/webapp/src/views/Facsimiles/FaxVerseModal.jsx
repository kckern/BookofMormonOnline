import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { unionBox } from "./faxVerseData";

// Desired on-screen width of the verse cutout in the modal (px).
const CUTOUT_TARGET_W = 560;

/**
 * Inspector modal for a single verse: a cropped cutout of the page around the
 * verse, the speaker/voice avatar, and the verse text.
 *
 * Phase 1 is a static crop. Phase 3 swaps the cutout for a pan-zoom viewport and
 * adds cross-edition compare.
 *
 * Esc is handled window-capture with stopImmediatePropagation so it neither
 * turns a page nor exits the viewer to the grid (mirrors ScripturePopup).
 */
export default function FaxVerseModal({ verse, pageScale = 700, onClose }) {
  useEffect(() => {
    if (!verse) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" || e.keyCode === 27) {
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        e.preventDefault();
        onClose && onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [verse, onClose]);

  if (!verse) return null;

  const box = unionBox(verse.boxes) || { x: 0, y: 0, w: pageScale, h: pageScale };
  const s = CUTOUT_TARGET_W / box.w;            // scale so the verse box is ~target px wide
  const cropW = box.w * s;
  const cropH = box.h * s;

  const node = (
    <div className="faxVerseModal" role="dialog" aria-modal="true" aria-label={verse.ref}>
      <div className="faxVerseModal-backdrop" onClick={() => onClose && onClose()} />
      <div className="faxVerseModal-card">
        <button type="button" className="faxVerseModal-close" aria-label="Close" onClick={() => onClose && onClose()}>×</button>

        <div className="faxVerseModal-header">
          {verse.person_slug && (
            <img
              className="faxVerseModal-avatar"
              src={`${assetUrl}/people/${verse.person_slug}`}
              alt=""
              onError={(e) => { e.target.style.visibility = "hidden"; }}
            />
          )}
          <div className="faxVerseModal-heading">
            <div className="faxVerseModal-ref">{verse.ref}</div>
            {verse.voice && <div className="faxVerseModal-voice">{label(verse.voice)}</div>}
          </div>
        </div>

        <div className="faxVerseModal-cutout" style={{ width: cropW, height: cropH }}>
          {verse.pageAssetUrl && (
            <img
              src={verse.pageAssetUrl}
              alt=""
              style={{
                position: "absolute",
                width: pageScale * s,
                maxWidth: "none",
                left: -box.x * s,
                top: -box.y * s,
              }}
            />
          )}
        </div>

        {verse.text && <p className="faxVerseModal-text">{verse.text}</p>}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
