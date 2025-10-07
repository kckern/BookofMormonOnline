import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";
import ReactTooltip from "react-tooltip";
import { useSwipe } from "../../models/Utils";
import { assetUrl } from 'src/models/BoMOnlineAPI';
import "./FacsimilePageViewer.scss";
import { getRefFromIndex, PageOverlay } from "./Facsimiles";

/**
 * FacsimilePageViewer - Desktop version of the facsimile page viewer
 * Displays pages in a book-like spread with left and right pages
 */
function FacsimilePageViewer({ item, leafIndex, pgoffset }) {
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
          <p>
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
      <img 
        src={page.pageAssetUrl} 
        alt={`Page ${page.pageSlugLeaf}`} 
        onClick={onClick}
        className={isLastPage ? "last-page" : ""}
      />
    );
  };

  // Page stack rendering
  const renderPageStack = useCallback((side) => {
    const stackPages = side === 'left'
      ? leafIndex.slice(0, adjustedPageIndex).reverse()
      : leafIndex.slice(adjustedPageIndex + 2);

    const stackWidth = Math.min(36, (stackPages.length / totalPages) * 36);

    return (
      <div className={`pageStack ${side}Stack`} style={{ width: `${stackWidth}px` }}>
        {stackPages.map((page) => (
          <div
            key={page.leafCursor}
            className="stackedPage"
            style={{
              width: `${100 / stackPages.length}%`,
              height: '100%'
            }}
            onClick={() => handlePageChange(leafIndex.indexOf(page))}
            data-tip={`Page ${page.pageSlugLeaf}`}
            data-for={`${side}StackTooltip`}
          />
        ))}
        <ReactTooltip id={`${side}StackTooltip`} place={side} effect="solid" />
      </div>
    );
  }, [adjustedPageIndex, leafIndex, totalPages, handlePageChange]);

  return (
    <div className="faxPageViewer" style={{ maxHeight: 'none' }} {...swipeHandlers}>
      <div className="pageReferences">
        <h6>{leftPage?.pageReference || ''}</h6>
        <h6>{rightPage?.pageReference || ''}</h6>
      </div>
      <div className="pagesContainer">
        <div className="pageContainer">
          {adjustedPageIndex > 0 && renderPageStack('left')}

          <div className="page leftPage">
            {/* If first page, show blank left page */}
            {adjustedPageIndex === 0 ? (
              <div className="blankPage"></div>
            ) : (
              renderPage(leftPage, handleSwipeRight)
            )}
          </div>
          <div className="page rightPage">
            {/* Special handling for the final page in a book with even page count */}
            {(totalPages % 2 === 0 && adjustedPageIndex === totalPages - 2) ? 
              renderPage(rightPage || null, () => {}) : // Disable clicking on the last page
              renderPage(rightPage || null, handleSwipeLeft)
            }
          </div>

          {/* Only show right stack if we're not at the last page or second-to-last page spread */}
          {(adjustedPageIndex < totalPages - 2 || 
            (totalPages % 2 === 0 && adjustedPageIndex < totalPages - 1)) && 
            renderPageStack('right')}
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