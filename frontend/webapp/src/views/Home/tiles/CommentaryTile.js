import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { parse } from "node-html-parser";
import { lookup } from "scripture-guide";
import Parser from "html-react-parser";
import { enDash } from "./textUtils";
import { getDetectedScripturesHtml } from "src/views/_Common/ViewUtils";
import { ATVHeader } from "src/views/_Common/ATV";
import { RevealProvider, useReveal } from "./_ds/Reveal";
import TileCTA from "./_ds/TileCTA";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import labelOr from "./_ds/labelOr";
import RefPill, { makeRefPillParserOptions } from "./RefPill";
import { readExpanded, writeExpanded } from "./samplerSession";

// Block-level boundaries become paragraph breaks; every other tag is dropped.
const BLOCK_BREAK = /<\/?(p|div|li|ul|ol|br|blockquote|h[1-6]|tr|td|table)\b[^>]*>/gi;
const decode = (s) =>
  s
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
// Light typographic clean-up of source-text junk: "north countries ?",
// "blessing-a constant" / "a week-not so far" (a hyphen standing in for a
// dash before a function word), "(see verses 6. 11)".
const tidy = (s) =>
  s
    .replace(/\s+([?!])/g, "$1")
    .replace(/(\p{L})-(a|an|the|not|and|but|or|that|which|this|it|to)\s/gu, "$1—$2 ")
    .replace(/\b(verses?|vv?\.)\s+(\d+)\.\s+(\d+)/g, "$1 $2, $3");
export const toParagraphs = (html) =>
  decode(html || "")
    .replace(BLOCK_BREAK, "\n")
    .replace(/<[^>]*>/g, "")
    .split(/\n+/)
    .map((p) => tidy(p.replace(/\s+/g, " ").trim()))
    .filter(Boolean);

// The revealed excerpt stays bounded (no 1600px wall in the feed): whole
// paragraphs up to ~EXPANDED_BUDGET chars, the last one cut at a word with "…".
// "See in context" carries the reader to the full commentary.
const EXPANDED_BUDGET = 1100;
const budgetParagraphs = (paras, budget) => {
  const out = [];
  let left = budget;
  for (const p of paras) {
    if (p.length <= left) {
      out.push(p);
      left -= p.length;
      continue;
    }
    if (left > 120 || !out.length) {
      const cut = p.slice(0, left).replace(/\s+\S*$/, "").replace(/[\s,;:.–—-]+$/, "");
      out.push(`${cut}…`);
    } else if (out.length) {
      out[out.length - 1] = out[out.length - 1].replace(/[\s.]*$/, "") + "…";
    }
    return out;
  }
  return out;
};

