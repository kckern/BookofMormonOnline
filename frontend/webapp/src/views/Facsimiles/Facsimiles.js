import React, { useState, useCallback, useEffect } from "react";
// COMPONENTS
import Loader from "../_Common/Loader";

import { Card, CardHeader, CardBody } from "reactstrap";
import { Link } from 'react-router-dom';
import Masonry from 'react-masonry-css'
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { assetUrl } from 'src/models/BoMOnlineAPI';
import "./Facsimiles.css"
import { useLocation, useParams, useRouteMatch } from "react-router-dom";
import { label } from "src/models/Utils";





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
