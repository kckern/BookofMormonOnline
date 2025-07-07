import React, { useState, useCallback, useEffect, useRef } from "react";
// COMPONENTS
import Loader from "../_Common/Loader";
import ReactTooltip from "react-tooltip";

import { Card, CardHeader, CardBody, Alert } from "reactstrap";
import { Link } from 'react-router-dom';
import Masonry from 'react-masonry-css'
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { assetUrl } from 'src/models/BoMOnlineAPI';
import "./Facsimiles.scss"
import { useParams, useHistory } from "react-router-dom";
import { label, determineLanguage } from "src/models/Utils";
import scriptureguide from "scripture-guide";
import { isMobile, useSwipe, convertIntToRomanNumeral } from "../../models/Utils";

function FacsimileViewer({ item }) {
  const match = useParams();
  const findLeafFromSlug = (leafIndex, match) => {
    return leafIndex.find((leaf) => `${leaf.pageSlugLeaf}` === `${match.pageNumber}`) || null;
  };

  const [pageIndex, setPageIndex] = useState([]);

  useEffect(() => {
    if (!item.indexRef) return;
    const { indexRef, pgOffset, pgfirstVerse } = item || {};
    const blankPageCount = (pgOffset || 0) + pgfirstVerse - 1;
    BoMOnlineAPI({ faxIndex: indexRef }).then((r) => {
      const { pages } = r?.fax[indexRef];
      const placeholderArray = Array.from({ length: blankPageCount }, (_, i) => [0, 0]);
      setPageIndex([...placeholderArray, ...pages]);
    });
  }, [item.slug, item]);

  const { pages, pgoffset } = item;
  const totalLeaves = pages + pgoffset;
  const leafIndex = Array.from({ length: totalLeaves }, (_, idx) => {
    const i = idx - pgoffset + 0;
    const baseUrl = `${assetUrl}/fax/pages/${item.slug}/`;
    const pageNumInt = i > 0 ? i : null;
    const pageNumRoman = i <= 0 ? convertIntToRomanNumeral(pgoffset + i, true) : null;
    const pageAssetUrl = i > 0 ? `${baseUrl}${i.toString().padStart(3, "0")}.${item.format || "jpg"}` : `${baseUrl}000.${(pgoffset + i).toString().padStart(2, "0")}.${item.format || "jpg"}`;
    const thumbAssetUrl = pageAssetUrl.replace("pages", "thumb");
    const isLeftSide = i % 2 === 0; // Even pages are on the left
    return {
      leafCursor: idx,
      leafSequence: pageNumInt || idx,
      pageNumInt,
      pageNumRoman,
      pageSlugLeaf: pageNumRoman || pageNumInt,
      pageReference: getRefFromIndex(pageIndex, i),
      isLeftSide,
      pageAssetUrl,
      thumbAssetUrl
    };
  });

  // Handle keypress for escape
  const handleKeyPress = useCallback((e) => {
    if (e.key === "Escape") {
      document.getElementById("fax_back").click();
    }
    // Left and right arrow keys can be added here if desired
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    }
  }, [handleKeyPress]);

  const activeLeaf = findLeafFromSlug(leafIndex, match);
  const { title } = item;
  return (
    <div className="facsimileViewer">
      <h2 className="facsimileViewerTitle">
        <Link id="fax_back" to={activeLeaf ? `/fax/${item.slug}` : "/fax"}>←</Link>
        <span style={{ flexGrow: 1, color: "black" }}>{title}</span>
      </h2>
      {!activeLeaf ?
        <FacsimileGridViewer item={item} leafIndex={leafIndex} /> :
        <FacsimilePageViewer item={item} leafIndex={leafIndex} />
      }
    </div>
  );
}

