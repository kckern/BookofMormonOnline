import React, { useState, useEffect } from "react";
import Comments from "./Study/Study";
import { assetUrl } from "src/models/BoMOnlineAPI";
import Parser from "html-react-parser";
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

  const handleClick = (id, e) => {
    e.preventDefault();
    appController.functions.setPopUp({ type: "people", ids: [id] });
  };
  let person = appController.popUpData[appController.states.popUp.activeId];
  if (person === undefined) return <pre>{appController.popUp}</pre>;
  if (person === null) {
    const activeId = appController.states.popUp.activeId;
    const candidates = (appController.preLoad?.personList || [])
      .filter(p => p.slug.startsWith(activeId));
    if (candidates.length === 1) {
      appController.functions.setPopUp({ type: "people", ids: [candidates[0].slug], underSlug: "people" });
      return <Loading type="Person" />;
    }
    return (
      <div id="popUp" className="card popupwindow" style={{ top: appController.states.popUp.top }}>
        <div className="card-header">
          <div className="person_head">{label("person_profile")}</div>
          <ul className="source_tabs souce_tab_list_0">
            <li className="close" onClick={appController.functions.closePopUp}>×</li>
          </ul>
        </div>
        <div className="card-body">
          <div className="ppbody" style={{ flexDirection: "column", gap: "0.5em" }}>
            {candidates.length > 1 ? candidates.map(c => (
              <div key={c.slug} className="related_row" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.75em", padding: "0.5em" }}
                onClick={() => appController.functions.setPopUp({ type: "people", ids: [c.slug], underSlug: "people" })}>
                <div className="related_avatar"><img src={`${assetUrl}/people/${c.slug}`} alt={c.name} /></div>
                <div><strong>{processName(c.name)}</strong>{c.title && <div><small>{replaceNumbers(c.title)}</small></div>}</div>
              </div>
            )) : <div className="emptyState" style={{ padding: "2em", textAlign: "center" }}>{processName(activeId)}</div>}
          </div>
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
            <div className="ppbody">
              <div className="bodytext">
                <h3>
                  {processName(person.name)}
                  <br />
                  <small className="ppbody-title">
                    {replaceNumbers(person.title)}
                  </small>
                </h3>
                {renderPersonPlaceHTML(detectScripturesPreservingTokens(person.description, (scripture) => {
                  if (!scripture) return;
                  return `<a className="scripture_link">${scripture}</a>`
                }, determineLanguage()
              ), appController, setPopUpRef)}
              </div>

              <div className="refbox">
                <div className="ppimg">
                  <EntityThumb type="people" slug={person.slug} name={processName(person.name)} rounded />
                </div>

                <h4>{label("relationships")}</h4>
                <Relationships data={person?.relations} />
                <XrelSection xrels={person?.xrels} noHeading />
                <ReferenceList
                  index={person.index}
                  setPopupRef={setPopUpRef}
                />
              </div>
            </div>
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

  if (appController.popUpData[activeId] === undefined) {
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

  const obj = appController.popUpData[activeId];
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
        <div className="card-body">
          <div className="ppbody">
            <div className="bodytext">
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

function Relationships({ data }) {
  const appController = useAppController();
  const personRow = (person, i) => {
    //determine split
    const namePosition = person.relation.indexOf("$1") ? "back" : "front";
    const StringwithSplitMarker = namePosition === "front" ?
      person.relation.replace(/(\$1\S+)/, "$1•")
    : person.relation.replace("$1", "•$1");

    const replaceWithLink = (text) => {
      //split by $1, keep delimiter
      if (!text.includes("$1")) return text;
      const pieces = text.split(/(\$1)/);
      if (pieces.length === 1) return text;
      return pieces.map((piece, i) => {
        if (piece === "$1") {
          return  <span key={i} className="nameLink">{person.person.name.replace(/\d+/, "")}</span>
        }
        return piece;
      });
    }
    const rows = StringwithSplitMarker.split("•").map(replaceWithLink).filter(i=>!!i);
    const items = [
      <div key={`${i}_0`} className="related_text_top">{rows[0]}</div>,
      <div key={`${i}_1`} className="related_text_bottom">{rows[1]}</div>
    ];

    const personTitle = person.person.title;

    return (
      <div
        key={i}
        className="related_row"
        data-for="relToolTip"
        data-tip={`${personTitle}`}
      >
        <div
          style={{display:"flex"}}
          onClick={()=>{
            appController.functions.setPopUp({ type: "people", ids: [person.person.slug],
              underSlug: "people", });
          }}
        >
          <div className="related_text">
            {items}
          </div>

          <div className="related_avatar">
            <img src={`${assetUrl}/people/${person.person.slug}`} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="related_people noselect">
      <ReactTooltip 
        id="relToolTip" 
        place="left" 
        offset={{'bottom': 0, 'left': '10rem'}} 
        effect="solid" 
        backgroundColor={"#666"} 
        arrowColor={"#666"} 
      />      
      {data?.map((relation, i) => personRow(relation, i))}
    </div>
  );
}

function ReferenceList({ index, setPopupRef }) {
  setPopupRef || (setPopupRef = ()=>{})
  return (
    <>
      <h4>{label("references")}</h4>
      <ol className="reference-list">
        {index &&
          index.map((reference, i) => (
            <li key={i}>
              <a
                className="ppref"
                onClick={()=>setPopupRef(reference.ref)}
                data-tip={reference.ref}
              >
                {replaceNumbers(reference.text)}
              </a>
            </li>
          ))}
      </ol>
      <ReactTooltip
        place="left"
        offset={{'bottom': 0, 'left': '10rem'}}
        effect="solid"
        backgroundColor={"#666"}
        arrowColor={"#666"}
      />
    </>
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
        <ul className={"source_tabs souce_tab_list_" + 0}>
          <li className="close" onClick={appController.functions.closePopUp}>
            ×
          </li>
        </ul>
        <div className="popupwindow_head">
          {doc.source} <span>• {displayDate(doc.date)}</span>
        </div>
      </div>
      <div className="card-body">
        <div id="my-tab-content" className="tab-content ">
          <div className="tab-pane active " id="home" role="tabpanel">
            <h3>{doc.document}</h3>
            <div className="teaser"> {Parser(doc.teaser)}</div>
            <div className="transcript"> {Parser(doc.transcript)}</div>

            <div className="history_fax">
              {[...Array(doc.pages).keys()].map((i) => {
                return (
                  <img src={`${assetUrl}/history/fax/${String(doc.id).padStart(4, '0')}.${String(i + 1).padStart(3, '0')}.jpg`} />                );
              })}
            </div>
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
