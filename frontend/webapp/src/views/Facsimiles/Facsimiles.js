import React, { useState, useCallback, useEffect, useRef } from "react";
// COMPONENTS
import Loader from "../_Common/Loader";

import { Card, CardHeader, CardBody, CardFooter } from "reactstrap";
import { Link } from 'react-router-dom';
import Masonry from 'react-masonry-css'
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { assetUrl } from 'src/models/BoMOnlineAPI';
import "./Facsimiles.scss"
import { useLocation, useParams, useRouteMatch, useHistory } from "react-router-dom";
import { label } from "src/models/Utils";
import scriptureguide from "scripture-guide";
import { isMobile, useSwipe, useWindowSize, convertIntToRomanNumeral, convertRomanNumeralToInt } from "../../models/Utils";
import { act } from "react";
import { set } from "lodash";


function FacsimileViewer({item}) {

  const match = useParams();
  const findLeafFromSlug = (leafIndex, match) => {
    return leafIndex.find((leaf) => `${leaf.pageSlugLeaf}` === `${match.pageNumber}`) || null;
  };


  const [pageIndex, setPageIndex] = useState([]);

  useEffect(() => {
    if(!item.indexRef) return;
    const { indexRef, pgOffset,pgfirstVerse } = item || {};
    const blankPageCount = (pgOffset||0) + pgfirstVerse -1;
    BoMOnlineAPI({ faxIndex:indexRef }).then((r) => {
        const {pages} = r?.fax[indexRef];
        const placeholderArray = Array.from({ length: blankPageCount }, (_, i) => [0, 0]);
        setPageIndex([...placeholderArray, ...pages]);
    });
  }, [item.slug,item]);


  const {pages, pgoffset} = item;
  const totalLeaves = pages + pgoffset;
  const leafIndex = Array.from({ length: totalLeaves }, (_, i) => i - pgoffset + 1).map((i) => {
    const baseUrl = `${assetUrl}/fax/pages/${item.slug}/`;
    const pageNumInt = i>0?i:null;
    const pagesAwayFromFirst = i;
    const pageNumRoman = i<=0?convertIntToRomanNumeral(pgoffset + i, true):null;
    const pageAssetUrl = i>0?`${baseUrl}${i.toString().padStart(3, "0")}.${item.format || "jpg"}`:`${baseUrl}000.${(pgoffset + i).toString().padStart(2, "0")}.${item.format || "jpg"}`;
    const isRightSide = (i+1) % 2 === 0;
    return {
      leafCursor:i + pgoffset -1,
      leafSequence: pageNumInt || pagesAwayFromFirst - 1,
      pageNumInt,
      pageNumRoman,
      pageSlugLeaf: pageNumRoman || pageNumInt,
      pageReference: getRefFromIndex(pageIndex, i),
      isRightSide,
      pageAssetUrl
    }
  });

  //onpress escape, click #fax_back
  const handleKeyPress = useCallback((e) => {
    if (e.key === "Escape") {
      document.getElementById("fax_back").click();
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    }
  }, [handleKeyPress]);


  const activeLeaf = findLeafFromSlug(leafIndex, match);
  const { title } = item;
  return <div className="facsimileViewer">
    <h2 className="facsimileViewerTitle">
      <Link id="fax_back" to={activeLeaf ? `/fax/${item.slug}` : "/fax"}>←</Link>
      <span style={
        {flexGrow: 1, color: "black"}
      }>{title}</span>
      </h2>
    {!activeLeaf ?
      <FacsimileGridViewer item={item} leafIndex={leafIndex}   /> :
      <FacsimilePageViewer item={item} leafIndex={leafIndex} findLeafFromSlug={findLeafFromSlug} /> }
  </div>
}
function FacsimileGridViewer({ item, leafIndex }) {

  return (
    <div className="faxGridViewer">
      {leafIndex.map((i) => {
        const alt = `${item.title} - Page ${i.pageSlugLeaf}`;
        return (
          <Link key={i.leafCursor} to={`/fax/${item.slug}/${i.pageSlugLeaf}`}>
          <div key={i.leafCursor} className="faxPage">
            <PageOverlay pageLeaf={i} />
            <img src={i.pageAssetUrl} alt={alt} />
          </div>
          </Link>
        );
      })}
    </div>
  );
}