// A title that is nothing but a reference ("Alma 37:16–20") gives a newcomer no
// hook; such rows (Book of Mormon Minute) also carry a reference column that is
// off by one verse, while the title matches the prose ("Verse 19…").
const isBareRef = (s) => {
  const t = (s || "").replace(/[“”"]/g, "").trim();
  if (!t || t.length > 40 || !/\d+:\d+/.test(t)) return false;
  try {
    return (lookup(t)?.verse_ids?.length || 0) > 0;
  } catch {
    return false;
  }
};
const firstSentence = (paras) => {
  const p = paras[0] || "";
  const m = /^(.{20,160}?[.!?])(\s|$)/.exec(p);
  return m ? m[1] : p.length > 140 ? `${p.slice(0, 140).replace(/\s+\S*$/, "")}…` : p;
};

/**
 * Commentary sample. The body is clamped to MATCH the right column's height
 * (ref + cover + attribution) so the columns balance; Read more reveals a
 * bounded, paragraph-preserving excerpt in place and flips to Show less
 * (reversible, focus kept). "See in context" is the separate, single tab stop
 * into /commentary/:id, in a full-width footer row under both columns. Title
 * and cover are pointer-only shortcuts to the same place.
 */
function CommentaryTileInner({ data }) {
  const { reveal, registerGate } = useReveal();
  const asideRef = useRef(null);
  const bodyRef = useRef(null);
  const [maxH, setMaxH] = useState(null);
  // The reveal survives Back (audit commentary-E2): restored expanded = it was
  // truncated when the reader opened it, so the Show less toggle comes back too.
  const persistKey = data?.id ? `commentary:${data.id}` : undefined;
  const [expanded, setExpanded] = useState(() => readExpanded(persistKey));
  const [truncated, setTruncated] = useState(expanded);
  useLayoutEffect(() => {
    if (!expanded) return;
    registerGate();
    reveal();
    // mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const paragraphs = useMemo(
    () => toParagraphs(isAtv ? data?.preview : data?.text || data?.preview),
    [isAtv, data?.text, data?.preview],
  );

  // Match the excerpt's clamp height to the aside column so both sides bottom
  // out together; then detect whether the text actually overflows that height.
  useLayoutEffect(() => {
    if (expanded || isAtv) return;
    const aside = asideRef.current;
    const body = bodyRef.current;
    if (!aside || !body) return;
    const titleH = body.previousElementSibling ? body.previousElementSibling.offsetHeight + 6 : 0;
    const target = Math.max(72, aside.offsetHeight - titleH - 30); // 30 ≈ read-more row
    setMaxH(target);
    // the CSS line-clamp can cut before the aside-matched height (wide tiles):
    // either bound counts as truncation, so the reveal is never silently lost
    const shownH = body.clientHeight ? Math.min(target, body.clientHeight) : target;
    setTruncated(body.scrollHeight > shownH + 2);
  }, [paragraphs, expanded, isAtv]);

  // Gate the deeplink only when a read-more will actually render (pre-paint).
  useLayoutEffect(() => {
    if (!isAtv && truncated) registerGate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truncated, isAtv]);

  if (!data?.id) return null;
  const pub = data.publication || {};
  const author = [pub.source_name, pub.source_title].filter(Boolean).join(", ");
  const to = `/commentary/${data.id}`;
  const bareTitle = !isAtv && isBareRef(data.title);
  const headline = bareTitle ? firstSentence(paragraphs) || data.title : data.title;
  const refText = bareTitle ? data.title.replace(/[“”"]/g, "").trim() : data.reference;
  // The lifted first sentence is the headline — don't repeat it as the body's opening.
  const bodyParas =
    bareTitle && headline && paragraphs[0]?.startsWith(headline)
      ? [paragraphs[0].slice(headline.length).trim(), ...paragraphs.slice(1)].filter(Boolean)
      : paragraphs;
  const shown = expanded ? budgetParagraphs(bodyParas, EXPANDED_BUDGET) : bodyParas;
  const toggle = () => {
    if (!expanded) reveal();
    writeExpanded(persistKey, !expanded);
    setExpanded(!expanded);
  };
  const coverPath = pub.source_id ? `source/cover/${String(pub.source_id).padStart(3, "0")}` : null;
  return (
    <div className="samplerTileInner commentaryTile">
      <h3 className="tileHeading">{labelOr("commentary", "Commentary")}</h3>
      <div className="commentaryTileBody">
        <div className="commentaryTileMain">
          {headline ? (
            <Link to={to} className="commentaryTileTitle" tabIndex={-1}>{enDash(headline)}</Link>
          ) : null}
          {isAtv ? (
            <div className="commentaryTileAtv">
              <ATVHeader atvHTML={atvHTML} reference={data.reference} />
            </div>
          ) : null}
          <div
            ref={bodyRef}
            className={`commentaryTileExcerpt${expanded ? " expanded" : truncated && !isAtv ? " isClamped" : ""}`}
            style={!expanded && maxH ? { maxHeight: maxH } : undefined}
          >
            {shown.map((p, i) => (
              <p key={i}>{Parser(getDetectedScripturesHtml(p), makeRefPillParserOptions({ contextRef: data.reference }))}</p>
            ))}
          </div>
          {!isAtv && truncated ? (
            <TileCTA
              variant="reveal"
              verb={expanded ? "showLess" : "readMore"}
              onClick={toggle}
              aria-expanded={expanded}
              className={expanded ? "isOpen" : ""}
            />
          ) : null}
        </div>
        {/* right column: scripture ref ABOVE the cover, then attribution */}
        <div className="commentaryTileAside" ref={asideRef}>
          {refText ? <RefPill refText={refText} className="commentaryTileRef" /> : null}
          {coverPath ? (
            <Link to={to} tabIndex={-1} aria-hidden="true" className="commentaryTileCoverLink">
              <TileImage
                path={coverPath}
                widths={[]}
                className="commentaryTileCover"
                alt={pub.source_title || ""}
                onError={(e) => (e.currentTarget.closest(".commentaryTileCoverLink").style.display = "none")}
              />
            </Link>
          ) : null}
          {author ? <div className="commentaryTileSource">{author}</div> : null}
        </div>
      </div>
      <div className="commentaryTileFoot">
        <TileDeepLink to={to} verb="seeInContext" className="commentaryTileMore" />
      </div>
    </div>
  );
}

export default function CommentaryTile(props) {
  return (
    <RevealProvider>
      <CommentaryTileInner {...props} />
    </RevealProvider>
  );
}
