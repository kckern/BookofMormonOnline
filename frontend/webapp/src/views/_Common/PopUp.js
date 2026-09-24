import React, { useState, useEffect, useRef } from "react";
import Comments from "./Study/Study";
import { assetUrl } from "src/models/BoMOnlineAPI";
import Parser from "html-react-parser";
import { renderMoneyQuote } from "./moneyQuote";
import Draggable from "react-draggable";
import { renderPersonPlaceHTML, detectScripturesPreservingTokens } from "../Page/PersonPlace";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import ReactTooltip from "react-tooltip";
import { Link, useHistory } from "react-router-dom";
import { Victory } from "src/views/User/Victory";
import moment from "moment";
import XrelSection from "./XrelSection";
import EntityThumb from "./EntityThumb";
import "./PopUp.css";
import {
  snapSelectionToWord,
  replaceNumbers,
  processName,
  label,
  log,
  isMobile,
} from "src/models/Utils";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from "reactstrap";
import ReactMarkdown from "react-markdown";
import Loader, { Spinner } from "./Loader";
import { MobileDrawer } from "./Drawer";
import { addHighlightTagSelectively } from "../Page/TextContent";
import Commentary from "./Commentary";
import { ScripturePanelSingle } from "../Page/Narration";
import { determineLanguage } from "../../models/Utils";
import { useAppController } from "src/contexts/AppControllerContext";
import { resolveSlug } from "src/models/slugVariants";
import PersonBody, { PersonChooser } from "./entity/PersonBody";
import Relationships from "./entity/Relationships";
import ReferenceList from "./entity/ReferenceList";

export function Loading({ type, callingAPI }) {
  const appController = useAppController();
  return (
    <div
      id="popUp"
      className="card popupwindow"
      style={{ top: appController.states.popUp.top }}
    >
      <div className="card-header">
        <ul className={"source_tabs souce_tab_list_" + 0}>
          <li className="close" onClick={appController.functions.closePopUp}>
            ×
          </li>
        </ul>
        <div className="popupwindow_head">
          {label("loading_x", [label(type.toLowerCase())])}
        </div>
      </div>
      <div className="card-body">
        <div id="my-tab-content" className="tab-content ">
          <div className="tab-pane active loading" id="home" role="tabpanel">
            <Spinner top={"10em"} />
          </div>
        </div>
      </div>
      <CommentsPlaceholder />
    </div>
  );
}

function CommentsPlaceholder() {
  return null;
}

function PopUp() {
  const appController = useAppController();
  // if (appController.states.popUp.open !== true) return (<></>);
  const [currentKeyVal, setCurrentKeyVal] = useState(null);

  //listen for escape key and close popup if pressed
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) {
        appController.functions.closePopUp();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  useEffect(() => {
    const key = appController.states.popUp.type;
    const val = Array.isArray(appController.states.popUp.activeId)
      ? appController.states.popUp.activeId.shift()
      : appController.states.popUp.activeId;
    if (!key || !val || currentKeyVal === `${key}.${val}`) return false;
    log({ appController, key, val });
    setCurrentKeyVal(`${key}.${val}`);
  }, [appController.states.popUp.type, appController.states.popUp.activeId]);
  if (!appController.popUpData) appController.popUpData = {};

  if (isMobile()) return <MobileDrawer />;
  if (!appController.states.popUp.open) return null;

  if (appController.states.popUp.type === "commentary")
    return <Commentary />;
  if (appController.states.popUp.type === "people")
    return <Person />;
  if (
    appController.states.popUp.type === "places" ||
    appController.states.popUp.type === "place"
  )
    return <Place />;
  if (appController.states.popUp.type === "matters")
    return <MatterPopUp />;
  if (appController.states.popUp.type === "group")
    return <GroupPopUp />;
  if (appController.states.popUp.type === "victory")
    return <Victory />;
  if (appController.states.popUp.type === "history")
    return <History />;

  return <></>;
}

export default PopUp;

