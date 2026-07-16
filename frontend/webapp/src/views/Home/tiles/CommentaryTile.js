import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import Parser from "html-react-parser";
import { enDash } from "./textUtils";
import { openScripture } from "./ScripturePopup";
import { getDetectedScripturesHtml, getHtmlScriptureLinkParserOptions } from "src/views/_Common/ViewUtils";

const scriptureOpts = getHtmlScriptureLinkParserOptions((ref) => openScripture(ref));

const stripTags = (html) =>
  (html || "").replace(/<[^>]*>/gi, " ").replace(/\s+/g, " ").trim();

/**
 * Commentary sample. The body flows to a max height, then cuts with an inline
 * "read more" that expands the DOM in place (NOT a navigation). "See in
 * context" is the separate, explicit action that takes you into the app.
 */
export default function CommentaryTile({ data }) {
  const bodyRef = useRef(null);
  const [truncated, setTruncated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const text = stripTags(data?.text || data?.preview);
  useEffect(() => {
    const el = bodyRef.current;
    if (el && !expanded) setTruncated(el.scrollHeight > el.clientHeight + 2);
  }, [text, expanded]);
  if (!data?.id) return null;
  const pub = data.publication || {};
  const author = [pub.source_name, pub.source_title].filter(Boolean).join(", ");
  const to = `/commentary/${data.id}`;
  const openRef = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openScripture(data.reference);
  };
  return (
    <div className="samplerTileInner commentaryTile">
      <h3 className="tileHeading">{label("commentary")}</h3>
      <div className="commentaryTileBody">
        <div className="commentaryTileMain">
          {/* header flush top-left — links into the app */}
          <Link to={to} className="commentaryTileTitle">{enDash(data.title)}</Link>
          {/* flows to a max height, then read-more expands inline (no nav) */}
          {/* scripture references in the body are detected + clickable */}
          <p
            ref={bodyRef}
            className={`commentaryTileExcerpt${expanded ? " expanded" : ""}`}
          >
            {Parser(getDetectedScripturesHtml(text), scriptureOpts)}
          </p>
          {truncated && !expanded ? (
            <button
              className="commentaryTileReadMore readMoreBtn"
              onClick={() => setExpanded(true)}
            >
              {label("read_more")}
            </button>
          ) : null}
        </div>
        {/* right column: cover, attribution, scripture ref, in-context cue */}
        <div className="commentaryTileAside">
          {pub.source_id ? (
            <Link to={to}>
              <img
                className="commentaryTileCover"
                src={`${assetUrl}/source/cover/${String(pub.source_id).padStart(3, "0")}`}
                alt={pub.source_title || ""}
                loading="lazy"
                onError={(e) => (e.target.style.display = "none")}
              />
            </Link>
          ) : null}
          {author ? <div className="commentaryTileSource">{author}</div> : null}
          {data.reference ? (
            <span className="commentaryTileRef scripture_link" role="button" tabIndex={0} onClick={openRef}>
              {enDash(data.reference)}
            </span>
          ) : null}
          <Link to={to} className="commentaryTileMore tileMoreLink">{label("view_in_context")}</Link>
        </div>
      </div>
    </div>
  );
}
