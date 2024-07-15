import React, { useState, useCallback, useEffect } from "react";
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


function FacsimileViewer({item}) {

  const history = useHistory()

  const [activePage, setActivePage] = useState(0);
  const { title } = item;
  console.log({item, activePage})
  return <div className="facsimileViewer">
    <h2 className="facsimileViewerTitle">
      <span 
        style={{flexGrow: 0, cursor: "pointer"}}
      onClick={() => history.push("/fax")}>⬅</span>
      <span style={
        {flexGrow: 1, color: "black"}
      }>{title}</span>
      </h2>
    {!!activePage ? 
      <FacsimilePageViewer item={item} activePage={activePage}  setActivePage={setActivePage} /> :
      <FacsimileGridViewer item={item} setActivePage={setActivePage} />  }
  </div>
}
function FacsimileGridViewer({ item, setActivePage }) {
  const leafCount = item.pages + item.pgoffset;
  const { format, slug } = item;

  const cells = Array.from({ length: leafCount }, (_, i) => i - item.pgoffset + 1);

  const urlFormatter = (pagenum) => `${assetUrl}/fax/thumb/${slug}/${pagenum.toString().padStart(3, "0")}.${format || "jpg"}`;

  return (
    <div className="faxGridViewer">
      {cells.map((i) => {
        const url = urlFormatter(i);
        const alt = `${item.title} - Page ${i}`;
        return (
          <div key={i} className="faxPage" onClick={() => setActivePage(i)}>
            <div className="pageOverlay">Page {i}</div>
            <img src={url} alt={alt} />
          </div>
        );
      })}
    </div>
  );
}

function FacsimilePageViewer({ item, activePage, setActivePage }) {
  // Determine if the current page is even or odd
  const isEvenPage = activePage % 2 === 0;

  // Determine the companion page based on the current page's parity
  const companionPage = isEvenPage ? activePage + 1 : activePage - 1;

  // Function to navigate to the next set of pages
  const goToNextPages = () => {
    // Assuming the item has a 'pages' property that is an array of pages
    const nextPage = activePage + (isEvenPage ? 2 : 1);
    setActivePage(nextPage);
  };

  // Function to navigate to the previous set of pages
  const goToPrevPages = () => {
    const prevPage = activePage - (isEvenPage ? 1 : 2);
    setActivePage(prevPage);
  };

  const backToGridView = () => {
    setActivePage(0);
  }
  const maxPages = item.pages + item.pgoffset;
  const arrayOfCount = Array.from({ length: maxPages }, (_, i) => i - item.pgoffset + 1);
  const SeekBlocks = <div className="seekBlocks">
    {arrayOfCount.map((i) => <div key={i} className="seekBlock" onClick={() => setActivePage(i)}></div>)}
  </div>


  const pageUrl = (pagenum) => `${assetUrl}/fax/pages/${item.slug}/${pagenum.toString().padStart(3, "0")}.${item.format || "jpg"}`;

  const leftPage = isEvenPage ? activePage : companionPage;
  const rightPage = isEvenPage ? companionPage : activePage;
  const leftUrl = pageUrl(leftPage);
  const rightUrl = pageUrl(rightPage);
  return (
    <div className="faxPageViewer noselect">
      
      <div className="pagesContainer">
        <div className="leftPage page" onClick={goToPrevPages}>
          <img src={leftUrl} alt={`Page ${leftPage}`} />
        </div>
        <div className="rightPage page" onClick={goToNextPages}>
          <img src={rightUrl} alt={`Page ${rightPage}`} />
        </div>
      </div>
      <div className="pageNumbers">
      <h6 style={{marginRight: "3rem"}}>Page {leftPage}</h6>
      <h6 style={{marginLeft: "3rem"}}>Page {rightPage}</h6>
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