function FacsimileGridViewer({ item, leafIndex }) {
  return (
    <div className="faxGridViewer">
      {leafIndex.slice(1).map((i) => {
        const alt = `${item.title} - Page ${i.pageSlugLeaf}`;
        return (
          <Link key={i.leafCursor} to={`/fax/${item.slug}/${i.pageSlugLeaf}`}>
            <div key={i.leafCursor} className="faxPage">
              <PageOverlay pageLeaf={i} />
              <img src={i.thumbAssetUrl} alt={alt} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

const getRefFromIndex = (pageIndex, pageNum) => {
  const itemIndex = parseInt(pageNum) - 1;
  const [startingVerseId, verseCount] = pageIndex?.[itemIndex] || [0, 0];
  const verseRangeArray = Array.from({ length: verseCount }, (_, i) => startingVerseId + i);
  const lang = determineLanguage();
  const ref = scriptureguide.generateReference(verseRangeArray, lang);
  const showRef = pageIndex.length > 0 && startingVerseId > 0;
  return showRef ? ref : null;
};

function PageOverlay({ pageLeaf }) {
  const { pageReference, pageNumInt, pageNumRoman } = pageLeaf;
  return (
    <div className="pageOverlay">
      <div className="pageNum">Page {pageNumRoman || pageNumInt}</div>
      {!!pageReference && <div className="pageRef">{pageReference}</div>}
    </div>
  );
}

function FacsimilePageViewer({ item, leafIndex }) {
  const history = useHistory();
  const { pageNumber } = useParams();
  const isOnMobile = isMobile();

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 });
  const sliderRef = useRef(null);

  const totalPages = leafIndex.length;

  // Initialize page index based on URL
  useEffect(() => {
    const index = leafIndex.findIndex(leaf => `${leaf.pageSlugLeaf}` === pageNumber);
    if (index !== -1) {
      setCurrentPageIndex(index);
      setSliderValue(index);
    }
  }, [pageNumber, leafIndex]);

  // Adjust page index to ensure even pages are on the left
  const getAdjustedPageIndex = useCallback((index) => {
    if (index <= 0) return 0; // Handle first page
    return index % 2 === 0 ? index : index - 1;
  }, []);

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
  const rightPage = isOnMobile ? null : leafIndex[adjustedPageIndex + 1] || null;

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
    handlePageChange(Math.min(totalPages - 1, currentPageIndex + (isOnMobile ? 1 : 2)));
  }, [currentPageIndex, isOnMobile, totalPages, handlePageChange]);

  const handleSwipeRight = useCallback(() => {
    handlePageChange(Math.max(0, currentPageIndex - (isOnMobile ? 1 : 2)));
  }, [currentPageIndex, isOnMobile, handlePageChange]);

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
      setTooltipPosition({
        left: e.clientX - sliderRect.left,
        top: -200,
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
    return (
      <img src={page.pageAssetUrl} alt={`Page ${page.pageSlugLeaf}`} onClick={onClick} />
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
    <div className="faxPageViewer noselect" {...swipeHandlers}>
      <div className="pageReferences">
        <h6>{leftPage?.pageReference || ''}</h6>
        {!isOnMobile && <h6>{rightPage?.pageReference || ''}</h6>}
      </div>
      <div className="pagesContainer">
        <div className={`pageContainer ${isOnMobile ? 'mobile' : ''}`}>
          {!isOnMobile && adjustedPageIndex > 0 && renderPageStack('left')}

          {isOnMobile ? (
            <div className="page">
              {renderPage(leftPage, handleSwipeLeft)}
            </div>
          ) : (
            <>
              <div className="page leftPage">
                {/* If first page, show blank left page */}
                {adjustedPageIndex === 0 ? (
                  <div className="blankPage"></div>
                ) : (
                  renderPage(leftPage, handleSwipeRight)
                )}
              </div>
              <div className="page rightPage">
                {renderPage(rightPage || null, handleSwipeLeft)}
              </div>
            </>
          )}

          {!isOnMobile && adjustedPageIndex < totalPages - 2 && renderPageStack('right')}
        </div>
      </div>

      <div className={`facsimile-navigation ${isOnMobile ? 'mobile' : ''}`}>
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
              className="custom-tooltip"
              style={{
                left: `${tooltipPosition.left}px`,
                top: '-200px',
                transform: 'translateX(-50%)'
              }}
            >
              {tooltipContent}
            </div>
          )}
          <input
            type="range"
            min={0}
            max={totalPages - (isOnMobile ? 1 : 2)}
            step={isOnMobile ? 1 : 2} // Move slider in steps
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
          disabled={currentPageIndex >= totalPages - (isOnMobile ? 1 : 2)}
        >
          &#8250;
        </button>
      </div>
    </div>
  );
}

function Facsimiles() {
  const [FaxList, setFaxList] = useState(null);
  const match = useParams();
  const activeFax = FaxList?.[match.faxVersion];
  useEffect(() => document.title = (activeFax?.title || label("menu_fax")) + " | " + label("home_title"), [activeFax?.code])
  const contentsUI = () => {
    const faxCount = Object.keys(FaxList).length;
    const breakpointColumnsObj = faxCount > 6 ? {
      default: 4,
      1500: 3,
      1100: 2,
      800: 1
    } : {
      default: 2,
      800: 1
    };

    if (FaxList && activeFax?.pages) return <FacsimileViewer item={activeFax} />

    if (FaxList && activeFax?.code) {
      let [code, token] = activeFax?.code.split(".");
      return <div id="page" className="table-of-content faxpage">
        <h3 className="title lg-4 text-center">{activeFax?.title}</h3>

        <Alert color="warning" className="text-center">{label("fax_not_available")}</Alert>

      </div>
    }

    var sortable = [];
    for (var i in FaxList) {
      sortable.push(FaxList[i]);
    }

    return (
      <>
        <div id="page" className="table-of-content faxpage">
          <h3 className="title lg-4 text-center">{label("title_facsimilies")}</h3>
          <div className="faxlist">
            <Masonry
              breakpointCols={breakpointColumnsObj}
              className="my-masonry-grid"
              columnClassName="my-masonry-grid_column">
              {sortable.sort((a, b) => {
                if (a.title < b.title) {
                  return -1;
                }
                if (a.title > b.title) {
                  return 1;
                }
                return 0;
              }).map((item, i) => (
                <Card key={i}>
                  <Link to={"/fax/" + item.slug}> <CardHeader className="text-center">

                    <h5>{item.title} </h5>
                    {!!item.pages && <span className="badge badge-primary pagecount">{item.pages}</span>}
                  </CardHeader></Link>

                  <Link to={"/fax/" + item.slug}>
                    <CardBody className="faxInfo" style={{ backgroundImage: `url(${assetUrl}/fax/covers/` + item.slug + ")" }}>
                      <div className="faxInfoText" >{item.info} </div>
                    </CardBody>
                  </Link>
                </Card>

              ))}
            </Masonry>
          </div>
        </div>
      </>);
  }

  if (!FaxList) BoMOnlineAPI({ fax: "pdf" }).then((r) => {
    setFaxList(r.fax);
  });
  return (
    FaxList ?
      <div className="container" style={{ display: 'block' }}>
        {contentsUI()}
      </div> : <Loader />
  )
}

export default Facsimiles;