const getRefFromIndex = (pageIndex, pageNum) => {
  const itemIndex = parseInt(pageNum) - 1;
  const [startingVerseId, verseCount, startsAtTop] = pageIndex?.[itemIndex] || [0, 0];
  const nextStartsAtTop = pageIndex?.[itemIndex + 1]?.[2] || false;
  const verseRangeArray = Array.from({ length: verseCount }, (_, i) => startingVerseId + i);
  const ref = scriptureguide.generateReference(verseRangeArray);
  const showRef = pageIndex.length > 0 && startingVerseId > 0;
  return showRef ? ref : null;
};


function PageOverlay({ pageLeaf }) {

  const{pageReference,pageNumInt,pageNumRoman} = pageLeaf
  return (
    <div className="pageOverlay">
      <div className="pageNum" >Page {pageNumRoman || pageNumInt}</div>
      {!!pageReference && <div  className="pageRef">{pageReference}</div>}
    </div>
  );
}


function FacsimilePageViewer({ item, leafIndex, findLeafFromSlug }) {

  const match = useParams();
  const activeLeaf = findLeafFromSlug(leafIndex, match);
  if(!activeLeaf) return null;
  const activeLeafIndexInt = activeLeaf.leafCursor;
  const leftPage = activeLeaf.isRightSide ? leafIndex[activeLeafIndexInt - 1] || {} : activeLeaf;
  const rightPage = activeLeaf.isRightSide ? activeLeaf : leafIndex[activeLeafIndexInt + 1];
  const offLeftPage = leafIndex[leftPage.leafCursor - 1] || null
  const offRightPage = leafIndex[rightPage.leafCursor + 1] || null
  const goToPrevUrl = offLeftPage ? `/fax/${item.slug}/${offLeftPage.pageSlugLeaf}` : `/fax/${item.slug}`;
  const goToNextUrl = offRightPage ? `/fax/${item.slug}/${offRightPage.pageSlugLeaf}` : `/fax/${item.slug}`;


  

  return (
    <div className="faxPageViewer noselect">
    <div className="pageReferences">
      <h6 style={{ marginRight: "3rem" }}>{leftPage.pageReference}</h6>
      <h6 style={{ marginLeft: "3rem" }}>{rightPage.pageReference}</h6>
      </div>
      <div className="pagesContainer">
        <Link to={goToPrevUrl} className="leftPage page">
         {!!leftPage.pageAssetUrl && <img src={leftPage.pageAssetUrl} alt={`Page ${leftPage.pageSlugLeaf}`} />}
        </Link>
        <Link to={goToNextUrl} className="rightPage page">
          <img src={rightPage.pageAssetUrl} alt={`Page ${rightPage.pageSlugLeaf}`} />
        </Link>
      </div>
      <div className="pageNumbers">
      <h6 style={{ marginRight: "3rem" }}>{true ? `Page ${leftPage.pageSlugLeaf}` : ''}</h6>
      <h6 style={{ marginLeft: "3rem" }}>{true ? `Page ${rightPage.pageSlugLeaf}` : ''}</h6>
      </div>
    </div>
  );

}


function Facsimiles() {

  const [FaxList, setFaxList] = useState(null);
  const match = useParams();
  const activeFax = FaxList?.[match.faxVersion];
  useEffect(()=>document.title = (activeFax?.title || label("menu_fax")) + " | " + label("home_title"),[activeFax?.code])
  const contentsUI = () => {
    const breakpointColumnsObj = {
      default: 4,
      1500: 3,
      1100: 2,
      800: 1
    };


    if(FaxList && activeFax?.pages) return <FacsimileViewer  item={activeFax} />


    if (FaxList && activeFax?.code){
      let [code,token] = activeFax?.code.split(".");
      return <><Link className="closeFax" to="/fax">✕</Link><iframe className="faxiframe" allowfullscreen="allowfullscreen" src={`https://designrr.page?id=${code}&token=${token}&type=FP`} frameborder="0"></iframe></>
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
  if (!FaxList) BoMOnlineAPI({ fax: "pdf"  }).then((r) => {
    setFaxList(r.fax);});
  return (
    FaxList ?
      <div className="container" style={{ display: 'block' }}>
        {contentsUI()}
      </div> : <Loader/>
  )



}

export default Facsimiles;
