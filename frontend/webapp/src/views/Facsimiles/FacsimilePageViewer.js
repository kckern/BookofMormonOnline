import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useParams, useHistory } from "react-router-dom";
import ReactTooltip from "react-tooltip";
import { useSwipe } from "../../models/Utils";
import { assetUrl } from 'src/models/BoMOnlineAPI';
import "./FacsimilePageViewer.scss";
import { getRefFromIndex, PageOverlay } from "./Facsimiles";
import PageImage from "./PageImage";
import PageStack from "./PageStack";
import { generateReference, lookupReference } from "scripture-guide";

/**
 * FacsimilePageViewer - Desktop version of the facsimile page viewer
 * Displays pages in a book-like spread with left and right pages
 */
function FacsimilePageViewer({ item, leafIndex, pgoffset, volumeOrder = [], currentVolumeIndex = -1 }) {
  const history = useHistory();
  const { pageNumber } = useParams();

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 });
  const sliderRef = useRef(null);

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
    
    // Standard page lookup
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
      }
    }
  }, [pageNumber, leafIndex, item.pages]);

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
      const img = new Image();
      img.src = page.pageAssetUrl;
    });
  }, [getPagesToPreload]);

  const adjustedPageIndex = getAdjustedPageIndex(currentPageIndex);
  const leftPage = leafIndex[adjustedPageIndex] || null;
  const rightPage = leafIndex[adjustedPageIndex + 1] || null;

  // Measure container size to compute intrinsic page widths
  const pagesContainerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!pagesContainerRef.current) return;
    const el = pagesContainerRef.current;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Derive aspect ratios from thumbnails (fallback to 3:4)
  const [leftRatio, setLeftRatio] = useState(0.75);
  const [rightRatio, setRightRatio] = useState(0.75);

  useEffect(() => {
    if (!leftPage) { setLeftRatio(0.75); return; }
    const img = new Image();
    img.onload = () => {
      if (img.naturalHeight > 0) setLeftRatio(img.naturalWidth / img.naturalHeight);
    };
    img.src = leftPage.thumbAssetUrl || leftPage.pageAssetUrl;
    return () => { img.onload = null; };
  }, [leftPage?.thumbAssetUrl, leftPage?.pageAssetUrl]);

  useEffect(() => {
    if (!rightPage) { setRightRatio(0.75); return; }
    const img = new Image();
    img.onload = () => {
      if (img.naturalHeight > 0) setRightRatio(img.naturalWidth / img.naturalHeight);
    };
    img.src = rightPage.thumbAssetUrl || rightPage.pageAssetUrl;
    return () => { img.onload = null; };
  }, [rightPage?.thumbAssetUrl, rightPage?.pageAssetUrl]);

  // Estimate stack widths to keep empty space outside stacks
  const { leftStackWidth, rightStackWidth } = useMemo(() => {
    const leftCount = Math.max(0, adjustedPageIndex);
    const rightCount = Math.max(0, totalPages - (adjustedPageIndex + 2));
    return {
      leftStackWidth: Math.min(200, leftCount),
      rightStackWidth: Math.min(200, rightCount)
    };
  }, [adjustedPageIndex, totalPages]);

  // Compute page widths (px) from container height and aspect ratios; scale to fit container width
  const { leftPageWidth, rightPageWidth } = useMemo(() => {
    const h = containerSize.height || 0;
    if (h <= 0) return { leftPageWidth: undefined, rightPageWidth: undefined };
    let lw = h * (leftRatio || 0.75);
    let rw = h * (rightRatio || 0.75);
    const available = containerSize.width;
    // total content includes stacks and two pages; no internal gaps
    const total = leftStackWidth + lw + rw + rightStackWidth;
    if (available > 0 && total > available) {
      const s = available / total;
      lw = Math.floor(lw * s);
      rw = Math.floor(rw * s);
    }
    return { leftPageWidth: lw, rightPageWidth: rw };
  }, [containerSize.width, containerSize.height, leftRatio, rightRatio, leftStackWidth, rightStackWidth]);

  const innerWidth = useMemo(() => {
    const lw = leftPageWidth || 0;
    const rw = rightPageWidth || 0;
    return leftStackWidth + lw + rw + rightStackWidth;
  }, [leftPageWidth, rightPageWidth, leftStackWidth, rightStackWidth]);

  // Navigation handlers
  const handlePageChange = useCallback((newIndex) => {
    const adjustedIndex = getAdjustedPageIndex(newIndex);
    const targetPage = leafIndex[adjustedIndex];
    if (targetPage) {
      history.push(`/fax/${item.slug}/${targetPage.pageSlugLeaf}`);
    }
  }, [history, item.slug, leafIndex, getAdjustedPageIndex]);

  // Update to move 2 pages at a time
  const handleSwipeLeft = useCallback(() => {
    // For the last page(s), adjust how far to move based on whether totalPages is even or odd
    const newIndex = Math.min(totalPages - 1, currentPageIndex + 2);
    // Handle special case for even-numbered last page
    if (totalPages % 2 === 0 && newIndex >= totalPages - 2) {
      handlePageChange(totalPages - 2); // Go to second-to-last spread
    } else {
      handlePageChange(newIndex);
    }
  }, [currentPageIndex, totalPages, handlePageChange]);

  const handleSwipeRight = useCallback(() => {
    handlePageChange(Math.max(0, currentPageIndex - 2));
  }, [currentPageIndex, handlePageChange]);

  const swipeHandlers = useSwipe({
    onSwipedLeft: handleSwipeLeft,
    onSwipedRight: handleSwipeRight
  });

  // Arrow key navigation: left/right pages, up/down volumes
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); handleSwipeRight(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); handleSwipeLeft(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!Array.isArray(volumeOrder) || currentVolumeIndex < 0) return;
        const isUp = e.key === 'ArrowUp';
        const nextIndex = isUp ? currentVolumeIndex - 1 : currentVolumeIndex + 1;
        const next = volumeOrder[nextIndex];
        if (!next) return;
        e.preventDefault();
        // Try to navigate to same page number slug if exists
        const targetSlug = leftPage?.pageSlugLeaf || rightPage?.pageSlugLeaf;
        const targetPath = targetSlug ? `/fax/${next.slug}/${targetSlug}` : `/fax/${next.slug}`;
        history.push(targetPath);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSwipeLeft, handleSwipeRight, volumeOrder, currentVolumeIndex, history, leftPage?.pageSlugLeaf, rightPage?.pageSlugLeaf]);

  // Slider interaction handlers
  const handleSliderChange = useCallback((e) => {
    setSliderValue(parseInt(e.target.value, 10));
  }, []);

  const handleSliderRelease = useCallback(() => {
    handlePageChange(sliderValue);
  }, [handlePageChange, sliderValue]);

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
              alt={`Thumbnail of page ${leftPage.pageSlugLeaf}`}
              style={{ width: '50px', height: 'auto' }}
            />
            {rightPage && (
              <img
                src={rightPage.thumbAssetUrl}
                alt={`Thumbnail of page ${rightPage.pageSlugLeaf}`}
                style={{ width: '50px', height: 'auto' }}
              />
            )}
          </div>
          {!!combinedVerseIds.length && (
            <p className="ref">{combinedReference}</p>
          )}
          <p className="pages">
            Pages {leftPage.pageSlugLeaf}
            {rightPage ? ` - ${rightPage.pageSlugLeaf}` : ''}
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
    
    return (
      <PageImage
        src={page.pageAssetUrl}
        previewSrc={page.thumbAssetUrl}
        label={`Page ${page.pageSlugLeaf}`}
        reference={page.pageReference}
        alt={`Page ${page.pageSlugLeaf}`}
        onClick={onClick}
        className={isLastPage ? "last-page" : ""}
      />
    );
  };

  // Page stack is now a separate component

  return (
    <div className="faxPageViewer" style={{ maxHeight: 'none' }} {...swipeHandlers}>
      <div className="pageReferences">
        <h6>{leftPage?.pageReference || ''}</h6>
        <h6>{rightPage?.pageReference || ''}</h6>
      </div>
      <div className="pagesContainer" ref={pagesContainerRef}>
        <div className="pageContainer">
          <div className="spreadInner" style={innerWidth ? { width: `${innerWidth}px`, display: 'flex', alignItems: 'stretch', gap: 0 } : { display: 'flex', alignItems: 'stretch', gap: 0 }}>
            {adjustedPageIndex > 0 && (
              <PageStack
                side="left"
                leafIndex={leafIndex}
                adjustedPageIndex={adjustedPageIndex}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                width={leftStackWidth}
              />
            )}

            <div className="page leftPage" style={leftPageWidth ? { width: `${leftPageWidth}px` } : undefined}>
            {/* If first page, show blank left page */}
            {adjustedPageIndex === 0 ? (
              <div className="blankPage"></div>
            ) : (
              renderPage(leftPage, handleSwipeRight)
            )}
            </div>
            <div className="page rightPage" style={rightPageWidth ? { width: `${rightPageWidth}px` } : undefined}>
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
                onPageChange={handlePageChange}
                width={rightStackWidth}
              />
            )}
          </div>
        </div>
      </div>

      <div className="facsimile-navigation">
        <button
          className="nav-button"
          onClick={handleSwipeRight}
          disabled={currentPageIndex <= 0}
        >
          &#8249;
        </button>
        <div className="slider-container" ref={sliderRef}>
          {showTooltip && (
            <div
              className="hover-cursor"
              style={{ left: `${tooltipPosition.left}px` }}
            />
          )}
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
          />
        </div>
        <button
          className="nav-button"
          onClick={handleSwipeLeft}
          disabled={currentPageIndex >= totalPages - (totalPages % 2 === 0 ? 1 : 2)}
        >
          &#8250;
        </button>
      </div>
    </div>
  );
}

export default FacsimilePageViewer;