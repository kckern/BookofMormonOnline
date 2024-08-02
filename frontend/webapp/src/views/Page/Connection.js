import React, { useEffect, useState } from "react";

import { Link } from "react-router-dom";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";

export default function Connection({ index, rowData, pageController }) {
  const [pageAnimation, setPageAnimation] = useState({
    connectionType: "rightconnection",
    image: "right-image",
  });

  useEffect(() => {
    switch (rowData.connection.type) {
      case "left":
        setPageAnimation({
          connectionType: "leftconnection",
          image: "right-image",
        });
        break;
      case "from":
        setPageAnimation({
          connectionType: "fromconnection",
          image: "left-image",
        });
        break;
      case "back":
        setPageAnimation({
          connectionType: "backconnection",
          image: "left-image",
        });
        break;
      default:
        setPageAnimation({
          connectionType: "rightconnection",
          image: "right-image",
        });
        break;
    }
  }, [rowData.connection.type]);

  // ** NOT IS USE
  // redirect page to other page using slug
  // const pageRedirect = (slug, connectionType, isPage) => {
  //     let animationType = checkConnectionType(connectionType);
  //     document.getElementById("page").classList.add(animationType);
  //     setTimeout(() => {
  //         document.getElementById("page").classList.remove(animationType)
  //         onClickConnection(slug, animationType, isPage)
  //     }, 950)
  // }

  // const checkConnectionType = (connectionType) => {
  //     switch (connectionType) {
  //         case "rightconnection":
  //             return "center-to-left"
  //         case "fromconnection":
  //             return "center-to-left"
  //         default:
  //             return "center-to-right"
  //     }
  // }



  return (
    <div className="row" type={rowData.connection.type}>
      <div style={{ width: "100%" }}>
        <ConnectionLink rowData={rowData} pageAnimation={pageAnimation} pageController={pageController} />
      </div>
    </div>
  );
}

const ConnectionLink = ({ rowData, pageAnimation, pageController }) => {
  const history = useHistory();
  const {setStageClass} = pageController.appController?.functions || {};
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const {slug, type:linkType} = rowData.connection;
  const [first,second] = linkType !== "right" ?["stageRight","stageLeft"]:["stageLeft","stageRight"];

  const handleClick = async (event) => {
    if(!setStageClass) return;
    event.preventDefault();
    setStageClass(first);
    await wait(400);
    setStageClass(second + " "  + first);
    await wait(10);
    setStageClass(second);
    history.push(`/${slug}`);
    await wait(500);
    while (!document.querySelector(".content.ready"))  await wait(50);
    setStageClass(null);
  };

  return (
    <Link to={`/${slug}`} onClick={handleClick}>
      <div>
        <div
          className={`${pageAnimation.image} ${pageAnimation.connectionType} connection`} >
          {rowData.connection.text}
        </div>
      </div>
    </Link>
  );
};