export function LegalNotice({ commentaryData, showLegal }) {
  const appController = useAppController();
  const [markdown, setMarkdown] = useState(null);
  useEffect(() => {
    BoMOnlineAPI(
      {
        markdown: "access_notice",
        sourceUsage: {
          token: appController.states.user.token,
          source: commentaryData.publication.source_id,
        },
      },
      { useCache: ["markdown"] },
    ).then((result) => {
      let text = result.markdown.access_notice.markdown;
      if (typeof text.replace !== "function") {
        console.log({ result });
        return false;
      }
      let usage = result.sourceUsage[0];
      text = text.replace(
        "$1",
        appController.states.user.social?.nickname || label("guest"),
      );
      text = text.replace("$2", usage);
      text = text.replace(
        "$3",
        `${commentaryData.publication.source_title}; © ${commentaryData.publication.source_year} ${commentaryData.publication.source_name}; ${commentaryData.publication.source_publisher}`,
      );
      setMarkdown(text);
    });
  }, [showLegal]);

  if (appController.states.popUp.activeId !== commentaryData.id) return null;

  if (!markdown || !showLegal) return null;
  return (
    <div className={"notice"}>
      <ReactMarkdown linkTarget={"_blank"}>{markdown}</ReactMarkdown>
    </div>
  );
}

function Person() {

  const appController = useAppController();
  const [PopUpRef,setPopUpRef] = useState(null)

  if (
    appController.popUpData[appController.states.popUp.activeId] === undefined
  ) {
    BoMOnlineAPI(
      { person: appController.states.popUp.ids },
      { useCache: ["person"] },
    ).then((response) => {
      appController.functions.setPopUp({
        type: "people",
        ids: appController.states.popUp.ids,
        popUpData: response.person,
      });
      if (!response.person) return false;
      const person = response.person[appController.states.popUp.ids[0]];
      setPopUpRef(null);
      const slugs =
        person?.relations
          ?.filter((i) => i.person?.slug)
          .map((i) => i.person.slug) || [];
      BoMOnlineAPI({ person: slugs }, { useCache: ["person"] });
    });
    return <Loading type="Person" />;
  }

  let person = appController.popUpData[appController.states.popUp.activeId];
  if (person === undefined) return <pre>{appController.popUp}</pre>;
  if (person === null) {
    const activeId = appController.states.popUp.activeId;
    const list = appController.preLoad?.personList || [];
    // Shared with SSR via models/slugVariants — supersedes the old
    // `slug.startsWith(activeId)` rule, which also matched noahs-priests
    // under 'noah' and 13 slugs under 'nephi'.
    const resolution = resolveSlug(activeId, list.map((p) => p.slug));
    if (resolution.kind === "redirect" || resolution.kind === "exact") {
      appController.functions.setPopUp({ type: "people", ids: [resolution.slug], underSlug: "people" });
      return <Loading type="Person" />;
    }
    const candidates = (resolution.candidates || []).map(
      (slug) => list.find((p) => p.slug === slug) || { slug, name: slug, title: null },
    );
    return (
      <div id="popUp" className="card popupwindow" style={{ top: appController.states.popUp.top }}>
        <div className="card-header">
          <div className="person_head">{label("person_profile")}</div>
          <ul className="source_tabs souce_tab_list_0">
            <li className="close" onClick={appController.functions.closePopUp}>×</li>
          </ul>
        </div>
        <div className="card-body">
          <PersonChooser
            requested={activeId}
            candidates={candidates}
            onEntityClick={(slug) =>
              appController.functions.setPopUp({ type: "people", ids: [slug], underSlug: "people" })
            }
          />
        </div>
      </div>
    );
  }

  let ofs = {
    Possibly: " ",
    Preacher: "to",
    Teacher: "to",
    Mentioned: "by",
  };

  return (
    <>
      <Draggable handle=".card-header">
        <div
          id="popUp"
          className="card pp popupwindow"
          style={{
            top: appController.states.popUp.top,
            left: appController.states.popUp.left,
          }}
        >
          <div className="card-header">
            <div className="person_head">{label("person_profile")}</div>
            <ul
              className={
                "source_tabs souce_tab_list_" +
                appController.states.popUp.ids.length
              }
            >
              <li
                className="close"
                onClick={appController.functions.closePopUp}
              >
                ×
              </li>
            </ul>
          </div>
          <div className="card-body">
            <PersonBody
              data={person}
              setPopUpRef={setPopUpRef}
              PopUpRef={PopUpRef}
              onEntityClick={(id) =>
                appController.functions.setPopUp({ type: "people", ids: [id], underSlug: "people" })
              }
            />
          </div>
          <ScripturePanelSingle scriptureData={{ref:PopUpRef}} closeButton={true} setPopUpRef={setPopUpRef} />
          <Comments />
        </div>
      </Draggable>
    </>
  );
}



