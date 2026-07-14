import React, { useEffect, useState } from "react";

import { Link } from "react-router-dom";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import { usePageController } from "src/contexts/PageControllerContext";

export default function Connection({ rowData }) {
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

  return (
    <div className="row" type={rowData.connection.type}>
      <div style={{ width: "100%" }}>
        <ConnectionLink rowData={rowData} pageAnimation={pageAnimation} />
      </div>
    </div>
  );
}

const ConnectionLink = ({ rowData, pageAnimation }) => {
  const pageController = usePageController();
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
