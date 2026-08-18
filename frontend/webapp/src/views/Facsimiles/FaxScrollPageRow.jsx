import React, { useEffect, useRef, useState } from "react";
import PageImage from "./PageImage";
import FaxHighlightOverlay from "./FaxHighlightOverlay";
import { openScripture } from "../_Common/ScripturePopup";
import { useFaxPageVerses } from "./useFaxPageVerses";

/**
 * Tap-only verse hotspots over a page scan (mobile — NO hover behaviour). Boxes are
 * in `pageScale` space; the layer measures its own width and scales by width/pageScale
 * (same geometry as FaxHighlightOverlay so it aligns with the highlight boxes).
 */
function VerseHotspots({ verses, pageScale, onOpen }) {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let raf = null;
    const read = () => { raf = null; setW((cur) => { const nw = el.getBoundingClientRect().width; return cur === nw ? cur : nw; }); };
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    // rAF-batch so the observer never re-lays-out within its own notification
    // ("ResizeObserver loop completed with undelivered notifications").
    const schedule = () => { if (raf == null) raf = requestAnimationFrame(read); };
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => { if (raf != null) cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  const k = w > 0 ? w / pageScale : 0;
  return (
    <div ref={ref} className="faxTapLayer">
      {k > 0 && verses.flatMap((v) =>
        v.boxes.map((b, i) => (
          <button
            key={`${v.verse_id}-${i}`}
            type="button"
            className="faxTapHotspot"
            aria-label={v.ref}
            style={{
              left: `${Math.round(b.x * k)}px`,
              top: `${Math.round(b.y * k)}px`,
              width: `${Math.round(b.w * k)}px`,
              height: `${Math.round(b.h * k)}px`,
            }}
            onClick={() => onOpen(v, verses)}
          />
        ))
      )}
    </div>
  );
}

/**
 * One page row in the mobile infinite-scroll viewer: the inline rail, the page scan,
 * the (optional) reference-highlight overlay, and the tappable verse hotspots that
 * open the verse inspector drawer.
 */
export default function FaxScrollPageRow({ leaf, row, pageH, version, highlight, onOpenVerse }) {
  const { verses, pageScale } = useFaxPageVerses(version, leaf);
  const hlBoxes = highlight.boxesByPage.get(leaf.pageNumInt);
  return (
    <div className="faxScrollRow" style={{ height: row }}>
      <div className="faxScrollRail">
        <span className="rail-page">Page {leaf.faxPageSlug}</span>
        {leaf.pageReference && (
          <span
            className="rail-ref scripture_link"
            role="button"
            tabIndex={0}
            onClick={() => openScripture(leaf.pageReference)}
            onKeyDown={(e) => { if (e.key === "Enter") openScripture(leaf.pageReference); }}
          >{leaf.pageReference}</span>
        )}
      </div>
      <div className="faxScrollPage" style={{ height: pageH }}>
        <PageImage
          src={leaf.pageAssetUrl}
          previewSrc={leaf.thumbAssetUrl}
          alt={`Page ${leaf.faxPageSlug}`}
          label={leaf.pageReference || `Page ${leaf.faxPageSlug}`}
          loading="lazy"
        />
        {hlBoxes && hlBoxes.length > 0 && (
          <FaxHighlightOverlay boxes={hlBoxes} pageScale={highlight.pageScale} />
        )}
        {verses.length > 0 && (
          <VerseHotspots verses={verses} pageScale={pageScale} onOpen={onOpenVerse} />
        )}
      </div>
    </div>
  );
}
