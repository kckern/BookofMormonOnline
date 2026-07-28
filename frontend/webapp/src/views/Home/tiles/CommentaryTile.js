import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { parse } from "node-html-parser";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import Parser from "html-react-parser";
import { enDash } from "./textUtils";
import { openScripture } from "./ScripturePopup";
import { getDetectedScripturesHtml, getHtmlScriptureLinkParserOptions } from "src/views/_Common/ViewUtils";
import { ATVHeader } from "src/views/_Common/ATV";

const scriptureOpts = getHtmlScriptureLinkParserOptions((ref) => openScripture(ref));

const stripTags = (html) =>
  (html || "").replace(/<[^>]*>/gi, " ").replace(/\s+/g, " ").trim();

/**
 * Commentary sample. The body is clamped to MATCH the right column's height
 * (cover + attribution + cue) so the columns balance and the read-more pill
 * lands at the visual bottom with no dead space. Read-more expands the DOM in
 * place (not a nav); "See in context" is the separate action into the app.
 */
export default function CommentaryTile({ data }) {
  const asideRef = useRef(null);
  const bodyRef = useRef(null);
  const [maxH, setMaxH] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // ATV (Skousen textual-variants) commentaries lead with a <div class="source">
  // apparatus block. Lift it out and render it as the interactive apparatus (the
  // same component the popup uses); the prose excerpt then uses the bracket-free
  // preview so raw sigla never leak into the tile.
  const atvHTML = useMemo(() => {
    const raw = data?.text || "";
    if (!/class=['"]source['"]/.test(raw)) return "";
    const el = parse(raw).querySelector(".source");
    return el ? el.outerHTML.trim() : "";
  }, [data?.text]);
  const isAtv = !!atvHTML;
  const text = isAtv ? (data?.preview || "") : stripTags(data?.text || data?.preview);

  // Match the excerpt's clamp height to the aside column so both sides bottom
  // out together; then detect whether the text actually overflows that height.
  useLayoutEffect(() => {
    if (expanded || isAtv) return;
    const aside = asideRef.current;
    const body = bodyRef.current;
    if (!aside || !body) return;
    const avail = aside.offsetHeight - (body.offsetTop - aside.offsetTop >= 0 ? 0 : 0);
    // clamp height = aside height minus the title above the excerpt
    const titleH = body.previousElementSibling ? body.previousElementSibling.offsetHeight + 6 : 0;
    const target = Math.max(72, aside.offsetHeight - titleH - 26); // 26 ≈ read-more row
    setMaxH(target);
    setTruncated(body.scrollHeight > target + 2);
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
          <Link to={to} className="commentaryTileTitle">{enDash(data.title)}</Link>
          {isAtv ? (
            <div className="commentaryTileAtv">
              <ATVHeader atvHTML={atvHTML} reference={data.reference} />
            </div>
          ) : null}
          <p
            ref={bodyRef}
            className={`commentaryTileExcerpt${expanded ? " expanded" : ""}`}
            style={!expanded && maxH ? { maxHeight: maxH } : undefined}
          >
            {Parser(getDetectedScripturesHtml(text), scriptureOpts)}
          </p>
          {!isAtv && truncated && !expanded ? (
            <button className="readMorePill" onClick={() => setExpanded(true)}>
              {label("read_more")}
            </button>
          ) : null}
        </div>
        {/* right column: scripture ref ABOVE the cover, then attribution + cue */}
        <div className="commentaryTileAside" ref={asideRef}>
          {data.reference ? (
            <span className="commentaryTileRef scripture_link" role="button" tabIndex={0} onClick={openRef}>
              {enDash(data.reference)}
            </span>
          ) : null}
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
          <Link to={to} className="commentaryTileMore tileMoreLink">{label("view_in_context")}</Link>
        </div>
      </div>
    </div>
  );
}
