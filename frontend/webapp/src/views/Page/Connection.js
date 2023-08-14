import React, { useEffect, useState } from "react";

import { Link } from "react-router-dom";

export default function Connection({ index, rowData, onClickConnection }) {
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
        <Link to={`/${rowData.connection.slug}`}>
          <div>
            <div
              className={`${pageAnimation.image} ${pageAnimation.connectionType} connection `}
            >
              {rowData.connection.text}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
