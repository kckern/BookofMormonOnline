import React from "react";
import Parser from "html-react-parser";
import ReactTooltip from "react-tooltip";
import { tooltipTheme } from "src/utils/themeColors";
import { Link } from "react-router-dom";
import { detectScriptures } from "scripture-guide";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { useAppController } from "src/contexts/AppControllerContext";
import { usePageController } from "src/contexts/PageControllerContext";

// Slugs like "mormon2" inside {Mormon|mormon2} otherwise read as the scripture
// reference "Mormon 2" and corrupt the slug capture before token parsing.
const PP_TOKEN_SENTINEL = "";
const PP_TOKEN_REGEX = /\{(.*?)\|(.*?)\}|\[(.*?)\|(.*?)\]/g;

export const detectScripturesPreservingTokens = (text, callback, options) => {
  if (typeof text !== "string" || !text) return text;
  const tokens = [];
  const masked = text.replace(PP_TOKEN_REGEX, (m) => {
    tokens.push(m);
    return PP_TOKEN_SENTINEL;
  });
  if (tokens.length === 0) return detectScriptures(text, callback, options);
  const detected = detectScriptures(masked, callback, options);
  if (typeof detected !== "string") return detected;
  let i = 0;
  return detected.replace(new RegExp(PP_TOKEN_SENTINEL, "g"), () => tokens[i++] ?? "");
};

export const renderPersonPlaceHTML = (html, pageController, scriptureLinkClickHandler) => {
  if (!html) return null;
  html = html.replace(
    /{(.*?)\|(.*?)}/g,
    "<a class='person' slug='$2' label='$1'></a>",
  );
  html = html.replace(
    /\[(.*?)\|(.*?)\]/g,
    "<a class='place'  slug='$2' label='$1'></a>",
  );

  // Pair each person/place anchor's class WITH its slug from the same match, so
  // the tooltip type can't drift. The old approach matched class and slug into
  // two separate arrays and zipped them with className.shift(), which silently
  // misaligned (a token would get the wrong "...List" type and resolve to null)
  // whenever the anchors didn't line up 1:1 — that's why some people tooltips
  // (lehi1, god, zedekiah1) came up empty while others worked.
  const tokens = [
    ...html.matchAll(/class='(person|place)'\s+slug='([^']*)'/g),
  ].map((m) => ({ type: `${m[1]}List`, slug: m[2] }));

  html = html + "<span class='react-tooltip'></span>";

  const options = {
    replace: (domNode) => {
      const attribs = { ...domNode.attribs };
      if (attribs?.classname === 'scripture_link') {
        const ref = domNode.children[0].data;
        // TODO: figure out why not a regular class here insead of className (reparsed?)
        attribs.className = attribs.classname;
        delete attribs.classname;
        return <a {...attribs} onClick={()=>scriptureLinkClickHandler(ref)}>{ref}</a>;
      }

      if (domNode.attribs && domNode.attribs.class === "person") {
        return (
          <PersonLink
            controller={pageController}
            label={domNode.attribs.label}
            id={domNode.attribs.slug}
          />
        );
      }
      if (domNode.attribs && domNode.attribs.class === "place") {
        return (
          <PlaceLink
            controller={pageController}
            label={domNode.attribs.label}
            id={domNode.attribs.slug}
          />
        );
      }
      if (domNode.attribs && domNode.attribs.class === "react-tooltip") {
        if (!tokens.length) {
          return <></>;
        }
        // One tooltip per distinct token (dedupe: the same slug repeats many
        // times across a page's rows, which otherwise emits dozens of duplicate
        // same-id ReactTooltips).
        const seen = new Set();
        return (
          <>
            {tokens
              .filter((t) => (seen.has(t.slug) ? false : seen.add(t.slug)))
              .map((t, index) => (
                <ReactTooltip
                  wrapper={"span"}
                  id={t.slug}
                  key={`tt-${t.slug}-${index}`}
                  effect="solid"
                  backgroundColor={tooltipTheme().backgroundColor}
                  arrowColor={tooltipTheme().backgroundColor}
                  textColor={tooltipTheme().textColor}
                >
                  <NarrationToolTip
                    id={t.slug}
                    type={t.type}
                  />
                </ReactTooltip>
              ))}
          </>
        );
      }
    },
  };
  return Parser(html, options);
};

function PersonLink({ label, id, controller }) {
  // Out-of-tree callers (Drawer, Map InfowindowContent, PopUp person/place
  // descriptions) render this via renderPersonPlaceHTML with an appController
  // passed as the controller arg and NO PageControllerProvider above them —
  // so we resolve via the Task-17 override mechanism, not a bare context read.
  const pageController = usePageController(controller);
  const handleClick = (e) => {
    e.preventDefault();
    const appController = pageController?.appController || pageController;
    appController.functions.setPopUp({
      type: "people",
      ids: [id],
    });
  };

  return (
    <>
      <Link
        to={"/people/" + id}
        data-tip
        data-for={id}
        onClick={handleClick}
        className={"person"}
      >
        <strong>{label}</strong>
      </Link>
    </>
  );
}
function PlaceLink({ label, id, controller }) {
  // See PersonLink: override mechanism for out-of-tree (Drawer/Map/PopUp) callers.
  const pageController = usePageController(controller);
  const handleClick = (e) => {
    e.preventDefault();
    const appController = pageController?.appController || pageController;
    appController.functions.setPopUp({
      type: "places",
      ids: [id],
    });
  };

  return (
    <>
      <Link
        to={"/place/" + id}
        data-tip
        data-for={id}
        onClick={handleClick}
        className={"place"}
      >
        <strong>{label}</strong>
      </Link>
    </>
  );
}

function NarrationToolTip({ type, id }) {
  const appController = useAppController();
  // Prefer the always-current global.preLoad over the appController prop: the
  // narration captures appController at mount (see Page.js pageController init),
  // so its preLoad is frozen at that moment — often before the full person/place
  // list has loaded — leaving the prop's preLoad with only labels. global.preLoad
  // is updated on every setPreLoadData (same pattern as global.dictionary).
  const preLoad =
    (typeof global !== "undefined" && global.preLoad) || appController?.preLoad;
  if (!preLoad || preLoad[type] === undefined) return null;

  let list = Object.values(preLoad[type]);
  let ttData = list.find((x) => x.slug === id);
  if (!ttData) return null;
  let info = ttData.title || ttData.info;
  let name = ttData.name.replace(/(.*?), (.*)/, "$2 $1");
  let linkType = type === "personList" ? "people" : "places";
  if (!info) return null;
  return (
    <div className="ppToolTip">
      <img src={`${assetUrl}/${linkType}/${id}`} alt={linkType} />
      <div>
        <div className="ppToolTipName">{formatNameNumbers(name)}</div>
        <div className="ppToolTipInfo">{formatNameNumbers(info)}</div>
      </div>
    </div>
  );
}

const SUPERSCRIPT_DIGITS = { 1: "¹", 2: "²", 3: "³", 4: "⁴" };
// Scripture homonyms are disambiguated with trailing digits (lehi1, alma2);
// render them as superscripts everywhere. Canonicalized 2026-07-14 — the old
// tooltip formatter used subscripts and only converted the first occurrence.
export function formatNameNumbers(string) {
  if (!string) return null;
  return String(string).replace(/[1-4]/g, (d) => SUPERSCRIPT_DIGITS[d]);
}
