import React, { useEffect } from "react";
import { label } from "src/models/Utils";
import "./Theology.css";

/**
 * Placeholder Theology view. The real experience (theological topics / a
 * concept map assembled from the commentary + dictionary corpus) is TBD; this
 * keeps the new sidebar entry from dead-ending while it's built.
 */
export default function Theology() {
  useEffect(() => {
    document.title = label("menu_theology") + " | " + label("home_title");
  }, []);
  return (
    <div className="container theologyPlaceholder">
      <div className="theologyInner">
        <h2>{label("menu_theology")}</h2>
        <p className="theologyComingSoon">⌛ {label("coming_soon")}</p>
      </div>
    </div>
  );
}
