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

  const history = useHistory()
  const match = useParams();



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





  const [activeLeafCursor, setActiveLeafCursor] = useState(-2);
  const activeLeaf = leafIndex.find((leaf) => `${leaf.leafCursor}` === `${activeLeafCursor}`) || null;
  const showGrid = activeLeafCursor < 0;
  const slugToShow = !showGrid ? `${item.slug}/${activeLeaf.pageSlugLeaf}` : item.slug;

  const findLeafFromSlug = () => {
    return leafIndex.find((leaf) => `${leaf.pageSlugLeaf}` === `${match.pageNumber}`) || null;
  };
    
  const handleActiveLeaf = () => {
    const dstActiveLeaf = findLeafFromSlug();
    if (dstActiveLeaf) {
      setActiveLeafCursor(dstActiveLeaf.leafCursor);
    }
  };

  useEffect(() => {      
      if (!activeLeaf && match.pageNumber && !showGrid) {
          console.log("Path 2: !activeLeaf && match.pageNumber",{slugToShow, showGrid});
          handleActiveLeaf();
      }
      
      if (`${activeLeaf?.pageSlugLeaf}` === `${match.pageNumber}`) {
          console.log("Path 3: activeLeaf?.pageSlugLeaf === match.pageNumber");
          return;
      }
      
      if (slugToShow === item.slug) {
          console.log("Path 4: slugToShow === item.slug");
          return;
      }
      
      if (activeLeaf?.pageSlugLeaf) {
          console.log("Path 5: activeLeaf?.pageSlugLeaf exists");
          history.push(`/fax/${slugToShow}`);
      } else {
          console.log("Path 6: activeLeaf?.pageSlugLeaf does not exist");
          handleActiveLeaf();
      }
      
      if (showGrid) {
          console.log("Path 7: showGrid is true");
          history.push(`/fax/${item.slug}`);
      }
  }, [slugToShow, match.pageNumber, showGrid, activeLeafCursor]);



  const { title } = item;
  return <div className="facsimileViewer">
    <h2 className="facsimileViewerTitle">
      <pre>
        {JSON.stringify({slugToShow}, null, 2)}
      </pre>
      <span
        style={{flexGrow: 0, cursor: "pointer"}}
      onClick={() => setActiveLeafCursor(-2)}>⬅</span>
      <span style={
        {flexGrow: 1, color: "black"}
      }>{title}</span>
      </h2>
    {showGrid ?
      <FacsimileGridViewer item={item} setActiveLeafCursor={setActiveLeafCursor}  leafIndex={leafIndex} activeLeafCursor={activeLeafCursor} />  :
      <FacsimilePageViewer item={item} activeLeafCursor={activeLeafCursor}  setActiveLeafCursor={setActiveLeafCursor} leafIndex={leafIndex}  /> }
  </div>
}
function FacsimileGridViewer({ item, setActiveLeafCursor, leafIndex }) {
  const leafCount = item.pages + item.pgoffset;
  const { format, slug } = item;
  const history = useHistory();
  const match = useRouteMatch();

  return (
    <div className="faxGridViewer">
      {leafIndex.map((i) => {
        const alt = `${item.title} - Page ${i.pageSlugLeaf}`;
        return (
          <div key={i.seq} className="faxPage" onClick={() => setActiveLeafCursor(i.leafCursor)}>
            <PageOverlay pageLeaf={i} />
            <img src={i.pageAssetUrl} alt={alt} />
          </div>
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


function FacsimilePageViewer({ item, activeLeafCursor, setActiveLeafCursor, leafIndex }) {

  const match = useRouteMatch();
  activeLeafCursor = activeLeafCursor <0 ? 0 : activeLeafCursor;
  const activeLeafIndexInt = activeLeafCursor;
  const activeLeaf = leafIndex[activeLeafIndexInt || 0] || leafIndex[0];
  const leftPage = activeLeaf.isRightSide ? leafIndex[activeLeafIndexInt - 1] || {} : activeLeaf;
  const rightPage = activeLeaf.isRightSide ? activeLeaf : leafIndex[activeLeafIndexInt + 1];

  const history = useHistory();
  const { width } = useWindowSize();



  const swipeHandlers = useSwipe({
    onSwipedLeft:   ()=>goToPrevPages(1),
    onSwipedRight:  ()=>goToNextPages(1)
  })

  const goToNextPages = (step=2) => {
    setActiveLeafCursor(activeLeafIndexInt + (step || 1) );
  };
  const goToPrevPages = (step=2) => {
    const newIndex = activeLeafIndexInt - (step || 1);
    setActiveLeafCursor(newIndex === -1 ? 0 : newIndex < 0 ? -2 : newIndex);
  };




  if(width <=1200) {
      /*
    const imgUrl = pageUrl(activeLeafCursor);
    const pageFormatted = pageNumFormatter(activeLeafCursor);
    const pageRef = null;

    return (
      <div className="faxPageViewer">
      <div className="pageReferences">
        <h6>{pageRef}</h6>
        </div>
        <div className="pageContainer">
          <div className="page" {...swipeHandlers}>
            <img src={imgUrl} alt={`Page ${pageNumFormatter(activeLeafCursor)}`} />
          </div>
        </div>
        <div className="pageNumbers">
        <h6>{pageFormatted ? `Page ${activeLeafCursor}` : ''}</h6>
        </div>
      </div>
    );
    */
  }


  //preload the images on the other sides
  //use activeLeafIndexInt
  const sidesToPreload = [activeLeafIndexInt - 2, activeLeafIndexInt - 1, activeLeafIndexInt + 1, activeLeafIndexInt + 2];
  const preloadLeaves = leafIndex.filter((leaf) => sidesToPreload.includes(leaf.seq));

  return (
    <div className="faxPageViewer noselect">
    <div className="pageReferences">
      <h6 style={{ marginRight: "3rem" }}>{leftPage.pageReference}</h6>
      <h6 style={{ marginLeft: "3rem" }}>{rightPage.pageReference}</h6>
      </div>
      <div className="pagesContainer">
        <div className="leftPage page" onClick={()=>goToPrevPages(2)}>
         {!!leftPage.pageAssetUrl && <img src={leftPage.pageAssetUrl} alt={`Page ${leftPage.pageSlugLeaf}`} />}
        </div>
        <div className="rightPage page" onClick={()=>goToNextPages(2)}>
          <img src={rightPage.pageAssetUrl} alt={`Page ${rightPage.pageSlugLeaf}`} />
        </div>
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
  const match = useRouteMatch();
  const activeFax = FaxList?.[match.params.faxVersion];
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
