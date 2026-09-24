import React, { useState, useEffect, useRef } from "react";
import Comments from "./Study/Study";
import Draggable from "react-draggable";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { Link, useHistory } from "react-router-dom";
import { Victory } from "src/views/User/Victory";
import XrelSection from "./XrelSection";
import "./PopUp.css";
import { processName, label, log, isMobile } from "src/models/Utils";
import ReactMarkdown from "react-markdown";
import Loader, { Spinner } from "./Loader";
import { MobileDrawer } from "./Drawer";
import { addHighlightTagSelectively } from "../Page/TextContent";
import Commentary from "./Commentary";
import { ScripturePanelSingle } from "../Page/Narration";
import { useAppController } from "src/contexts/AppControllerContext";
import { resolveSlug } from "src/models/slugVariants";
import MaximizeButton from "./entity/MaximizeButton";
import PersonBody, { PersonChooser } from "./entity/PersonBody";
import PlaceBody, { PlaceChooser } from "./entity/PlaceBody";
import MatterBody, { MatterChooser } from "./entity/MatterBody";
import HistoryBody, { historyMeta } from "./entity/HistoryBody";

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
              <MaximizeButton type={appController.states.popUp.type} />
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
    const list = appController.preLoad?.placeList || [];
    // Shared with SSR via models/slugVariants — see the person branch above.
    const resolution = resolveSlug(activeId, list.map((pl) => pl.slug));
    if (resolution.kind === "redirect" || resolution.kind === "exact") {
      appController.functions.setPopUp({ type: "places", ids: [resolution.slug], underSlug: "places" });
      return <Loading type="Place" />;
    }
    const candidates = (resolution.candidates || []).map(
      (slug) => list.find((pl) => pl.slug === slug) || { slug, name: slug, info: null },
    );
    return (
      <div id="popUp" className="card popupwindow" style={{ top: appController.states.popUp.top, left: appController.states.popUp.left }}>
        <div className="card-header">
          <div className="place_head">{label("location_profile")}</div>
          <ul className="source_tabs souce_tab_list_0">
            <li className="close" onClick={appController.functions.closePopUp}>×</li>
          </ul>
        </div>
        <div className="card-body">
          <PlaceChooser
            requested={activeId}
            candidates={candidates}
            onEntityClick={(slug) =>
              appController.functions.setPopUp({ type: "places", ids: [slug], underSlug: "places" })
            }
          />
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
            <MaximizeButton type={appController.states.popUp.type} />
            <li className="close" onClick={appController.functions.closePopUp}>
              ×
            </li>
          </ul>
        </div>
        <div className="card-body">
          <PlaceBody
            data={place}
            setPopUpRef={setPopUpRef}
            onMapClick={onSelectMapType}
          />
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
    const list = appController.preLoad?.matterList || [];
    // Shared with SSR via models/slugVariants — see the person branch above.
    const resolution = resolveSlug(activeId, list.map((o) => o.slug));
    if (resolution.kind === "redirect" || resolution.kind === "exact") {
      appController.functions.setPopUp({ type: "matters", ids: [resolution.slug], underSlug: "matters" });
      return <Loading type="Matter" />;
    }
    const candidates = (resolution.candidates || []).map(
      (slug) => list.find((o) => o.slug === slug) || { slug, name: slug, subtitle: null },
    );
    return (
      <div id="popUp" className="card popupwindow" style={{ top: appController.states.popUp.top, left: appController.states.popUp.left }}>
        <div className="card-header">
          <div className="person_head">{label("matter_profile") || "Matter"}</div>
          <ul className="source_tabs souce_tab_list_0">
            <li className="close" onClick={appController.functions.closePopUp}>×</li>
          </ul>
        </div>
        <div className="card-body">
          <MatterChooser
            requested={activeId}
            candidates={candidates}
            onEntityClick={(slug) =>
              appController.functions.setPopUp({ type: "matters", ids: [slug], underSlug: "matters" })
            }
          />
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
            <MaximizeButton type={appController.states.popUp.type} />
            <li className="close" onClick={appController.functions.closePopUp}>
              ×
            </li>
          </ul>
        </div>
        <div className="card-body" ref={cardRef}>
          <MatterBody
            data={obj}
            setPopUpRef={setPopUpRef}
            ppRef={ppRef}
            bodyRef={bodyRef}
          />
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

// Re-exported from entity/displayDate so existing importers (Drawer.js) keep
// working after the move. See that file for why it moved.
export { displayDate } from "./entity/displayDate";

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

  // The field-adaptive locals moved into entity/HistoryBody with the markup that
  // consumes them; the header below needs the same meta line, so it comes from
  // the helper the body exports.
  const metaParts = historyMeta(doc);

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
          <MaximizeButton type={appController.states.popUp.type} />
          <li className="close" onClick={appController.functions.closePopUp}>
            ×
          </li>
        </ul>
        {metaParts.length ? (
          <div className="popupwindow_head">{metaParts.join(" • ")}</div>
        ) : null}
      </div>
      <div className="card-body">
      <HistoryBody data={doc} />
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