function Place() {

  const appController = useAppController();
  const [showOptions, setShowOptions] = useState(false);
  const [PopUpRef,setPopUpRef] = useState(null)
  const [showMapsDropDown, showMapsDropDownSet] = useState(false),
    { push } = useHistory();

  if (appController.popUpData[appController.states.popUp.activeId] === undefined) {
    BoMOnlineAPI({ places: appController.states.popUp.ids }).then(
      (response) => {
        appController.functions.setPopUp({
          type: "places",
          ids: appController.states.popUp.ids,
          popUpData: response.places,
        });
        setPopUpRef(null);
      },
    );
    return <Loading type="Place" />;
  }

  const onSelectMapType = (e, map, place) => {
    e.preventDefault();
    appController?.functions?.closePopUp();
    let event = new CustomEvent("handleMapChange");
    event.map = map;
    event.place = place;
    window.dispatchEvent(event);
    //
    push(`/map/${map}/place/${place}`);
  };
  
  let place = appController.popUpData[appController.states.popUp.activeId];
  if (place === undefined) return <pre>{appController.popUp}</pre>;
  if (place === null) {
    const activeId = appController.states.popUp.activeId;
    const candidates = (appController.preLoad?.placeList || [])
      .filter(p => p.slug.startsWith(activeId));
    if (candidates.length === 1) {
      appController.functions.setPopUp({ type: "places", ids: [candidates[0].slug], underSlug: "places" });
      return <Loading type="Place" />;
    }
    return (
      <div id="popUp" className="card popupwindow" style={{ top: appController.states.popUp.top, left: appController.states.popUp.left }}>
        <div className="card-header">
          <div className="place_head">{label("location_profile")}</div>
          <ul className="source_tabs souce_tab_list_0">
            <li className="close" onClick={appController.functions.closePopUp}>×</li>
          </ul>
        </div>
        <div className="card-body">
          <div className="ppbody" style={{ flexDirection: "column", gap: "0.5em" }}>
            {candidates.length > 1 ? candidates.map(c => (
              <div key={c.slug} className="related_row" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.75em", padding: "0.5em" }}
                onClick={() => appController.functions.setPopUp({ type: "places", ids: [c.slug], underSlug: "places" })}>
                <div className="related_avatar"><img src={`${assetUrl}/places/${c.slug}`} alt={c.name} /></div>
                <div><strong>{c.name}</strong>{c.info && <div><small>{c.info}</small></div>}</div>
              </div>
            )) : <div className="emptyState" style={{ padding: "2em", textAlign: "center" }}>{activeId}</div>}
          </div>
        </div>
      </div>
    );
  }
  //console.log(place.maps);
  return (
    <Draggable handle=".card-header">
      <div
        id="popUp"
        className="card pp popupwindow"
        style={{
          top: appController.states.popUp.top,
          left: appController.states.popUp.left,
        }}
      >
        <div className="card-header">
          <div className="place_head">{label("location_profile")}</div>
          <ul
            className={
              "source_tabs souce_tab_list_" +
              appController.states.popUp.ids.length
            }
          >
            <li className="close" onClick={appController.functions.closePopUp}>
              ×
            </li>
          </ul>
        </div>
        <div className="card-body">
          <div className="ppbody">
            <div className="bodytext">
              <h3>
                <span>
                  {Parser(
                    place.name
                      ? place.name.replace(/(\d+$)/, "<sup>$1</sup>")
                      : "",
                  )}
                </span>
                <br />
                <small className="ppbody-title">{place.info}</small>
              </h3>

              {renderPersonPlaceHTML(detectScripturesPreservingTokens(place.description, (scripture) => {
                  if (!scripture) return;
                  return `<a className="scripture_link">${scripture}</a>`
                }, determineLanguage()
              ), appController, setPopUpRef)}
            </div>

            <div className="refbox">
              <div className="ppimg">
              {place?.maps?.length > 0 ? (
                <Button 
                  onClick={(e) => {
                    if(place.maps.length > 1) {
                    setShowOptions(!showOptions)
                    } else {
                      onSelectMapType(e, place.maps[0].slug, place.slug)
                    }
                  }
                }
                >
                  {label("view_on_map")}
                </Button>
              ) : null}

              {showOptions && (
                place.maps.map((map, index) => (
                  <Button 
                    key={index} 
                    onClick={(e) => onSelectMapType(e, map.slug, place.slug)}
                  >
                    {map.name}
                  </Button>
                ))
              )}

                <EntityThumb type="places" slug={place.slug} name={place.name} rounded />
              </div>

              <XrelSection xrels={place?.xrels} />
              <ReferenceList
                index={place.index}
                setPopupRef={setPopUpRef}
              />
            </div>
          </div>
        </div>
          <ScripturePanelSingle scriptureData={{ref:PopUpRef}} closeButton={true} setPopUpRef={setPopUpRef} />
        <Comments />
      </div>
    </Draggable>
  );
}

