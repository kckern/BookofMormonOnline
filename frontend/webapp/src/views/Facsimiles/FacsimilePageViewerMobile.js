import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useParams, useHistory, useLocation } from "react-router-dom";
import "./FacsimilePageViewer.scss";
import PageImage from "./PageImage";
import { openScripture } from "../_Common/ScripturePopup";
import { lookupReference } from "scripture-guide";
import { useFaxHighlight } from "./useFaxHighlight";
import FaxHighlightOverlay from "./FaxHighlightOverlay";

/**
 * FacsimilePageViewerMobile — continuous vertical scroll of the whole edition,
 * one page per row, with a rail (page # · reference) above each page and a
 * sticky header tracking the current page. Navigation: fling scrubber + preview,
 * and jump-to-reference. See docs/plans/2026-07-24-fax-mobile-infinite-scroll.md
 *
 * Virtualization: rows are a uniform height derived from a single measured
 * edition aspect ratio (scanned pages of one edition are near-identical size),
 * so only the pages near the viewport mount while spacers hold total height —
 * scroll position stays stable with no rug-pull.
 */
const RAIL_H = 34;   // px — inline rail above each page
const BUFFER = 2;    // rows rendered beyond the viewport each side

function FacsimilePageViewerMobile({ item, leafIndex, pgoffset, volumeOrder = [], currentVolumeIndex = -1 }) {
  const history = useHistory();
  const { pageNumber } = useParams();
  const location = useLocation();

  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const [containerW, setContainerW] = useState(0);
  const [aspect, setAspect] = useState(1 / 1.5); // w/h, refined once a scan loads
  const [currentIndex, setCurrentIndex] = useState(0);

  const [scrubOpen, setScrubOpen] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const total = leafIndex.length;
  const didInit = useRef(false);
  const lastWrittenSlug = useRef(null);

  const hasLetters = /[A-Za-z]/.test(pageNumber || '');
  const refParam = new URLSearchParams(location.search).get('ref') || (hasLetters ? pageNumber : null);
  const highlight = useFaxHighlight(item.slug, refParam);

  // Uniform row geometry from container width + measured aspect.
  const pageH = containerW > 0 ? Math.round(containerW / aspect) : 0;
  const ROW = pageH > 0 ? RAIL_H + pageH : 0;
  const ready = ROW > 0;

  // ---- Measure container + viewport (rAF-deferred + change-guarded so the
  //      ResizeObserver callback never re-enters synchronously → no loop warning) ----
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let raf = null;
    const read = () => {
      raf = null;
      setContainerW((w) => (w === el.clientWidth ? w : el.clientWidth));
      setViewportH((h) => (h === el.clientHeight ? h : el.clientHeight));
    };
    const schedule = () => { if (raf == null) raf = requestAnimationFrame(read); };
    read();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => { if (raf != null) cancelAnimationFrame(raf); try { ro.disconnect(); } catch {} };
  }, []);

  // ---- Measure the edition's aspect ratio once (from a real page scan) ----
  useEffect(() => {
    const probe = leafIndex.find((l) => l?.thumbAssetUrl || l?.pageAssetUrl);
    if (!probe) return undefined;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled && img.naturalHeight > 0) setAspect(img.naturalWidth / img.naturalHeight);
    };
    img.src = probe.thumbAssetUrl || probe.pageAssetUrl;
    return () => { cancelled = true; };
  }, [item.slug]);

  // ---- rAF-throttled scroll ----
  const rafRef = useRef(null);
  const onScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = scrollRef.current;
      if (el) setScrollTop(el.scrollTop);
    });
  }, []);
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  // ---- Resolve a URL page/ref to a leaf index ----
  const resolveIndex = useCallback((raw) => {
    if (raw == null) return 0;
    if (/[A-Za-z]/.test(raw)) {
      try {
        const verseIds = lookupReference(raw)?.verse_ids || [];
        if (verseIds.length) {
          const minId = Math.min(...verseIds);
          for (let i = 0; i < leafIndex.length; i++) {
            const pr = leafIndex[i]?.pageReference;
            if (pr && (lookupReference(pr)?.verse_ids || []).includes(minId)) return i;
          }
        }
      } catch { /* fall through */ }
      return 0;
    }
    const idx = leafIndex.findIndex((l) => `${l.pageSlugLeaf}` === `${raw}`);
    return idx !== -1 ? idx : 0;
  }, [leafIndex]);

  const scrollToIndex = useCallback((idx, smooth) => {
    const el = scrollRef.current;
    if (!el || !ready) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const useSmooth = smooth && !reduce;
    el.scrollTo({ top: idx * ROW, behavior: useSmooth ? 'smooth' : 'auto' });
    // For instant jumps, sync the windowing state immediately so the target rows
    // mount in the same commit (no blank frame). Smooth jumps let onScroll drive it.
    if (!useSmooth) setScrollTop(idx * ROW);
  }, [ready, ROW]);

  // ---- Initial deep-link scroll + external URL changes (edition switch / ref jump) ----
  useEffect(() => {
    if (!ready) return;
    // Ignore URL changes we caused ourselves via scroll sync.
    if (didInit.current && pageNumber === lastWrittenSlug.current) return;
    const idx = resolveIndex(pageNumber);
    setCurrentIndex(idx);
    setScrubValue(idx);
    scrollToIndex(idx, didInit.current); // instant on first paint, smooth thereafter
    didInit.current = true;
  }, [ready, pageNumber, resolveIndex, scrollToIndex]);

  // ---- Track the centered page → sticky header + debounced URL sync ----
  const syncTimer = useRef(null);
  useEffect(() => {
    if (!ready) return;
    const idx = Math.max(0, Math.min(total - 1, Math.floor((scrollTop + viewportH / 2) / ROW)));
    if (idx !== currentIndex) {
      setCurrentIndex(idx);
      if (!scrubOpen) setScrubValue(idx);
    }
    const slug = leafIndex[idx]?.pageSlugLeaf;
    if (slug != null && `${slug}` !== `${lastWrittenSlug.current}`) {
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        lastWrittenSlug.current = `${slug}`;
        history.replace(`/fax/${item.slug}/${slug}`);
      }, 180);
    }
  }, [scrollTop, viewportH, ROW, ready, total]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(syncTimer.current), []);

  // ---- Preload scans just beyond the mounted window ----
  const start = ready ? Math.max(0, Math.floor(scrollTop / ROW) - BUFFER) : 0;
  const end = ready ? Math.min(total - 1, Math.ceil((scrollTop + viewportH) / ROW) + BUFFER) : -1;
  useEffect(() => {
    if (!ready) return;
    for (let i = end + 1; i <= Math.min(total - 1, end + 3); i++) {
      const u = leafIndex[i]?.pageAssetUrl;
      if (u) { const img = new Image(); img.src = u; }
    }
  }, [end, ready, total, leafIndex]);

  const rows = useMemo(() => {
    if (!ready) return [];
    const out = [];
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }, [start, end, ready]);

  const topSpacer = ready ? start * ROW : 0;
  const bottomSpacer = ready ? Math.max(0, (total - 1 - end) * ROW) : 0;

  const currentLeaf = leafIndex[currentIndex] || null;
  const previewLeaf = leafIndex[scrubValue] || null;

  // Volume up/down still switches edition, keeping the current page.
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!Array.isArray(volumeOrder) || currentVolumeIndex < 0) return;
        const next = volumeOrder[currentVolumeIndex + (e.key === 'ArrowUp' ? -1 : 1)];
        if (!next) return;
        e.preventDefault();
        const slug = currentLeaf?.pageSlugLeaf;
        history.push(slug ? `/fax/${next.slug}/${slug}` : `/fax/${next.slug}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [volumeOrder, currentVolumeIndex, history, currentLeaf?.pageSlugLeaf]);

  const renderRow = (i) => {
    const leaf = leafIndex[i];
    if (!leaf) return null;
    const boxes = highlight.boxesByPage.get(leaf.pageNumInt);
    return (
      <div key={leaf.leafCursor ?? i} className="faxScrollRow" style={{ height: ROW }}>
        <div className="faxScrollRail">
          <span className="rail-page">Page {leaf.faxPageSlug}</span>
          {leaf.pageReference && (
            <span
              className="rail-ref scripture_link"
              role="button"
              tabIndex={0}
              onClick={() => openScripture(leaf.pageReference)}
              onKeyDown={(e) => { if (e.key === 'Enter') openScripture(leaf.pageReference); }}
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
          {boxes && boxes.length > 0 && (
            <FaxHighlightOverlay boxes={boxes} pageScale={highlight.pageScale} />
          )}
        </div>
      </div>
    );
  };

  const submitJump = (e) => {
    e.preventDefault();
    const raw = e.target.elements.jumpInput.value.trim();
    if (!raw) return;
    const idx = resolveIndex(raw);
    setScrubOpen(false);
    scrollToIndex(idx, false); // instant — smooth across hundreds of pages is janky
  };

  return (
    <div className="faxMobileViewer">
      {/* Sticky header — current page + reference */}
      <div className="faxScrollHeader">
        <span className="hdr-page">Page {currentLeaf?.faxPageSlug ?? ''}</span>
        {currentLeaf?.pageReference && (
          <span
            className="hdr-ref scripture_link"
            role="button"
            tabIndex={0}
            onClick={() => openScripture(currentLeaf.pageReference)}
            onKeyDown={(e) => { if (e.key === 'Enter') openScripture(currentLeaf.pageReference); }}
          >{currentLeaf.pageReference}</span>
        )}
        <button
          type="button"
          className="faxScrubToggle"
          aria-label="Navigate pages"
          onClick={() => { setScrubValue(currentIndex); setScrubOpen((o) => !o); }}
        >⇅</button>
      </div>

      {/* Virtualized scroll column */}
      <div className="faxScrollColumn" ref={scrollRef} onScroll={onScroll}>
        {!ready ? (
          <div className="faxScrollLoading">Loading…</div>
        ) : (
          <>
            <div style={{ height: topSpacer }} aria-hidden="true" />
            {rows.map(renderRow)}
            <div style={{ height: bottomSpacer }} aria-hidden="true" />
          </>
        )}
      </div>

      {/* Scrubber sheet — fling across the book + jump-to-reference */}
      {scrubOpen && (
        <div className="faxScrubSheet">
          <div className="scrub-row">
            <input
              type="range"
              min={0}
              max={Math.max(0, total - 1)}
              step={1}
              value={scrubValue}
              onChange={(e) => setScrubValue(parseInt(e.target.value, 10))}
              onMouseUp={() => scrollToIndex(scrubValue, false)}
              onTouchEnd={() => scrollToIndex(scrubValue, false)}
              className="custom-slider"
              aria-label="Scrub pages"
            />
            {previewLeaf && (
              <div className="scrub-preview">
                <img src={previewLeaf.thumbAssetUrl} alt="" aria-hidden="true" />
                <div className="preview-label">
                  {previewLeaf.pageReference || `Page ${previewLeaf.faxPageSlug}`}
                </div>
              </div>
            )}
          </div>
          <form className="scrub-jump" onSubmit={submitJump}>
            <input
              name="jumpInput"
              type="text"
              placeholder="Go to page or reference (e.g. Alma 32)"
              aria-label="Jump to page or reference"
            />
            <button type="submit">Go</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default FacsimilePageViewerMobile;
