import React, { useEffect } from "react";
import { Alert } from "reactstrap";
import { label } from "src/models/Utils";
import labelOr from "src/views/Home/tiles/_ds/labelOr";
import { pushDocTitle, popDocTitle } from "./docTitle";

export default function PageNotFound({ type, id }) {
  // labelOr, not `label(key) || fallback`: label() echoes a missing key, so the
  // old fallbacks never fired and raw keys leaked (blind audit r4 D5).
  const title = labelOr("not_found_title", "Not found");
  useEffect(() => {
    pushDocTitle("notFound", `${title} | ${labelOr("home_title", "Book of Mormon Online")}`);
    return () => popDocTitle("notFound");
  }, [title]);
  return (
    <div className="content page ready">
      <Alert color="warning" className="pageInfo">
        <h4>{title}</h4>
        <p>
          {labelOr("not_found_body", "We couldn’t find the requested resource.")}
          {" "}<code>{type}/{id}</code>
        </p>
        <a href="/">{labelOr("back_home", "Back to home")}</a>
      </Alert>
    </div>
  );
}
