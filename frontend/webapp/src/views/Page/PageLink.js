import React, { useEffect, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { Card, CardHeader, Col } from "reactstrap";
import { renderPersonPlaceHTML } from "./PersonPlace";

export default function PageLink({ rowData, pageController }) {

  const history = useHistory();
  const { setStageClass } = pageController.appController?.functions || {};
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const { slug } = rowData.capsulation || {};
  const [first, second] =  ["stageLeft", "stageRight"];

  const handleClick = async (event) => {
    if (!setStageClass) return;
    event.preventDefault();
    setStageClass(first);
    await wait(400);
    setStageClass(second + " " + first);
    await wait(10);
    setStageClass(second);
    history.push(`/${slug}`);
    await wait(500);
    while (!document.querySelector(".content.ready")) await wait(50);
    setStageClass(null);
  };

  let description = renderPersonPlaceHTML(
    rowData.capsulation?.description || "",
    pageController
  );
  let reference = rowData.capsulation?.reference;

  return (
    <div className="card-body">
      <div className="row">
        <div className="col-sm-6 narration">
          <div className="capsulation_narration">{description}</div>
        </div>
        <Col md={6} className="scripture capsulation">
          <div
            role="tablist"
            aria-multiselectable="true"
            className="card-collapse"
          >
            <Card className="card-plain">
              <CardHeader role="tab" className="reference link">
                <Link to={`/${slug}`} onClick={handleClick} data-toggle="collapse">
                  <span className={"square"}>■</span> {reference}
                </Link>
              </CardHeader>
            </Card>
          </div>
        </Col>
      </div>
    </div>
  );
}
