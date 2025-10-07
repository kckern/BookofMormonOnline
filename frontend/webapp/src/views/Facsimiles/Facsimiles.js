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
import {generateReference} from "scripture-guide";
import { isMobile, useSwipe, convertIntToRomanNumeral } from "../../models/Utils";
import FacsimilePageViewer from './FacsimilePageViewer';
import FacsimilePageViewerMobile from './FacsimilePageViewerMobile';
import PageImage from './PageImage';

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
      <h2 className="facsimileViewerTitle">
        <Link id="fax_back" to={activeLeaf ? `/fax/${item.slug}` : "/fax"}>←</Link>
        <span style={{ flexGrow: 1, color: "black" }}>{title}</span>
      </h2>
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
  
  // Use a filter instead of slice(1) to ensure we're not excluding valid pages
  // Filter out any undefined or null entries, but keep all valid pages
  const validLeaves = leafIndex.filter((leaf, idx) => {
    // Skip the first page if it's a cover or blank page (keeping original slice(1) behavior)
    if (idx === 0 && leaf.pageNumInt === null) return false;
    
    // Special handling for the last page (e.g., page 380)
    if (idx === leafIndex.length - 1) {
      return true;
    }
    
    // Include all other valid pages
    return leaf && (leaf.pageNumInt !== null || leaf.pageNumRoman !== null);
  });
  
  // Grid viewer ready to display pages

  return (
    <div className="faxGridViewer">
      {validLeaves.map((i) => {
        const alt = `${item.title} - Page ${i.pageSlugLeaf}`;
        return (
          <Link key={i.leafCursor} to={`/fax/${item.slug}/${i.pageSlugLeaf}`}>
            <div key={i.leafCursor} className="faxPage">
              <PageOverlay pageLeaf={i} />
              <PageImage
                src={i.thumbAssetUrl}
                previewSrc={i.thumbAssetUrl}
                alt={alt}
                label={`Page ${i.pageSlugLeaf}`}
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