import React from "react";

import { Link, useHistory } from "react-router-dom";
import { Card, CardHeader, Col } from "reactstrap";

import { renderPersonPlaceHTML } from "./PersonPlace";

export default function PageLink({ rowData, pageController }) {
  let description = renderPersonPlaceHTML(
    rowData.capsulation?.description || "",
    pageController
  );
  let reference = rowData.capsulation?.reference;
  return (
    <div className="card-body">
      {/* CONTENT ROW */}
      <div className="row">
        <div className="col-sm-6 narration">
          <div>{description}</div>
        </div>
        <Col md={6} className="scripture capsulation">
          <div
            role="tablist"
            aria-multiselectable="true"
            className="card-collapse"
          >
            <Card className="card-plain">
              <CardHeader role="tab" className="reference link">
                <Link
                  to={"/" + rowData.capsulation?.slug}
                  data-toggle="collapse"
                >
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