function MatterPopUp() {
  const appController = useAppController();
  const [PopUpRef, setPopUpRef] = useState(null);
  const activeId = appController.states.popUp.activeId;
  const obj = appController.popUpData[activeId];

  // Bind the prose column (.bodytext) to the shared scroll: it rides along with
  // the reference column until its OWN bottom reaches the bottom of the popup,
  // then holds there while the reference column keeps scrolling — so no empty
  // space ever shows under it inside .ppbody. CSS sticky can't do this when the
  // prose is shorter than the viewport, so it's driven off .bodytext's height.
  const cardRef = useRef(null);
  const bodyRef = useRef(null);
  const ppRef = useRef(null);
  useEffect(() => {
    const cb = cardRef.current, bt = bodyRef.current;
    if (!cb || !bt) return undefined;
    // Native CSS sticky does the pinning (compositor → no scroll handler, no
    // jitter). We only set the sticky `top` offset = min(0, viewportH - proseH):
    //   short prose (fits the viewport) → 0, so it sits at the top and pins
    //     there naturally;
    //   prose taller than the viewport → negative offset, so it rides with the
    //     scroll until its bottom lands at the popup bottom, then pins.
    const measure = () => {
      bt.style.top = `${Math.min(0, cb.clientHeight - bt.offsetHeight)}px`;
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure); // re-measure as images / refs load in
    ro.observe(bt);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [obj]);

  if (obj === undefined) {
    BoMOnlineAPI(
      { matter: appController.states.popUp.ids },
      { useCache: ["matter"] }
    ).then((response) => {
      appController.functions.setPopUp({
        type: "matters",
        ids: appController.states.popUp.ids,
        popUpData: response.matter,
      });
      if (!response.matter) return false;
      const obj = response.matter[activeId];
      const siblingMatterSlugs = (obj?.xrels || [])
        .filter((x) => x.dst_type === "matter" && x.dst_slug)
        .map((x) => x.dst_slug);
      if (siblingMatterSlugs.length) {
        BoMOnlineAPI({ matter: siblingMatterSlugs }, { useCache: ["matter"] });
      }
      setPopUpRef(null);
    });
    return <Loading type="Matter" />;
  }

  if (obj === null) {
    const candidates = (appController.preLoad?.matterList || [])
      .filter(o => o.slug.startsWith(activeId));
    if (candidates.length === 1) {
      appController.functions.setPopUp({ type: "matters", ids: [candidates[0].slug], underSlug: "matters" });
      return <Loading type="Matter" />;
    }
    return (
      <div id="popUp" className="card popupwindow" style={{ top: appController.states.popUp.top, left: appController.states.popUp.left }}>
        <div className="card-header">
          <div className="person_head">{label("matter_profile") || "Matter"}</div>
          <ul className="source_tabs souce_tab_list_0">
            <li className="close" onClick={appController.functions.closePopUp}>×</li>
          </ul>
        </div>
        <div className="card-body">
          <div className="ppbody" style={{ flexDirection: "column", gap: "0.5em" }}>
            {candidates.length > 1 ? candidates.map(c => (
              <div key={c.slug} className="related_row" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.75em", padding: "0.5em" }}
                onClick={() => appController.functions.setPopUp({ type: "matters", ids: [c.slug], underSlug: "matters" })}>
                <div className="related_avatar"><img src={`${assetUrl}/matters/${c.slug}`} alt={c.name} /></div>
                <div><strong>{processName(c.name)}</strong>{c.subtitle && <div><small>{c.subtitle}</small></div>}</div>
              </div>
            )) : <div className="emptyState" style={{ padding: "2em", textAlign: "center" }}>{processName(activeId)}</div>}
          </div>
        </div>
      </div>
    );
  }
  if (!obj) return <pre>{appController.popUp}</pre>;

  return (
    <Draggable handle=".card-header">
      <div
        id="popUp"
        className="card pp popupwindow"
        style={{
          top: appController.states.popUp.top,
          left: appController.states.popUp.left,
        }}
      >
        <div className="card-header">
          <div className="person_head">{label("matter_profile") || "Matter"}</div>
          <ul className={"source_tabs souce_tab_list_" + appController.states.popUp.ids.length}>
            <li className="close" onClick={appController.functions.closePopUp}>
              ×
            </li>
          </ul>
        </div>
        <div className="card-body" ref={cardRef}>
          <div className="ppbody" ref={ppRef}>
            <div className="bodytext" ref={bodyRef}>
              <h3>
                {processName(obj.name)}
                {obj.subtitle && (
                  <>
                    <br />
                    <small className="ppbody-title">{replaceNumbers(obj.subtitle)}</small>
                  </>
                )}
              </h3>
              {renderPersonPlaceHTML(
                detectScripturesPreservingTokens(
                  obj.description || "",
                  (scripture) => scripture ? `<a className="scripture_link">${scripture}</a>` : "",
                  determineLanguage()
                ),
                appController,
                setPopUpRef
              )}
            </div>

            <div className="refbox">
              <div className="ppimg">
                <EntityThumb type="matters" slug={obj.slug} name={obj.name} rounded />
              </div>

              <XrelSection xrels={obj.xrels} showEmpty />

              <ReferenceList
                index={obj.index}
                setPopupRef={setPopUpRef}
              />
            </div>
          </div>
        </div>
        <ScripturePanelSingle scriptureData={{ ref: PopUpRef }} closeButton={true} setPopUpRef={setPopUpRef} />
        <Comments />
      </div>
    </Draggable>
  );
}

export function GroupPopUp() {
  const appController = useAppController();
  const activeId = appController.states.popUp.activeId;

  if (appController.popUpData[activeId] === undefined) {
    BoMOnlineAPI(
      { group: appController.states.popUp.ids },
      { useCache: ["group"] }
    ).then((response) => {
      // Unknown slugs come back filtered out (empty list), so pin each
      // requested id to null rather than leaving it undefined — undefined
      // would re-trigger this fetch on every render.
      const groups = response.group || {};
      const popUpData = {};
      for (const id of appController.states.popUp.ids) {
        popUpData[id] = groups[id] ?? null;
      }
      appController.functions.setPopUp({
        type: "group",
        ids: appController.states.popUp.ids,
        popUpData,
      });
    });
    return <Loading type="Group" />;
  }

  const group = appController.popUpData[activeId];
  const headerLabel =
    label("group_profile") === "group_profile" ? "Group Profile" : label("group_profile");

  if (!group) {
    return (
      <div id="popUp" className="card popupwindow" style={{ top: appController.states.popUp.top, left: appController.states.popUp.left }}>
        <div className="card-header">
          <div className="person_head">{headerLabel}</div>
          <ul className="source_tabs souce_tab_list_0">
            <li className="close" onClick={appController.functions.closePopUp}>×</li>
          </ul>
        </div>
        <div className="card-body">
          <div className="emptyState" style={{ padding: "2em", textAlign: "center" }}>Group not found</div>
        </div>
      </div>
    );
  }

  return (
    <Draggable handle=".card-header">
      <div
        id="popUp"
        className="card pp popupwindow"
        style={{
          top: appController.states.popUp.top,
          left: appController.states.popUp.left,
        }}
      >
        <div className="card-header">
          <div className="person_head">{headerLabel}</div>
          <ul className={"source_tabs souce_tab_list_" + appController.states.popUp.ids.length}>
            <li className="close" onClick={appController.functions.closePopUp}>
              ×
            </li>
          </ul>
        </div>
        <div className="card-body">
          <div className="ppbody">
            <div className="bodytext">
              <h3>{group.name}</h3>
              <XrelSection xrels={group.xrels} showEmpty />
            </div>
          </div>
        </div>
      </div>
    </Draggable>
  );
}

export const displayDate = (date) => {
  if (!date) return "";
  let len = date.length;
  return moment(date, [len === 4 ? "YYYY" : "YYYY-MM-DD"]).format(
    len === 4
      ? label("history_date_format_year")
      : label("history_date_format_full"),
  );
};

function History() {
  const appController = useAppController();
  const [doc, setData] = useState(null);

  let slug = appController.states.popUp.ids;

  useEffect(() => {
    document.title =
      doc?.document + " (" + doc?.source + ") | " + label("home_title");
  }, doc);

  useEffect(() => {
    setData(null);
    BoMOnlineAPI({ history: slug }).then((response) => {
      setData(response.history?.[slug]);

      let el = document.querySelector("#popUp .card-body");
      if (el) el.scrollTop = 0;
    });
  }, [slug]);

  if (!doc) return <Loading type="history" />;

  // Field-adaptive across all four archives (reception / translation / witnesses
  // / joseph-smith): every part renders only when its data is present, so a doc
  // missing a source, date, quote, teaser, or facsimile never shows a broken/
  // dangling element (cf. Home/tiles ArchiveDocTile's filtered-field approach).
  const rawDate = displayDate(doc.date);
  const dateText = rawDate && rawDate !== "Invalid date" ? rawDate : "";
  const metaParts = [...new Set([doc.source, doc.principal, doc.author, dateText].filter(Boolean))];
  const hasQuote = !!(doc.money_quote || doc.mini_quote);
  const teaserText = typeof doc.teaser === "string" ? doc.teaser : "";
  const strip = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
  const titleStripped = strip(doc.document);
  const teaserStripped = strip(teaserText);
  const quoteStripped = strip(doc.money_quote || doc.mini_quote);
  const transcriptStripped = strip(doc.transcript);
  const teaserDupesTitle = !!teaserStripped && teaserStripped === titleStripped;
  // Short statements (e.g. witnesses) store the same text as BOTH money_quote and
  // transcript — don't render it twice. Keep the transcript only when it adds
  // materially more than the quote (reception clippings: short quote, long text).
  const transcriptDupesQuote =
    !!quoteStripped && !!transcriptStripped &&
    (transcriptStripped === quoteStripped ||
      (transcriptStripped.includes(quoteStripped) &&
        transcriptStripped.length < quoteStripped.length * 1.15));
  const pageCount = Number(doc.pages) || 0;

  return (
    <div
      id="popUp"
      className="card popupwindow historycard"
      style={{
        top: appController.states.popUp.top,
        left: appController.states.popUp.left,
      }}
    >
      <div className="card-header">
        <ul className="source_tabs souce_tab_list_0">
          <li className="close" onClick={appController.functions.closePopUp}>
            ×
          </li>
        </ul>
        {metaParts.length ? (
          <div className="popupwindow_head">{metaParts.join(" • ")}</div>
        ) : null}
      </div>
      <div className="card-body">
        <div id="my-tab-content" className="tab-content">
          <div className="tab-pane active" id="home" role="tabpanel">
            {doc.document ? <h3>{doc.document}</h3> : null}

            {hasQuote ? (
              <blockquote className="historyPopupQuote">
                {doc.quote_speaker && !doc.quote_is_witness_voice ? (
                  <span className="historyPopupQuoteBy prefix">{doc.quote_speaker}:</span>
                ) : null}{" "}
                &ldquo;{doc.money_quote
                  ? renderMoneyQuote(doc.money_quote, doc.mini_quote)
                  : doc.mini_quote}&rdquo;
                {doc.quote_speaker && doc.quote_is_witness_voice ? (
                  <cite className="historyPopupQuoteBy">&mdash; {doc.quote_speaker}</cite>
                ) : null}
              </blockquote>
            ) : null}

            {teaserText && !teaserDupesTitle ? (
              <div className="teaser">{Parser(teaserText)}</div>
            ) : null}

            {doc.citation ? (
              <div className="historyPopupCitation">{Parser(String(doc.citation))}</div>
            ) : null}

            {doc.transcript && !transcriptDupesQuote ? (
              <div className="transcript">{Parser(doc.transcript)}</div>
            ) : null}

            {doc.id && pageCount > 0 ? (
              <div className="history_fax">
                {[...Array(pageCount).keys()].map((i) => (
                  <img
                    key={i}
                    src={`${assetUrl}/history/fax/${String(doc.id).padStart(4, "0")}.${String(i + 1).padStart(3, "0")}.jpg`}
                    alt={doc.document || ""}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <Comments
        pageController={appController.activeLeafCursorController}
        linkData={{ history: "slug" }}
      />
    </div>
  );
}

export function setPopDocTitle(popUpData, type) {
  if (!popUpData) return null;
  let title = null;

  title = processName(popUpData?.name) || popUpData?.title;

  //console.log(popUpData)
  const short = popUpData?.publication?.source_short || "";
  if (type === "commentary")
    title =
      (short && short + ": ") +
      popUpData.title +
      " • " +
      label("commentary_on_x", [popUpData.reference]);

  if (title) document.title = title + " | " + label("home_title");
}
