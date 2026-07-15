import React from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, Col } from "reactstrap";
import { renderPersonPlaceHTML } from "./PersonPlace";
import { usePageController } from "src/contexts/PageControllerContext";
import { useStageTransition } from "./useStageTransition";

export default function PageLink({ rowData }) {

  const pageController = usePageController();
  const stageTransition = useStageTransition();
  const { slug } = rowData.capsulation || {};

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
            className="card-collapse"
          >
            <Card className="card-plain">
              <CardHeader className="reference link">
                <Link to={`/${slug}`} onClick={stageTransition(slug, "forward")} data-toggle="collapse">
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
