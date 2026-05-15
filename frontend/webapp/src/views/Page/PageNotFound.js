import React from "react";
import { Alert } from "reactstrap";
import { label } from "src/models/Utils";

export default function PageNotFound({ type, id }) {
  return (
    <div className="content page ready">
      <Alert color="warning" className="pageInfo">
        <h4>{label("not_found_title") || "Not found"}</h4>
        <p>
          {(label("not_found_body") || "We couldn't find the requested resource.")}
          {" "}<code>{type}/{id}</code>
        </p>
        <a href="/">{label("back_home") || "Back to home"}</a>
      </Alert>
    </div>
  );
}
