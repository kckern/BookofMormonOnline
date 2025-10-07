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
import { generateReference, lookupReference } from "scripture-guide";
import { isMobile, useSwipe, convertIntToRomanNumeral } from "../../models/Utils";
import FacsimilePageViewer from './FacsimilePageViewer';
import FacsimilePageViewerMobile from './FacsimilePageViewerMobile';
import PageImage from './PageImage';
import backIcon from '../_Common/svg/back.svg';

function FacsimileViewer({ item, volumeOrder, currentVolumeIndex }) {
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
  // Ensure we include page 380 by making sure totalLeaves is correctly calculated
  // We add 1 here because pages appears to be 0-indexed (0-379 instead of 1-380)
  const totalLeaves = (parseInt(pages) + 1) + parseInt(pgoffset);
  
  const leafIndex = Array.from({ length: totalLeaves }, (_, idx) => {
    const i = idx - pgoffset + 0;
    const baseUrl = `${assetUrl}/fax/pages/${item.slug}/`;
    
    // Check if this is the last page (page 380 in this case)
    const isLastPage = (i === pages);
    
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

  // Leaf index processing complete
  
  const activeLeaf = findLeafFromSlug(leafIndex, match);
  const isGridMode = !activeLeaf;
  const { title } = item;
  return (
    <div className={`facsimileViewer${isGridMode ? ' gridMode' : ''}`}>
      <h1 className="facsimileViewerTitle">
        <Link id="fax_back" to={activeLeaf ? `/fax/${item.slug}` : "/fax"} aria-label="Back to facsimiles">
          <img src={backIcon} alt="Back" style={{ width: 20, height: 20 }} />
        </Link>
        <span style={{ flexGrow: 1, color: "black" }}>{title}</span>
      </h1>
      {!activeLeaf ?
        <FacsimileGridViewer item={item} leafIndex={leafIndex} /> :
        (isMobile() ? 
          <FacsimilePageViewerMobile item={item} leafIndex={leafIndex} pgoffset={pgoffset} volumeOrder={volumeOrder} currentVolumeIndex={currentVolumeIndex} /> :
          <FacsimilePageViewer item={item} leafIndex={leafIndex} pgoffset={pgoffset} volumeOrder={volumeOrder} currentVolumeIndex={currentVolumeIndex} />
        )
      }
    </div>
  );
}

function FacsimileGridViewer({ item, leafIndex }) {
  // Process leaf index for grid display
  // Default aspect ratio width:height = 1:1.5 (i.e., 0.666...) and fixed tile height 300px
  const DEFAULT_ASPECT = 1 / 1.5;
  const TILE_HEIGHT = 300;
  const GAP = 5; // must match inline style gap in container
  const [tileAspect, setTileAspect] = useState(DEFAULT_ASPECT);
  const [hasScrolled, setHasScrolled] = useState(false);
  const gridRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Use a filter instead of slice(1) to ensure we're not excluding valid pages
  // Filter out any undefined or null entries, but keep all valid pages
  const validLeaves = leafIndex.filter((leaf, idx) => {
    // Skip the first page if it's a cover or blank page (keeping original slice(1) behavior)
    if (idx === 0 && leaf?.pageNumInt === null) return false;

    // Special handling for the last page (e.g., page 380)
    if (idx === leafIndex.length - 1) {
      return true;
    }

    // Include all other valid pages
    return !!leaf && (leaf.pageNumInt !== null || leaf.pageNumRoman !== null);
  });

  // After first thumb loads, detect actual aspect ratio and use it for all tiles
  useEffect(() => {
    if (!validLeaves?.length) return;
    const first = validLeaves[10];
    if (!first?.thumbAssetUrl) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w > 0 && h > 0) {
        setTileAspect(w / h);
      }
    };
    img.onerror = () => {
      // Keep default aspect on error
    };
    img.src = first.thumbAssetUrl;
    return () => {
      cancelled = true;
    };
  }, [validLeaves?.[0]?.thumbAssetUrl]);

  // Measure container width to compute fitted tile size per row
  useEffect(() => {
    if (!gridRef.current) return;
    const el = gridRef.current;
    
    // Debounce to prevent ResizeObserver loops
    let timeout = null;
    const measure = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!el || !gridRef.current) return;
        // Use requestAnimationFrame to ensure measurements happen in the next frame
        requestAnimationFrame(() => {
          const cs = window.getComputedStyle(el);
          const pl = parseFloat(cs.paddingLeft) || 0;
          const pr = parseFloat(cs.paddingRight) || 0;
          // clientWidth includes padding; subtract it to get the true inner content width available to flex items
          const inner = (el.clientWidth || el.getBoundingClientRect().width) - pl - pr;
          setContainerWidth(inner);
        });
      }, 100); // 100ms debounce
    };
    
    measure();
    
    const ro = new ResizeObserver(() => {
      measure();
    });
    
    ro.observe(el);
    window.addEventListener('resize', measure);
    
    return () => {
      clearTimeout(timeout);
      try { ro.disconnect(); } catch {}
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Memoize tile size calculations to reduce re-renders
  const [tileDimensions, setTileDimensions] = useState({ width: 0, height: 0 });
  
  // Calculate tile dimensions when containerWidth or tileAspect changes
  useEffect(() => {
    // Don't calculate if container width isn't available yet
    if (!containerWidth || containerWidth <= 0) return;
    
    const aspectRatio = tileAspect || DEFAULT_ASPECT;
    const baseTileWidth = TILE_HEIGHT * aspectRatio;
    
    // Compute columns that fit at baseline
    const columns = Math.max(1, Math.floor((containerWidth + GAP) / (baseTileWidth + GAP)));
    
    // Calculate width to exactly fill the container
    const fittedTileWidth = (containerWidth - GAP * (columns - 1)) / columns;
    const fittedTileHeight = fittedTileWidth / aspectRatio;
    
    // Ensure minimum dimensions
    const finalWidth = Math.max(baseTileWidth, fittedTileWidth);
    const finalHeight = Math.max(TILE_HEIGHT, fittedTileHeight);
    
    setTileDimensions({ width: finalWidth, height: finalHeight });
  }, [containerWidth, tileAspect]);
  
  // Use memoized dimensions
  const tileWidth = tileDimensions.width;
  const tileHeight = tileDimensions.height;

  // Grid viewer ready to display pages
  return (
    <div
      className="faxGridViewer"
      ref={gridRef}
      onScroll={(e) => setHasScrolled(e.currentTarget.scrollTop > 0)}
      style={{ display: 'flex', flexWrap: 'wrap', gap: GAP }}
    >
      <div className={`gridOverhang ${hasScrolled ? 'visible' : ''}`} />
      {tileWidth > 0 && tileHeight > 0 && validLeaves.map((i) => {
        const alt = `${item.title} - Page ${i.pageSlugLeaf}`;
        return (
          <Link key={i.leafCursor} to={`/fax/${item.slug}/${i.pageSlugLeaf}`}>
            <div
              key={i.leafCursor}
              className="faxPage"
              style={{ 
                width: `${tileWidth}px`, 
                height: `${tileHeight}px`,
                // Add will-change to help browser optimize rendering
                willChange: 'transform',
                // Use transform instead of width/height for smoother transitions when size changes
                transform: 'translate3d(0, 0, 0)'
              }}
            >
              <PageOverlay pageLeaf={i} />
              <PageImage
                src={i.thumbAssetUrl}
                previewSrc={i.thumbAssetUrl}
                alt={alt}
                label={`Page ${i.pageSlugLeaf}`}
                reference={i.pageReference}
                onClick={undefined}
                className="grid-thumb"
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export const getRefFromIndex = (pageIndex, pageNum) => {
  const itemIndex = parseInt(pageNum) - 1;
  const [startingVerseId, verseCount] = pageIndex?.[itemIndex] || [0, 0];
  const verseRangeArray = Array.from({ length: verseCount }, (_, i) => startingVerseId + i);
  const lang = determineLanguage();
  const ref = generateReference(verseRangeArray, lang);
  const showRef = pageIndex.length > 0 && startingVerseId > 0;
  return showRef ? ref : null;
};

export function PageOverlay({ pageLeaf }) {
  const { pageReference, pageNumInt, pageNumRoman } = pageLeaf;
  return (
    <div className="pageOverlay">
      <div className="pageNum">Page {pageNumRoman || pageNumInt}</div>
      {!!pageReference && <div className="pageRef">{pageReference}</div>}
    </div>
  );
}

// FacsimilePageViewer has been moved to its own files: 
// - FacsimilePageViewer.js for desktop 
// - FacsimilePageViewerMobile.js for mobile

function Facsimiles() {
  const [FaxList, setFaxList] = useState(null);
  const match = useParams();
  const history = useHistory();
  const activeFax = FaxList?.[match.faxVersion];
  useEffect(() => document.title = (activeFax?.title || label("menu_fax")) + " | " + label("home_title"), [activeFax?.code])

  // Handle route expansions and redirects
  useEffect(() => {
    if (!FaxList) return; // wait until list is loaded
    const edition = match.faxVersion;
    const rawPage = match.pageNumber; // could be undefined, 'last', numeric, or scripture ref
    const fax = FaxList?.[edition];
    if (!fax) return; // unknown edition, let normal rendering handle

    // Determine highest numeric page for this edition
    const totalPages = parseInt(fax?.pages, 10);
    const maxPage = Number.isFinite(totalPages) ? totalPages : null;

    // 1) '/fax/{edition}/last' -> forward to highest page
    if (rawPage === 'last' && maxPage) {
      if (history?.replace) history.replace(`/fax/${edition}/${maxPage}`);
      return;
    }

    // If page isn't present, nothing to normalize
    if (rawPage == null) return;

    // 2) numeric overflow -> clamp to highest page
    const pageNum = parseInt(rawPage, 10);
    const isNumeric = String(pageNum) === String(rawPage);
    if (isNumeric && maxPage && pageNum > maxPage) {
      if (history?.replace) history.replace(`/fax/${edition}/${maxPage}`);
      return;
    }

    // 3) Non-numeric page -> treat as scripture reference
    if (!isNumeric && /[A-Za-z]/.test(rawPage || '')) {
      try {
        const refs = lookupReference(rawPage);
        const firstVerseId = refs?.verse_ids?.length ? Math.min(...refs.verse_ids) : null;
        const isIndexed = !!fax?.indexRef;

        // If edition is indexed and we have a verse id, fetch page index and map to page
        if (isIndexed && firstVerseId) {
          const { indexRef, pgOffset, pgoffset, pgfirstVerse } = fax || {};
          const effectivePgOffset = (typeof pgOffset === 'number' ? pgOffset : pgoffset) || 0;
          const blankPageCount = effectivePgOffset + (pgfirstVerse || 1) - 1;
          BoMOnlineAPI({ faxIndex: indexRef }).then((r) => {
            try {
              const { pages } = r?.fax?.[indexRef] || {};
              if (!Array.isArray(pages) || pages.length === 0) return;
              const pageIndex = [
                ...Array.from({ length: blankPageCount }, () => [0, 0]),
                ...pages,
              ];
              // Find first page that contains this verse id
              let targetPage = null;
              for (let i = 0; i < pageIndex.length; i++) {
                const [start, count] = pageIndex[i] || [0, 0];
                if (start > 0 && count > 0) {
                  if (firstVerseId >= start && firstVerseId < start + count) {
                    targetPage = i + 1; // page numbers are 1-based
                    break;
                  }
                }
              }
              // Clamp and navigate if found
              if (targetPage) {
                const target = maxPage ? Math.min(targetPage, maxPage) : targetPage;
                if (history?.replace) history.replace(`/fax/${edition}/${target}`);
              }
            } catch (e) {
              // Ignore errors and fall back to grid
            }
          });
        } else {
          // Not indexed or no verse match: fall back to grid view (no redirect)
        }
      } catch (e) {
        // Invalid reference: ignore and stay in grid
      }
    }
  }, [FaxList, match.faxVersion, match.pageNumber, history]);
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

    if (FaxList && activeFax?.pages) {
      const volumeOrder = Object.values(FaxList).sort((a, b) => {
        if (a.title < b.title) return -1;
        if (a.title > b.title) return 1;
        return 0;
      });
      const currentVolumeIndex = volumeOrder.findIndex(v => v.slug === activeFax.slug);
      return <FacsimileViewer item={activeFax} volumeOrder={volumeOrder} currentVolumeIndex={currentVolumeIndex} />
    }

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
      <div className="faxMainContainer">
        {contentsUI()}
      </div> : <Loader />
  )
}

export default Facsimiles;