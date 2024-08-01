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


const convertRomanNumeralToInt = (num) => {
  const isAlreadyInt = typeof num === "number";
  if (isAlreadyInt) return num;
  const isAlreadyNumericString = /^\d+$/.test(num);
  if (isAlreadyNumericString) return parseInt(num);
  const romanNumeralMap = [
    { numeral: "M", value: 1000 },
    { numeral: "CM", value: 900 },
    { numeral: "D", value: 500 },
    { numeral: "CD", value: 400 },
    { numeral: "C", value: 100 },
    { numeral: "XC", value: 90 },
    { numeral: "L", value: 50 },
    { numeral: "XL", value: 40 },
    { numeral: "X", value: 10 },
    { numeral: "IX", value: 9 },
    { numeral: "V", value: 5 },
    { numeral: "IV", value: 4 },
    { numeral: "I", value: 1 },
  ];

  let result = 0;
  let number = num.toUpperCase();

  for (let i = 0; i < romanNumeralMap.length; i++) {
    const { numeral, value } = romanNumeralMap[i];
    while (number.indexOf(numeral) === 0) {
      result += value;
      number = number.replace(numeral, "");
    }
  }
  return result;

}


const convertToRomanNumeral = (int, lowercase=false) => {
  int = Math.abs(int);
  const romanNumeralMap = [
    { numeral: "M", value: 1000 },
    { numeral: "CM", value: 900 },
    { numeral: "D", value: 500 },
    { numeral: "CD", value: 400 },
    { numeral: "C", value: 100 },
    { numeral: "XC", value: 90 },
    { numeral: "L", value: 50 },
    { numeral: "XL", value: 40 },
    { numeral: "X", value: 10 },
    { numeral: "IX", value: 9 },
    { numeral: "V", value: 5 },
    { numeral: "IV", value: 4 },
    { numeral: "I", value: 1 },
  ];

  let result = "";
  let number = int;

  for (let i = 0; i < romanNumeralMap.length; i++) {
    const { numeral, value } = romanNumeralMap[i];
    result += numeral.repeat(Math.floor(number / value));
    number %= value;
  }
  if(lowercase) result = result.toLowerCase();
  return result
}

function FacsimileViewer({item}) {

  const history = useHistory()
  const match = useParams();


  const pageNumberFromUrl = /[0-9]+/.test(match.pageNumber) ? parseInt(match.pageNumber): match.pageNumber || 0;
  const pageNumber = convertRomanNumeralToInt(pageNumberFromUrl);

  const [activePage, setActivePage] = useState(pageNumber);
  const { title } = item;
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

  const urlFormatter = (pagenum) => {
    if (pagenum <= 0) {
      // Calculate new page number by adding negative pagenum to pgoffset
      const newPageNum = item.pgoffset + pagenum;
      // Return the URL with `000.{prepage}` format
      return `${assetUrl}/fax/thumb/${slug}/000.${newPageNum.toString().padStart(2, "0")}.${format || "jpg"}`;
    } else {
      // Proceed with the original formatting for non-negative pagenum
      return `${assetUrl}/fax/thumb/${slug}/${pagenum.toString().padStart(3, "0")}.${format || "jpg"}`;
    }
  };

  const [thumbnailWidth, setThumbnailWidth] = useState(300);
  const [faxGridViewerWidth, setFaxGridViewerWidth] = useState(0);




  return (
    <div className="faxGridViewer">
      {cells.map((i) => {
        const url = urlFormatter(i);
        const alt = `${item.title} - Page ${i}`;
        if(i <= 0) i = convertToRomanNumeral(item.pgoffset + i, true);
        return (
          <div key={i} className="faxPage" onClick={() => setActivePage(i)} >
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
  const history = useHistory();

  // Determine the companion page based on the current page's parity
  const companionPage = isEvenPage ? activePage + 1 : activePage - 1;

  useEffect(() => {
    // set route to /fax/:slug/:page
    history.push(`/fax/${item.slug}/${activePage}`)
  }, [activePage]);

  // Function to navigate to the next set of pages
  const goToNextPages = () => {
    const hasNextPage = activePage < item.pages;
    if (!hasNextPage) return;
    // Assuming the item has a 'pages' property that is an array of pages
    const nextPage = activePage + (isEvenPage ? 2 : 1);
    setActivePage(nextPage);
  };

  // Function to navigate to the previous set of pages
  const goToPrevPages = () => {
    const hasPrevPage = activePage-1 > 1;
    if (!hasPrevPage) return;
    const prevPage = activePage - (isEvenPage ? 1 : 2);
    setActivePage(prevPage);
  };


  const maxPages = item.pages + item.pgoffset;
  const arrayOfCount = Array.from({ length: maxPages }, (_, i) => i - item.pgoffset + 1);
  const SeekBlocks = <div className="seekBlocks">
    {arrayOfCount.map((i) => <div key={i} className="seekBlock" onClick={() => setActivePage(i)}></div>)}
  </div>

  // URL formatter to handle subzero pages logic
  const pageUrl = (pagenum) => {
    if (pagenum <= 0) {
      // Calculate new page number by adding negative pagenum to pgoffset
      const newPageNum = item.pgoffset + pagenum;
      // Return the URL with `000.{prepage}` format
      return `${assetUrl}/fax/pages/${item.slug}/000.${newPageNum.toString().padStart(2, "0")}.${item.format || "jpg"}`;
    } else {
      // Proceed with the original formatting for non-negative pagenum
      return `${assetUrl}/fax/pages/${item.slug}/${pagenum.toString().padStart(3, "0")}.${item.format || "jpg"}`;
    }
  };

  const pageNumFormatter = (pagenum) => {
    if (pagenum <= 0) {
      return convertToRomanNumeral(item.pgoffset + pagenum, true);
    } else {
      return pagenum;
    }
  };

  const leftPage = isEvenPage ? activePage : companionPage;
  const rightPage = isEvenPage ? companionPage : activePage;
  const leftUrl = pageUrl(leftPage);
  const rightUrl = pageUrl(rightPage);

  const leftPageFormatted = pageNumFormatter(leftPage);
const rightPageFormatted = pageNumFormatter(rightPage);


  return (
    <div className="faxPageViewer noselect">
      <div className="pagesContainer">
        <div className="leftPage page" onClick={goToPrevPages}>
          <img src={leftUrl} alt={`Page ${pageNumFormatter(leftPage)}`} />
        </div>
        <div className="rightPage page" onClick={goToNextPages}>
          <img src={rightUrl} alt={`Page ${pageNumFormatter(rightPage)}`} />
        </div>
      </div>
      <div className="pageNumbers">
      <h6 style={{ marginRight: "3rem" }}>{leftPageFormatted ? `Page ${leftPageFormatted}` : ''}</h6>
      <h6 style={{ marginLeft: "3rem" }}>{rightPageFormatted ? `Page ${rightPageFormatted}` : ''}</h6>
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
