import React from "react";
import { Link, useHistory } from "react-router-dom";
import Parser from "html-react-parser";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import { getDetectedScripturesHtml, getHtmlScriptureLinkParserOptions } from "src/views/_Common/ViewUtils";
import { openScripture } from "./ScripturePopup";

const SUPS = { 1: "¹", 2: "²", 3: "³", 4: "⁴" };

// Bios use the app's internal {Name|slug} / [Name|slug] link syntax — flatten
// to display names BEFORE anything else renders them; disambiguation digits
// attached to names (Mosiah1) render as the app's superscript convention.
const flatten = (html) =>
  (html || "")
    .replace(/{(.*?)\|(.*?)}/g, "$1")
    .replace(/\[(.*?)\|(.*?)\]/g, "$1")
    .replace(/<[^>]*>/gi, " ")
    .replace(/([A-Za-z])([1-4])\b/g, (m, a, d) => a + SUPS[d])
    .replace(/\s+/g, " ")
    .trim();

// Truncate at a sentence boundary when one lands in the back half; NEVER end
// inside an open parenthetical citation.
const clampWords = (text, words) => {
  const parts = (text || "").split(" ");
  if (parts.length <= words) return text;
  let cut = parts.slice(0, words).join(" ");
  const lastEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  if (lastEnd > cut.length * 0.5) return cut.slice(0, lastEnd + 1).trim();
  cut = cut.replace(/\s*\([^)]*$/, "").trim();
  return cut + "…";
};

/**
 * Sampling, not a mosaic: the seeded-first person is FEATURED — portrait,
 * epithet, bio with live scripture links, reference chips. Seven more render
 * as face cards (name + title + one index ref each), and the end cell is a
 * 3×3 mosaic of yet more faces — the "there is much more" signal — into /people.
 */
export default function PeopleTile({ data, seed = 0 }) {
  const [featured, ...rest] = data;
  const faces = rest.slice(0, 7);
  const mosaic = rest.slice(7, 16);
  // Dedupe index entries by annotation text, merging their refs
  // ("Deceives Zeniff — Mosiah 7:21 · 9:10", not two near-identical rows).
  const indexRows = [];
  for (const i of (featured.index || []).filter((x) => x?.ref)) {
    const text = flatten(i.text);
    const existing = indexRows.find((r) => r.text === text);
    if (existing) existing.refs.push(i.ref);
    else indexRows.push({ text, refs: [i.ref] });
  }
  const refs = indexRows.slice(0, 2);
  const scriptureOpts = getHtmlScriptureLinkParserOptions((ref) => openScripture(ref));
  const bio = clampWords(flatten(featured.description), 70);

  return (
    <div className="samplerTileInner peopleTile">
      <h3 className="tileHeading">
        <Link to="/people">{label("people")}</Link>
      </h3>
      <div className="peopleFeature">
        <Link to={`/people/${featured.slug}`} className="peopleFeatureImgLink">
          <img
            className="peopleFeatureImg"
            src={`${assetUrl}/people/${featured.slug}`}
            alt={featured.name || ""}
            loading="lazy"
            onError={(e) => (e.target.style.visibility = "hidden")}
          />
        </Link>
        <div className="peopleFeatureBody">
          <Link to={`/people/${featured.slug}`} className="peopleFeatureNameLink">
            {/* replaceNumbers: disambiguation digits render as superscripts (Heth2 → Heth²) */}
            <span className="peopleFeatureName">{replaceNumbers(featured.name)}</span>
            {featured.title ? <span className="peopleFeatureTitle">{featured.title}</span> : null}
          </Link>
          {bio ? (
            <div className="peopleFeatureDesc">{Parser(getDetectedScripturesHtml(bio), scriptureOpts)}</div>
          ) : null}
          {refs.length ? (
            <div className="peopleFeatureRefs">
              {refs.map((r) => (
                <span
                  className="peopleIndexItem"
                  key={r.refs[0]}
                  role="button"
                  tabIndex={0}
                  onClick={() => openScripture(r.refs[0])}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openScripture(r.refs[0])}
                >
                  <span className="refChip">{r.refs.slice(0, 2).join(" · ")}</span>
                  <span className="peopleIndexText">{r.text}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="peopleFaceRow">
        {faces.map((p, i) => {
          const idx = (p.index || []).filter((x) => x?.ref);
          const item = idx.length ? idx[(seed + i) % idx.length] : null;
          return (
            <Link to={`/people/${p.slug}`} key={p.slug} className="peopleFaceCard" title={p.title || p.name}>
              <div className="peopleFaceImgWrap">
                <img
                  className="peopleFaceImg"
                  src={`${assetUrl}/people/${p.slug}`}
                  alt={p.name || ""}
                  loading="lazy"
                  onError={(e) => (e.target.style.visibility = "hidden")}
                />
                <span className="peopleFaceName">{replaceNumbers(p.name)}</span>
                {p.title ? <span className="peopleFaceTitle">{p.title}</span> : null}
              </div>
              {item ? (
                <div className="peopleFaceBody">
                  <span className="peopleFaceIndexText">
                    <span
                      className="peopleFaceRef"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.preventDefault(); openScripture(item.ref); }}
                      onKeyDown={(e) => (e.key === "Enter") && (e.preventDefault(), openScripture(item.ref))}
                    >{item.ref}</span>
                    {" — "}
                    {flatten(item.text)}
                  </span>
                </div>
              ) : null}
            </Link>
          );
        })}
        <Link to="/people" className="peopleFaceCard viewAllCard" title={label("view_all")}>
          <div className="peopleFaceImgWrap">
            <div className="viewAllMosaic">
              {mosaic.map((p) => (
                <img
                  key={p.slug}
                  src={`${assetUrl}/people/${p.slug}`}
                  alt=""
                  loading="lazy"
                  onError={(e) => (e.target.style.visibility = "hidden")}
                />
              ))}
            </div>
            <span className="peopleFaceName viewAllOverlay">{label("view_all")} →</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
