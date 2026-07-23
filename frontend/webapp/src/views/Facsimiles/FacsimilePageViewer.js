import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useParams, useHistory } from "react-router-dom";
import ReactTooltip from "react-tooltip";
import { useSwipe } from "../../models/Utils";
import { assetUrl } from 'src/models/BoMOnlineAPI';
import "./FacsimilePageViewer.scss";
import { getRefFromIndex, PageOverlay } from "./Facsimiles";
import { useElementSize } from "./useElementSize";
import PageImage from "./PageImage";
import PageStack from "./PageStack";
import { generateReference, lookupReference } from "scripture-guide";
import { normalizeStackWidths } from "./faxGeometry";

/**
 * FacsimilePageViewer - Desktop version of the facsimile page viewer
 * Displays pages in a book-like spread with left and right pages
 */
function FacsimilePageViewer({ item, leafIndex, pgoffset, volumeOrder = [], currentVolumeIndex = -1 }) {
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
  const containerSize = useElementSize(pagesContainerRef);
  const [leftRatio, setLeftRatio] = useState(0.75);
  const [rightRatio, setRightRatio] = useState(0.75);
  
  // Check if the pageNumber contains any letters (A-z), which means it's a reference
  const hasLetters = /[A-Za-z]/.test(pageNumber || '');
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
    
    // Handle reference URLs (containing A-Z letters)
    if (hasLetters) {
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
  }, [pageNumber, leafIndex, item.pages, hasLetters]);

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
      const img = new Image();
      img.src = page.pageAssetUrl;
    });
  }, [getPagesToPreload]);

  const adjustedPageIndex = getAdjustedPageIndex(currentPageIndex);
  const leftPage = leafIndex[adjustedPageIndex] || null;
  const rightPage = leafIndex[adjustedPageIndex + 1] || null;

  // Load left page image and calculate aspect ratio
  useEffect(() => {
    if (!leftPage) { 
      setLeftRatio(0.75); 
      return; 
    }
    
    const img = new Image();
    img.onload = () => {
      if (img.naturalHeight > 0) setLeftRatio(img.naturalWidth / img.naturalHeight);
    };
    img.src = leftPage.thumbAssetUrl || leftPage.pageAssetUrl;
    return () => { img.onload = null; };
  }, [leftPage?.thumbAssetUrl, leftPage?.pageAssetUrl, leftPage]);

  // Load right page image and calculate aspect ratio
  useEffect(() => {
    if (!rightPage) { 
      setRightRatio(0.75); 
      return; 
    }
    
    const img = new Image();
    img.onload = () => {
      if (img.naturalHeight > 0) setRightRatio(img.naturalWidth / img.naturalHeight);
    };
    img.src = rightPage.thumbAssetUrl || rightPage.pageAssetUrl;
    return () => { img.onload = null; };
  }, [rightPage?.thumbAssetUrl, rightPage?.pageAssetUrl, rightPage]);

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

  // Navigation handlers
  const handlePageChange = useCallback((newIndex) => {
    const adjustedIndex = getAdjustedPageIndex(newIndex);
    const targetPage = leafIndex[adjustedIndex];
    if (targetPage) {
      history.replace(`/fax/${item.slug}/${targetPage.pageSlugLeaf}`);
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
  }, [handleSwipeLeft, handleSwipeRight, volumeOrder, currentVolumeIndex, history, leftPage?.pageSlugLeaf, rightPage?.pageSlugLeaf, leftPage?.pageReference, rightPage?.pageReference]);

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
    
    // Determine which side (left or right) for additional styling if needed
    const isLeft = page === leftPage;
    const aspectRatio = isLeft ? leftRatio : rightRatio;
    
    return (
      <PageImage
        src={page.pageAssetUrl}
        previewSrc={page.thumbAssetUrl}
        label={`Page ${page.pageSlugLeaf}`}
        reference={page.pageReference}
        alt={`Page ${page.pageSlugLeaf}`}
        onClick={onClick}
        className={isLastPage ? "last-page" : ""}
        style={{
          aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
          height: '100%',
          width: 'auto'
        }}
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
          <div 
            className="spreadInner" 
            style={{ 
              width: innerWidth ? `${innerWidth}px` : undefined,
              display: 'flex', 
              alignItems: 'stretch', 
              justifyContent: 'flex-start',
              gap: 0,
              // Center the exact-width strip; outside space is allowed only outside stacks
              margin: '0 auto'
            }}
          >
            {adjustedPageIndex > 0 && (
              <PageStack
                side="left"
                leafIndex={leafIndex}
                adjustedPageIndex={adjustedPageIndex}
                totalPages={totalPages}
                onPageChange={handlePageChange}
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
                onPageChange={handlePageChange}
                stackWidthPx={rightStackWidth}
              />
            )}
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
            aria-label="Page position"
            aria-valuetext={`Page ${leftPage?.pageSlugLeaf ?? sliderValue} of ${item.pages}`}
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
            const idx = leafIndex.findIndex((l) => l.pageNumInt === n || `${l.pageSlugLeaf}` === `${n}`);
            if (idx !== -1) handlePageChange(idx);
          }}
        >
          <input
            name="pageInput"
            type="number"
            min={1}
            max={item.pages}
            defaultValue={leftPage?.pageSlugLeaf || ''}
            key={leftPage?.pageSlugLeaf}
            aria-label="Jump to page"
          />
          <span className="of-total">/ {item.pages}</span>
        </form>
      </div>
    </div>
  );
}

export default FacsimilePageViewer;
