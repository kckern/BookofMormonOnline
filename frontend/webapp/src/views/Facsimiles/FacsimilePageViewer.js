import React, { useState, useCallback, useEffect, useRef, useMemo, useReducer } from "react";
import { useParams, useHistory } from "react-router-dom";
import ReactTooltip from "react-tooltip";
import { useSwipe } from "../../models/Utils";
import { assetUrl } from 'src/models/BoMOnlineAPI';
import "./FacsimilePageViewer.scss";
import { getRefFromIndex, PageOverlay } from "./Facsimiles";
import { useElementSize } from "./useElementSize";
import PageImage from "./PageImage";
import PageStack from "./PageStack";
import FaxPageFlip, { FAX_FLIP_MS, FAX_SETTLE_MS } from "./FaxPageFlip";
import { openScripture } from "../_Common/ScripturePopup";
import { prefetchThumbs, isThumbWarm } from "./faxThumbCache";
import { generateReference, lookupReference } from "scripture-guide";
import { normalizeStackWidths } from "./faxGeometry";
import { getFaxRatio, setFaxRatio } from "./faxRatioCache";
import { useFaxVerses } from "./useFaxVerses";
import FaxVerseCutout from "./FaxVerseCutout";
import FaxVerseModal from "./FaxVerseModal";
import { faxVerseReducer, initialFaxVerseState } from "./faxVerseState";

/**
 * FacsimilePageViewer - Desktop version of the facsimile page viewer
 * Displays pages in a book-like spread with left and right pages
 */
