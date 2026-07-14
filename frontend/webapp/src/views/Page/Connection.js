import React from "react";
import { Link } from "react-router-dom";
import { useStageTransition } from "./useStageTransition";

const CONNECTION_ANIMATION = {
  left: { connectionType: "leftconnection", image: "right-image" },
  from: { connectionType: "fromconnection", image: "left-image" },
  back: { connectionType: "backconnection", image: "left-image" },
  right: { connectionType: "rightconnection", image: "right-image" },
};

export default function Connection({ rowData }) {
  const pageAnimation =
    CONNECTION_ANIMATION[rowData.connection.type] || CONNECTION_ANIMATION.right;
  return (
    <div className="row" type={rowData.connection.type}>
      <div style={{ width: "100%" }}>
        <ConnectionLink rowData={rowData} pageAnimation={pageAnimation} />
      </div>
    </div>
  );
}

const ConnectionLink = ({ rowData, pageAnimation }) => {
  const stageTransition = useStageTransition();
  const { slug, type: linkType } = rowData.connection;
  // Historical mapping: every non-"right" connection played the reverse sweep.
  const direction = linkType !== "right" ? "back" : "forward";
  return (
    <Link to={`/${slug}`} onClick={stageTransition(slug, direction)}>
      <div>
        <div
          className={`${pageAnimation.image} ${pageAnimation.connectionType} connection`}
        >
          {rowData.connection.text}
        </div>
      </div>
    </Link>
  );
};
