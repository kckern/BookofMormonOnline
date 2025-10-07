import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";
import { useSwipe } from "../../models/Utils";
import { assetUrl } from 'src/models/BoMOnlineAPI';
import "./FacsimilePageViewer.scss";
import { getRefFromIndex, PageOverlay } from "./Facsimiles";
import PageImage from "./PageImage";
import { generateReference, lookupReference } from "scripture-guide";

/**
 * FacsimilePageViewerMobile - Mobile version of the facsimile page viewer
 * Displays a single page at a time, optimized for mobile screens
 */
function FacsimilePageViewerMobile({ item, leafIndex, pgoffset, volumeOrder = [], currentVolumeIndex = -1 }) {
  const history = useHistory();
  const { pageNumber } = useParams();

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);
  const sliderRef = useRef(null);

  const totalPages = leafIndex.length;

  // Check if the pageNumber contains any letters (A-z), which means it's a reference
  const hasLetters = /[A-Za-z]/.test(pageNumber || '');

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

  // Preload adjacent pages
  const getPagesToPreload = useCallback(() => {
    if (!leafIndex) return [];
    const preloadRange = 3;
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

  const currentPage = leafIndex[currentPageIndex] || null;

  // Navigation handlers
  const handlePageChange = useCallback((newIndex) => {
    if (newIndex < 0 || newIndex >= leafIndex.length) return;
    
    const targetPage = leafIndex[newIndex];
    if (targetPage) {
      history.push(`/fax/${item.slug}/${targetPage.pageSlugLeaf}`);
    }
  }, [history, item.slug, leafIndex]);

  // Navigate one page at a time for mobile
  const handleSwipeLeft = useCallback(() => {
    const newIndex = Math.min(totalPages - 1, currentPageIndex + 1);
    handlePageChange(newIndex);
  }, [currentPageIndex, totalPages, handlePageChange]);

  const handleSwipeRight = useCallback(() => {
    const newIndex = Math.max(0, currentPageIndex - 1);
    handlePageChange(newIndex);
  }, [currentPageIndex, handlePageChange]);

  const swipeHandlers = useSwipe({
    onSwipedLeft: handleSwipeLeft,
    onSwipedRight: handleSwipeRight
  });

  // Arrow keys: left/right page, up/down volumes
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
        const targetSlug = currentPage?.pageSlugLeaf;
        const targetPath = targetSlug ? `/fax/${next.slug}/${targetSlug}` : `/fax/${next.slug}`;
        history.push(targetPath);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSwipeLeft, handleSwipeRight, volumeOrder, currentVolumeIndex, history, currentPage?.pageSlugLeaf]);

  // Slider interaction handlers
  const handleSliderChange = useCallback((e) => {
    setSliderValue(parseInt(e.target.value, 10));
  }, []);

  const handleSliderRelease = useCallback(() => {
    handlePageChange(sliderValue);
  }, [handlePageChange, sliderValue]);

  // Page rendering
  const renderPage = (page) => {
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
        alt={`Page ${page.pageSlugLeaf}`}
        label={page.pageReference || `Page ${page.pageSlugLeaf}`}
        className={isLastPage ? "last-page" : ""}
      />
    );
  };

  return (
    <div className="faxPageViewer mobile" style={{ maxHeight: 'none' }} {...swipeHandlers}>
      <div className="pageReferences">
        <h6>{currentPage?.pageReference || ''}</h6>
      </div>
      <div className="pagesContainer">
        <div className="pageContainer mobile">
          <div className="page">
            {renderPage(currentPage)}
          </div>
        </div>
      </div>

      <div className="facsimile-navigation mobile">
        <button
          className="nav-button"
          onClick={handleSwipeRight}
          disabled={currentPageIndex <= 0}
        >
          &#8249;
        </button>
        <div className="slider-container">
          <input
            type="range"
            min={0}
            max={totalPages - 1}
            step={1} // Move slider in steps of 1 for mobile (single pages)
            value={sliderValue}
            onChange={handleSliderChange}
            onMouseUp={handleSliderRelease}
            onTouchEnd={handleSliderRelease}
            className="custom-slider"
          />
        </div>
        <button
          className="nav-button"
          onClick={handleSwipeLeft}
          disabled={currentPageIndex >= totalPages - 1}
        >
          &#8250;
        </button>
      </div>
      <div className="page-counter">
        {currentPageIndex + 1} / {totalPages}
      </div>
    </div>
  );
}

export default FacsimilePageViewerMobile;