function FacsimilePageViewer({ item, leafIndex, pgoffset, volumeOrder = [], currentVolumeIndex = -1, onSeamOffset }) {
  const history = useHistory();
  const { pageNumber } = useParams();
  
  // All hooks must be called at the top level before any conditionals
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 });
  const sliderRef = useRef(null);
  const pagesContainerRef = useRef(null);
  const spreadInnerRef = useRef(null);
  const containerSize = useElementSize(pagesContainerRef);
  const [leftRatio, setLeftRatio] = useState(0.75);
  const [rightRatio, setRightRatio] = useState(0.75);
  // Transient page-turn animation. `flip` holds the overlay payload; flipRef
  // mirrors it so the imperative turn handlers can guard re-entrancy without
  // waiting for a re-render. See docs/plans/2026-07-24-fax-page-turn-animation.md
  const [flip, setFlip] = useState(null);
  const [settling, setSettling] = useState(false); // true during the post-landing cross-fade
  const flipRef = useRef(null);        // the in-flight turn (null = idle). Lock for animateTo.
  const committedRef = useRef(false);  // has this turn already committed its navigation?
  const committingRef = useRef(false);  // true only while the flip commits its OWN nav
  const flipTimerRef = useRef(null);   // parent-level hard-clear backstop
  const settleTimerRef = useRef(null); // cross-fade teardown timer
  const prefersReducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Single teardown path for the flip overlay: releases the animateTo lock,
  // clears the backstop timer, and unmounts the overlay. Safe to call from any
  // code path (land, external nav, volume switch, unmount).
  const cancelFlip = useCallback(() => {
    if (flipTimerRef.current) { clearTimeout(flipTimerRef.current); flipTimerRef.current = null; }
    if (settleTimerRef.current) { clearTimeout(settleTimerRef.current); settleTimerRef.current = null; }
    flipRef.current = null;
    setSettling(false);
    setFlip(null);
  }, []);

  // Never leave a timer running past unmount.
  useEffect(() => () => {
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, []);
  
  // A scripture reference has BOTH letters and digits (e.g. "alma.5.12").
  // Roman-numeral front-matter slugs ("i", "ii", "iii") are letters-only and
  // must NOT be treated as references, or navigating to them fails a lookup and
  // bounces back to page 1. Numeric page slugs are digits-only.
  const isReference = /[A-Za-z]/.test(pageNumber || '') && /\d/.test(pageNumber || '');
  const totalPages = leafIndex.length;

  // Initialize page index based on URL
  useEffect(() => {
    // Special handling for the last page (or any specific page)
    if (pageNumber === String(item.pages) || parseInt(pageNumber) === item.pages) {
      // Direct check for the last page by its number
      const lastPageIndex = leafIndex.findIndex(leaf => 
        leaf.pageNumInt === parseInt(pageNumber) || `${leaf.pageSlugLeaf}` === pageNumber
      );
      
      if (lastPageIndex !== -1) {
        setCurrentPageIndex(lastPageIndex);
        setSliderValue(lastPageIndex);
        return;
      }
    }
    
    // Handle reference URLs (book + chapter/verse, e.g. "alma.5.12")
    if (isReference) {
      try {
        const refs = lookupReference(pageNumber);
        const verseIds = refs?.verse_ids || [];
        
        if (verseIds.length > 0) {
          // Get the minimum verse ID to find the first page containing this reference
          const minVerseId = Math.min(...verseIds);
          
          // Look for a page containing this verse ID
          for (let i = 0; i < leafIndex.length; i++) {
            const page = leafIndex[i];
            if (page?.pageReference) {
              const pageVerseIds = lookupReference(page.pageReference)?.verse_ids || [];
              if (pageVerseIds.includes(minVerseId)) {
                setCurrentPageIndex(i);
                setSliderValue(i);
                return;
              }
            }
          }
        }
        
        // If we can't find a match, just default to page 1
        setCurrentPageIndex(0);
        setSliderValue(0);
        return;
      } catch (e) {
        // If reference parsing fails, default to page 1
        setCurrentPageIndex(0);
        setSliderValue(0);
        return;
      }
    }
    
    // Standard page lookup for numeric pages
    const index = leafIndex.findIndex(leaf => `${leaf.pageSlugLeaf}` === pageNumber);
    
    if (index !== -1) {
      setCurrentPageIndex(index);
      setSliderValue(index);
    } else {
      // If page not found, check if it's the last page
      const lastPageNum = leafIndex[leafIndex.length - 1]?.pageSlugLeaf;
      if (lastPageNum && `${lastPageNum}` === pageNumber) {
        // It's the last page but wasn't found with exact match - handle special case
        const lastIndex = leafIndex.length - 1;
        setCurrentPageIndex(lastIndex);
        setSliderValue(lastIndex);
      } else {
        // If we can't find a match, just default to page 1
        setCurrentPageIndex(0);
        setSliderValue(0);
      }
    }
  }, [pageNumber, leafIndex, item.pages, isReference]);

  // Keep the slider thumb aligned when the page changes by any means
  // (arrows, buttons, stack, deep link). Audit §2.3.
  useEffect(() => { setSliderValue(currentPageIndex); }, [currentPageIndex]);

  // Adjust page index to ensure even pages are on the left
  const getAdjustedPageIndex = useCallback((index) => {
    if (index <= 0) return 0; // Handle first page
    
    // Handle the last page - whether it's odd or even
    if (index === totalPages - 1) {
      // For the last page, if it's odd, show it on the right of previous even page
      if (index % 2 !== 0) {
        return index - 1;
      } 
      // If it's even, show it on the left side as usual
      // (the right side will be blank in this case)
      return index;
    }
    
    // Standard case: ensure even pages are on left
    return index % 2 === 0 ? index : index - 1;
  }, [totalPages]);

  // Preload adjacent pages
  const getPagesToPreload = useCallback(() => {
    if (!leafIndex) return [];
    const preloadRange = 4;
    const startIdx = Math.max(0, currentPageIndex - preloadRange);
    const endIdx = Math.min(leafIndex.length - 1, currentPageIndex + preloadRange);
    return leafIndex.slice(startIdx, endIdx + 1);
  }, [currentPageIndex, leafIndex]);

  useEffect(() => {
    const pagesToLoad = getPagesToPreload();
    pagesToLoad.forEach(page => {
      const url = page.pageAssetUrl;
      if (!url) return;
      const img = new Image();
      // Warm the ratio cache ahead of the turn so the landed spread never has to
      // settle its dimensions (kills the post-turn jitter + ResizeObserver churn).
      img.onload = () => { if (img.naturalHeight > 0) setFaxRatio(url, img.naturalWidth / img.naturalHeight); };
      img.src = url;
    });
  }, [getPagesToPreload]);

  const adjustedPageIndex = getAdjustedPageIndex(currentPageIndex);
  const leftPage = leafIndex[adjustedPageIndex] || null;
  const rightPage = leafIndex[adjustedPageIndex + 1] || null;

  // Verse-inspector data + UI state for the visible spread.
  const faxVerses = useFaxVerses(item.slug, leftPage, rightPage);
  const [vstate, vdispatch] = useReducer(faxVerseReducer, initialFaxVerseState);
  // Clear hover/open on any spread or edition change (also covers page-flip).
  useEffect(() => { vdispatch({ type: "RESET" }); }, [adjustedPageIndex, item.slug]);

  // Load left page image and calculate aspect ratio. Seed synchronously from the
  // cache when known (adjacent pages are preloaded) so the spread lands at the
  // right size with no post-turn resize; refine + cache on load for cold pages.
  useEffect(() => {
    if (!leftPage) {
      setLeftRatio(0.75);
      return undefined;
    }
    const url = leftPage.thumbAssetUrl || leftPage.pageAssetUrl;
    const cached = getFaxRatio(leftPage.thumbAssetUrl, leftPage.pageAssetUrl);
    if (cached) setLeftRatio(cached);
    const img = new Image();
    img.onload = () => {
      if (img.naturalHeight > 0) {
        const r = img.naturalWidth / img.naturalHeight;
        setFaxRatio(url, r);
        setLeftRatio(r);
      }
    };
    img.src = url;
    return () => { img.onload = null; };
  }, [leftPage?.thumbAssetUrl, leftPage?.pageAssetUrl]);

  // Load right page image and calculate aspect ratio (see left, above).
  useEffect(() => {
    if (!rightPage) {
      setRightRatio(0.75);
      return undefined;
    }
    const url = rightPage.thumbAssetUrl || rightPage.pageAssetUrl;
    const cached = getFaxRatio(rightPage.thumbAssetUrl, rightPage.pageAssetUrl);
    if (cached) setRightRatio(cached);
    const img = new Image();
    img.onload = () => {
      if (img.naturalHeight > 0) {
        const r = img.naturalWidth / img.naturalHeight;
        setFaxRatio(url, r);
        setRightRatio(r);
      }
    };
    img.src = url;
    return () => { img.onload = null; };
  }, [rightPage?.thumbAssetUrl, rightPage?.pageAssetUrl]);

  const { leftStackWidth, rightStackWidth } = useMemo(
    () => {
      const { left, right } = normalizeStackWidths(adjustedPageIndex, totalPages, 160);
      return { leftStackWidth: left, rightStackWidth: right };
    },
    [adjustedPageIndex, totalPages]
  );

  // Calculate page dimensions width-first: fill horizontal space (after stacks),
  // then derive a uniform height that preserves each page's intrinsic ratio.
  const { leftPageWidth, rightPageWidth, calculatedHeight } = useMemo(() => {
    // Don't recalculate until container size is stable and reasonable
    const containerH = containerSize.height || 0;
    const containerW = containerSize.width || 0;
    const containerTop = containerSize.top || 0;
    const viewportH = containerSize.viewportH || 0;
    
    // Don't calculate dimensions until we have a reasonable container size
    if (containerH < 100 || containerW < 100) {
      return { 
        leftPageWidth: undefined, 
        rightPageWidth: undefined, 
        calculatedHeight: undefined 
      };
    }
    
    // Use stable aspect ratios with defaults
    const safeLeftRatio = Number.isFinite(leftRatio) && leftRatio > 0 ? leftRatio : 0.75;
    const safeRightRatio = Number.isFinite(rightRatio) && rightRatio > 0 ? rightRatio : 0.75;
    
    // PRIORITIZE WIDTH USAGE:
    // Use the full container width for content (no internal empty space),
    // allowing a tiny 1px rounding margin.
    const stackSpace = leftStackWidth + rightStackWidth;
    const pageSpaceWidth = Math.max(0, containerW - stackSpace);

    // Derive the uniform page height directly from available width and ratios:
    // lw + rw = H*(rL + rR) = pageSpaceWidth  =>  H = pageSpaceWidth / (rL + rR)
    const totalRatio = safeLeftRatio + safeRightRatio;
  const rawHeightFromWidth = totalRatio > 0 ? pageSpaceWidth / totalRatio : 0;

  // Also respect the available viewport height so nav remains visible and pages aren't clipped
  const NAV_MIN = 50; // px
  const MARGIN = 12; // breathing room
  const availableH = viewportH > 0 ? Math.max(1, Math.floor(viewportH - containerTop - NAV_MIN - MARGIN)) : Infinity;

  const pageHeight = Math.max(1, Math.floor(Math.min(rawHeightFromWidth, availableH)));

    // Compute exact widths from the uniform height
    const lw = Math.max(0, Math.floor(pageHeight * safeLeftRatio));
    const rw = Math.max(0, Math.floor(pageHeight * safeRightRatio));

    return {
      leftPageWidth: lw,
      rightPageWidth: rw,
      calculatedHeight: pageHeight
    };
  }, [
    // Reduce sensitivity to small changes by rounding container dimensions
    Math.floor(containerSize.width / 10) * 10, 
  Math.floor(containerSize.height / 10) * 10,
    // Use fixed precision for ratios to avoid constant recalculation 
    Number(leftRatio.toFixed(2)),
    Number(rightRatio.toFixed(2)),
    // Stack widths should be stable already
    leftStackWidth, 
    rightStackWidth
  ]);

  const innerWidth = useMemo(() => {
    // If we don't have calculated page widths yet, don't force a width
    if (!leftPageWidth || !rightPageWidth) return null;

    // Exact content width: stacks + pages (no internal extra space)
    return leftStackWidth + leftPageWidth + rightPageWidth + rightStackWidth;
  }, [leftPageWidth, rightPageWidth, leftStackWidth, rightStackWidth]);

  // Report the seam's x-offset from center so the toolbar title can track it.
  // The spread strip is centered, so the seam (between left & right pages) sits
  // at delta = (leftSide - rightSide)/2 px from the container center.
  useEffect(() => {
    if (typeof onSeamOffset !== 'function') return;
    if (!leftPageWidth || !rightPageWidth) { onSeamOffset(0); return; }
    const delta = (leftStackWidth + leftPageWidth - rightPageWidth - rightStackWidth) / 2;
    onSeamOffset(delta);
  }, [onSeamOffset, leftStackWidth, rightStackWidth, leftPageWidth, rightPageWidth]);

  // Anchor offset (px) for the scripture popup: the seam's x-position relative to
  // the VIEWPORT center. The popup is position:fixed and centered on the viewport,
  // but the spread is centered on the content area (offset by any sidebar), so we
  // measure the live seam from the DOM at click time rather than reusing the
  // content-area-relative onSeamOffset value.
  const seamAnchorFromDom = useCallback(() => {
    const rect = spreadInnerRef.current?.getBoundingClientRect();
    if (!rect || !leftPageWidth) return 0;
    const seamViewportX = rect.left + leftStackWidth + leftPageWidth;
    return Math.round(seamViewportX - window.innerWidth / 2);
  }, [leftStackWidth, leftPageWidth]);

  // Navigation handlers
  const handlePageChange = useCallback((newIndex) => {
    // Any navigation that isn't the flip's own landing commit (slider, stack,
    // jump-to-page) cancels an in-flight turn immediately so its stale overlay
    // can't later revert the user's choice.
    if (flipRef.current && !committingRef.current) cancelFlip();
    const adjustedIndex = getAdjustedPageIndex(newIndex);
    const targetPage = leafIndex[adjustedIndex];
    if (targetPage) {
      history.replace(`/fax/${item.slug}/${targetPage.pageSlugLeaf}`);
    }
  }, [history, item.slug, leafIndex, getAdjustedPageIndex, cancelFlip]);

  // Resolve the left (even) leaf index a forward/back turn should land on,
  // preserving the pre-existing nav semantics (2 pages at a time, even-last clamp).
  const resolveTarget = useCallback((dir) => {
    if (dir === 'next') {
      const newIndex = Math.min(totalPages - 1, currentPageIndex + 2);
      if (totalPages % 2 === 0 && newIndex >= totalPages - 2) return totalPages - 2;
      return getAdjustedPageIndex(newIndex);
    }
    return getAdjustedPageIndex(Math.max(0, currentPageIndex - 2));
  }, [currentPageIndex, totalPages, getAdjustedPageIndex]);

  // Play the single-leaf flip transitioning from the current spread to ANY target
  // spread (direction inferred from target vs. current) — so slider scrubs,
  // jump-to-page and page-stack clicks animate too, not just adjacent turns.
  // Falls back to an instant commit when the layout isn't measured yet, the user
  // prefers reduced motion, or a turn is already animating.
  const animateTo = useCallback((targetRaw) => {
    const base = adjustedPageIndex;
    const targetLeft = getAdjustedPageIndex(targetRaw);
    if (targetLeft === base) return; // same spread — nothing to do

    const dir = targetLeft > base ? 'next' : 'prev';
    const ready = !!(leftPageWidth && rightPageWidth && calculatedHeight);
    if (flipRef.current || prefersReducedMotion || !ready) {
      handlePageChange(targetLeft);
      return;
    }

    // Prefer a warm full-res scan for crispness; fall back to the (prefetched)
    // thumbnail so far-away jumps still show artwork instead of a blank face.
    const faceUrl = (i) => {
      const l = leafIndex[i];
      if (!l) return null;
      if (l.pageAssetUrl && isThumbWarm(l.pageAssetUrl)) return l.pageAssetUrl;
      return l.thumbAssetUrl || l.pageAssetUrl || null;
    };
    // Capture the spread's viewport rect so the overlay can be portaled to <body>
    // and float above the chrome (toolbar/nav) for the 3D curl.
    const rect = spreadInnerRef.current?.getBoundingClientRect();
    const geom = {
      leftStackWidth, leftPageWidth, rightPageWidth, height: calculatedHeight,
      viewport: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
    };
    // The leaf carries current→destination; behind it the destination spread is
    // revealed. Reduces exactly to the single-step turn when targetLeft = base±2.
    // `base`/`slug` let the teardown effect + commit guard detect when the world
    // has moved out from under an in-flight turn.
    const payload = dir === 'next'
      ? {
          dir, geom, target: targetLeft, base, slug: item.slug,
          behindLeftUrl: faceUrl(base),            // current left — covered on land
          behindRightUrl: faceUrl(targetLeft + 1), // destination right — revealed
          leafFrontUrl: faceUrl(base + 1),         // current right (front of leaf)
          leafBackUrl: faceUrl(targetLeft),        // destination left (back of leaf)
        }
      : {
          dir, geom, target: targetLeft, base, slug: item.slug,
          behindLeftUrl: faceUrl(targetLeft),      // destination left — revealed
          behindRightUrl: faceUrl(base + 1),       // current right — covered
          leafFrontUrl: faceUrl(base),             // current left (front of leaf)
          leafBackUrl: faceUrl(targetLeft + 1),    // destination right (back of leaf)
        };
    committedRef.current = false;
    flipRef.current = payload;
    setFlip(payload);
    // Backstop: no matter what happens (animationend never fires, a commit
    // no-ops, the DOM detaches), force the overlay down so the viewer can never
    // deadlock behind a stuck flip.
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    flipTimerRef.current = setTimeout(() => cancelFlip(), FAX_FLIP_MS * 4);
  }, [adjustedPageIndex, getAdjustedPageIndex, leftPageWidth, rightPageWidth, calculatedHeight,
      leftStackWidth, leafIndex, prefersReducedMotion, handlePageChange, item.slug, cancelFlip]);

  // Commit the navigation the moment the leaf lands. Guard against a stale turn
  // whose edition changed underneath it, and against a double-fire.
  const handleFlipDone = useCallback(() => {
    const p = flipRef.current;
    if (!p || committedRef.current) return;
    if (p.slug !== item.slug) { cancelFlip(); return; } // edition switched mid-flip
    committedRef.current = true;
    committingRef.current = true;
    handlePageChange(p.target);
    committingRef.current = false;
    // Two-phase teardown: the leaf has landed flat on the new spread, which is
    // now committed underneath. Cross-fade the overlay out (rather than the
    // instant unmount below) so the compositing-layer handoff doesn't snap.
    setSettling(true);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => cancelFlip(), FAX_SETTLE_MS);
  }, [handlePageChange, item.slug, cancelFlip]);

  // Tear the overlay down once the live spread has actually moved — whether that
  // was our own landing commit (adjustedPageIndex -> target) or any external nav
  // / edition switch. Keying on "moved away from base" (not "=== target") means a
  // missed round-trip can never leave the overlay stuck.
  useEffect(() => {
    const p = flipRef.current;
    if (!p) return;
    // Our own landing commit owns teardown (it runs the cross-fade settle, then
    // cancels). Only force an immediate cancel for EXTERNAL moves we didn't
    // commit (edition switch / jump mid-flip), where there's nothing to fade to.
    if (committedRef.current) return;
    if (adjustedPageIndex !== p.base || item.slug !== p.slug) cancelFlip();
  }, [adjustedPageIndex, item.slug, cancelFlip]);

  // Update to move 2 pages at a time
  const handleSwipeLeft = useCallback(() => animateTo(resolveTarget('next')), [animateTo, resolveTarget]);
  const handleSwipeRight = useCallback(() => animateTo(resolveTarget('prev')), [animateTo, resolveTarget]);

  const swipeHandlers = useSwipe({
    onSwipedLeft: handleSwipeLeft,
    onSwipedRight: handleSwipeRight
  });

  // Arrow key navigation: left/right pages, up/down volumes
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); handleSwipeRight(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); handleSwipeLeft(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!Array.isArray(volumeOrder) || currentVolumeIndex < 0) return;
        const isUp = e.key === 'ArrowUp';
        const nextIndex = isUp ? currentVolumeIndex - 1 : currentVolumeIndex + 1;
        const next = volumeOrder[nextIndex];
        if (!next) return;
        e.preventDefault();
        // Switching editions changes leafIndex/slug — cancel any in-flight turn
        // so its stale overlay doesn't commit against the new edition.
        if (flipRef.current) cancelFlip();

        // Try to navigate using reference if available, otherwise use page number
        let targetPath;
        
        if (leftPage?.pageReference) {
          // Get verse IDs from the left page reference
          const verseIds = lookupReference(leftPage.pageReference)?.verse_ids || [];
          if (verseIds.length > 0) {
            // Get the minimum verse ID to use as the reference point
            const minVerseId = Math.min(...verseIds);
            // Generate a reference for just this verse ID
            const slugifiedRef = generateReference([minVerseId])
              .replace(/[ :]+/g, '.')
              .toLowerCase();
            targetPath = `/fax/${next.slug}/${slugifiedRef}`;
          } else {
            // No verse IDs found, fall back to page number
            const targetSlug = leftPage?.pageSlugLeaf || rightPage?.pageSlugLeaf;
            targetPath = targetSlug ? `/fax/${next.slug}/${targetSlug}` : `/fax/${next.slug}`;
          }
        } else {
          // No reference available, use page number
          const targetSlug = leftPage?.pageSlugLeaf || rightPage?.pageSlugLeaf;
          targetPath = targetSlug ? `/fax/${next.slug}/${targetSlug}` : `/fax/${next.slug}`;
        }
        
        history.push(targetPath);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSwipeLeft, handleSwipeRight, volumeOrder, currentVolumeIndex, history, cancelFlip, leftPage?.pageSlugLeaf, rightPage?.pageSlugLeaf, leftPage?.pageReference, rightPage?.pageReference]);

  // Slider interaction handlers
  const handleSliderChange = useCallback((e) => {
    setSliderValue(parseInt(e.target.value, 10));
  }, []);

  const handleSliderRelease = useCallback(() => {
    animateTo(sliderValue);
  }, [animateTo, sliderValue]);

  const handleSliderMouseMove = useCallback((e) => {
    if (!sliderRef.current) return;
    
    const sliderRect = sliderRef.current.getBoundingClientRect();
    const position = (e.clientX - sliderRect.left) / sliderRect.width;
    let value = Math.round(position * (totalPages - 1));

    // Adjust value to ensure even pages on left
    value = value % 2 === 0 ? value : value - 1;
    if (value < 0) value = 0;
    
    // Handle case where value is beyond the last valid page spread
    if (value > totalPages - 2) {
      value = totalPages - 2; // Always show the last valid spread (last or second-to-last page on right)
    }

    // Warm the thumbnails around the scrub position so the preview swaps
    // instantly instead of flashing/loading while scrubbing.
    const warm = [];
    for (let i = Math.max(0, value - 4); i <= Math.min(leafIndex.length - 1, value + 5); i++) {
      const u = leafIndex[i]?.thumbAssetUrl;
      if (u) warm.push(u);
    }
    prefetchThumbs(warm);

    const leftPage = leafIndex[value];
    const rightPage = leafIndex[value + 1];

    const leftPageVerseIds = lookupReference(leftPage?.pageReference || '')?.verse_ids || [];
    const rightPageVerseIds = lookupReference(rightPage?.pageReference || '')?.verse_ids || [];
    const combinedVerseIds = Array.from(new Set([...leftPageVerseIds, ...rightPageVerseIds]));
    const combinedReference = generateReference(combinedVerseIds);

    if (leftPage) {
      setTooltipContent(
        <div className="tooltip-content">
          {/* Display two thumbnails side by side */}
          <div className="thumbnail-spread">
            <img
              src={leftPage.thumbAssetUrl}
              alt={`Thumbnail of page ${leftPage.faxPageSlug}`}
              style={{ width: '50px', aspectRatio: String(leftRatio || 1 / 1.5) }}
            />
            {rightPage && (
              <img
                src={rightPage.thumbAssetUrl}
                alt={`Thumbnail of page ${rightPage.faxPageSlug}`}
                style={{ width: '50px', aspectRatio: String(rightRatio || 1 / 1.5) }}
              />
            )}
          </div>
          {!!combinedVerseIds.length && (
            <p className="ref">{combinedReference}</p>
          )}
          <p className="pages">
            Pages {leftPage.faxPageSlug}
            {rightPage ? ` - ${rightPage.faxPageSlug}` : ''}
          </p>
        </div>
      );
      // Clamp left position to keep tooltip within the slider container
      const rawLeft = e.clientX - sliderRect.left;
      const clampedLeft = Math.max(16, Math.min(sliderRect.width - 16, rawLeft));
      setTooltipPosition({
        left: clampedLeft
      });
      setShowTooltip(true);
    }
  }, [leafIndex, totalPages]);

  // Page rendering
  const renderPage = (page, onClick) => {
    if (!page) {
      // Return a blank placeholder for missing pages
      return <div className="blankPage"></div>;
    }
    
    // Special handling for the last page
    const isLastPage = (pgoffset !== undefined && page.pageNumInt === totalPages - pgoffset) || 
                       page.pageSlugLeaf === leafIndex[leafIndex.length - 1]?.pageSlugLeaf;
    
    // Determine which side (left or right) for additional styling if needed
    const isLeft = page === leftPage;
    const aspectRatio = isLeft ? leftRatio : rightRatio;
    const pageVerses = faxVerses.versesByPage.get(page.pageNumInt) || [];

    return (
      <>
        <PageImage
          src={page.pageAssetUrl}
          previewSrc={page.thumbAssetUrl}
          label={`Page ${page.faxPageSlug}`}
          reference={page.pageReference}
          alt={`Page ${page.faxPageSlug}`}
          onClick={onClick}
          className={isLastPage ? "last-page" : ""}
          style={{
            aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
            height: '100%',
            width: 'auto'
          }}
        />
        {pageVerses.length > 0 && (
          <FaxVerseCutout
            verses={pageVerses}
            pageScale={faxVerses.pageScale}
            displayedWidth={isLeft ? leftPageWidth : rightPageWidth}
            idSuffix={page.pageNumInt}
            activeVerseId={vstate.activeVerseId}
            onHover={(id) => vdispatch({ type: "HOVER", verseId: id })}
            onLeave={() => vdispatch({ type: "LEAVE" })}
            onOpen={(verse) => vdispatch({ type: "OPEN", verse: { ...verse, pageAssetUrl: page.pageAssetUrl } })}
          />
        )}
      </>
    );
  };

  // Page stack is now a separate component
  return (
    <div className="faxPageViewer" style={{ maxHeight: 'none' }} {...swipeHandlers}>
      <div
        className="pageReferences"
        style={{
          // Match the spread strip and inset by the stack widths so each ref
          // aligns to its page's outer edge (not the full-width strip incl. stacks).
          width: innerWidth ? `${innerWidth}px` : undefined,
          margin: '0 auto',
          paddingLeft: leftStackWidth ? `${leftStackWidth}px` : undefined,
          paddingRight: rightStackWidth ? `${rightStackWidth}px` : undefined,
          boxSizing: 'border-box',
        }}
      >
        <a
          className="scripture_link"
          style={{ textAlign: 'left', visibility: leftPage?.pageReference ? 'visible' : 'hidden', cursor: 'pointer' }}
          onClick={() => leftPage?.pageReference && openScripture(leftPage.pageReference, { anchorX: seamAnchorFromDom() })}
        >{leftPage?.pageReference || ''}</a>
        <a
          className="scripture_link"
          style={{ textAlign: 'right', visibility: rightPage?.pageReference ? 'visible' : 'hidden', cursor: 'pointer' }}
          onClick={() => rightPage?.pageReference && openScripture(rightPage.pageReference, { anchorX: seamAnchorFromDom() })}
        >{rightPage?.pageReference || ''}</a>
      </div>
      <div className="pagesContainer" ref={pagesContainerRef}>
        <div
          className="pageContainer"
          onClick={(e) => {
            // Only the empty L/R padding around the centered spread (clicks on a
            // page/stack/image are handled by those elements themselves).
            if (e.target !== e.currentTarget) return;
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientX < rect.left + rect.width / 2) handleSwipeRight();
            else handleSwipeLeft();
          }}
        >
          <div
            className="spreadInner"
            ref={spreadInnerRef}
            style={{
              width: innerWidth ? `${innerWidth}px` : undefined,
              display: 'flex', 
              alignItems: 'stretch', 
              justifyContent: 'flex-start',
              gap: 0,
              // Center the exact-width strip; outside space is allowed only outside stacks
              margin: '0 auto',
              // Positioning context for the transient page-turn overlay
              position: 'relative'
            }}
          >
            {adjustedPageIndex > 0 && (
              <PageStack
                side="left"
                leafIndex={leafIndex}
                adjustedPageIndex={adjustedPageIndex}
                totalPages={totalPages}
                onPageChange={animateTo}
                stackWidthPx={leftStackWidth}
              />
            )}

            <div 
              className="page leftPage" 
              style={{
                width: leftPageWidth ? `${leftPageWidth}px` : undefined,
                height: calculatedHeight ? `${calculatedHeight}px` : undefined,
                // Flex for centering image within the page box
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
            {/* If first page, show blank left page */}
            {adjustedPageIndex === 0 ? (
              <div className="blankPage"></div>
            ) : (
              renderPage(leftPage, handleSwipeRight)
            )}
            </div>
            <div 
              className="page rightPage" 
              style={{
                width: rightPageWidth ? `${rightPageWidth}px` : undefined,
                height: calculatedHeight ? `${calculatedHeight}px` : undefined,
                // Flex for centering
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
            {/* Special handling for the final page in a book with even page count */}
            {(totalPages % 2 === 0 && adjustedPageIndex === totalPages - 2) ? 
              renderPage(rightPage || null, () => {}) : // Disable clicking on the last page
              renderPage(rightPage || null, handleSwipeLeft)
            }
            </div>

            {/* Only show right stack if we're not at the last page or second-to-last page spread */}
            {(adjustedPageIndex < totalPages - 2 || 
              (totalPages % 2 === 0 && adjustedPageIndex < totalPages - 1)) && (
              <PageStack
                side="right"
                leafIndex={leafIndex}
                adjustedPageIndex={adjustedPageIndex}
                totalPages={totalPages}
                onPageChange={animateTo}
                stackWidthPx={rightStackWidth}
              />
            )}

            {flip && (
              <FaxPageFlip
                dir={flip.dir}
                geom={flip.geom}
                behindLeftUrl={flip.behindLeftUrl}
                behindRightUrl={flip.behindRightUrl}
                leafFrontUrl={flip.leafFrontUrl}
                leafBackUrl={flip.leafBackUrl}
                settling={settling}
                onDone={handleFlipDone}
              />
            )}
            <FaxVerseModal
              verse={vstate.openVerse}
              pageScale={faxVerses.pageScale}
              onClose={() => vdispatch({ type: "CLOSE" })}
            />
          </div>
        </div>
      </div>

      <div 
        className="facsimile-navigation" 
        style={{ 
          // Keep nav compact; we'll widen pages before changing nav height
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 0',
          position: 'relative',
          zIndex: 1,
          // Match content width exactly when known; otherwise don't force it
          width: innerWidth ? `${innerWidth}px` : undefined,
          margin: '0 auto'
        }}
      >
        <button
          className="nav-button"
          onClick={handleSwipeRight}
          disabled={currentPageIndex <= 0}
          aria-label="Previous pages"
        >
          &#8249;
        </button>
        <div className="slider-container" ref={sliderRef}>
          {showTooltip && (
            <div
              className="custom-tooltip"
              style={{
                left: `${tooltipPosition.left}px`,
                top: 'auto',
                bottom: '48px', // 40px slider height + 8px gap
                transform: 'translateX(-50%)'
              }}
            >
              {tooltipContent}
            </div>
          )}
          <input
            type="range"
            min={0}
            max={totalPages - (totalPages % 2 === 0 ? 1 : 2)}
            step={2} // Move slider in steps of 2 for desktop (page spreads)
            value={sliderValue}
            onChange={handleSliderChange}
            onMouseUp={handleSliderRelease}
            onTouchEnd={handleSliderRelease}
            onMouseMove={handleSliderMouseMove}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="custom-slider"
            aria-label="Page position"
            aria-valuetext={`Page ${leafIndex[sliderValue]?.faxPageSlug ?? sliderValue} of ${item.pages}`}
          />
        </div>
        <button
          className="nav-button"
          onClick={handleSwipeLeft}
          disabled={currentPageIndex >= totalPages - (totalPages % 2 === 0 ? 1 : 2)}
          aria-label="Next pages"
        >
          &#8250;
        </button>
        <form
          className="fax-page-jump"
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(e.target.elements.pageInput.value, 10);
            if (!Number.isFinite(n)) return;
            const idx = leafIndex.findIndex((l) => l.faxPageNum === n || `${l.faxPageSlug}` === `${n}`);
            if (idx !== -1) animateTo(idx);
          }}
        >
          <input
            name="pageInput"
            type="number"
            min={1}
            max={item.pages}
            defaultValue={leftPage?.faxPageSlug || ''}
            key={leftPage?.faxPageSlug}
            aria-label="Jump to page"
          />
          <span className="of-total">/ {item.pages}</span>
        </form>
      </div>
    </div>
  );
}

export default FacsimilePageViewer;
