import React, { useState, useEffect } from "react";
import Comments from "./Study/Study";
import { assetUrl } from 'src/models/BoMOnlineAPI';
import Parser from "html-react-parser";
import Draggable from "react-draggable";
import { renderPersonPlaceHTML } from "../Page/PersonPlace";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import ReactTooltip from "react-tooltip";
import { Link, useHistory } from "react-router-dom";
import { Victory } from "src/views/User/Victory"
import moment from 'moment';
import "./PopUp.css";
import {
  snapSelectionToWord,
  replaceNumbers,
  processName,
  label,
  log,
  isMobile,
} from "src/models/Utils";
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from "reactstrap";
import ReactMarkdown from "react-markdown";
import Loader, { Spinner } from "./Loader";
import { MobileDrawer } from "./Drawer";
import { addHighlightTagSelectively } from "../Page/TextContent";
import Commentary from "./Commentary";

export function Loading({ type, appController, callingAPI }) {
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
        <div className="popupwindow_head">{label("loading_x", [label(type.toLowerCase())])}</div>
      </div>
      <div className="card-body">
        <div id="my-tab-content" className="tab-content ">
          <div className="tab-pane active loading" id="home" role="tabpanel">
            <Spinner top={"10em"}/>
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

function PopUp({ appController }) {
  // if (appController.states.popUp.open !== true) return (<></>);
  const [currentKeyVal,setCurrentKeyVal] = useState(null);
  useEffect(()=>{
    const key = appController.states.popUp.type;
    const val = Array.isArray(appController.states.popUp.activeId) ? appController.states.popUp.activeId.shift() : appController.states.popUp.activeId;
    if(!key || !val || currentKeyVal===`${key}.${val}`  ) return false;
    log({appController,key,val});
    setCurrentKeyVal(`${key}.${val}`);
  },[appController.states.popUp.type,appController.states.popUp.activeId])
  if (!appController.popUpData) appController.popUpData = {};

  if(isMobile()) return <MobileDrawer appController={appController} />
  if (!appController.states.popUp.open) return null;
 

  if (appController.states.popUp.type === "commentary")
    return <Commentary appController={appController} />;
  if (appController.states.popUp.type === "people")
    return <Person appController={appController} />;
  if (appController.states.popUp.type === "places" || appController.states.popUp.type === "place")
    return <Place appController={appController} />;
  if (appController.states.popUp.type === "victory")
    return <Victory appController={appController} />;
  if (appController.states.popUp.type === "history")
    return <History appController={appController} />;

  return <></>;
}

export default PopUp;



export function LegalNotice({ appController, commentaryData, showLegal }) {
  const [markdown, setMarkdown] = useState(null);
  useEffect(() => {
    BoMOnlineAPI({
      markdown: "access_notice",
      sourceUsage: {
        token: appController.states.user.token,
        source: commentaryData.publication.source_id
      }
    },
      { useCache: ["markdown"] })
      .then(result => {
        let text = result.markdown.access_notice.markdown;
        if(typeof text.replace !== "function"){
          console.log({result});
          return false;
        } 
        let usage = result.sourceUsage[0];
        text = text.replace("$1",appController.states.user.social?.nickname || label("guest"));
        text = text.replace("$2",usage);
        text = text.replace("$3",`${commentaryData.publication.source_title}; © ${commentaryData.publication.source_year} ${commentaryData.publication.source_name}; ${commentaryData.publication.source_publisher}`);
        setMarkdown(text);

      })
  }, [showLegal]);

  if(appController.states.popUp.activeId !== commentaryData.id) return null;


  if (!markdown || !showLegal) return null;
  return <div className={"notice"}><ReactMarkdown linkTarget={'_blank'}>{markdown}</ReactMarkdown></div>
}


function Person({ appController }) {
  if (
    appController.popUpData[appController.states.popUp.activeId] === undefined
  ) {
    BoMOnlineAPI({ person: appController.states.popUp.ids }).then(
      (response) => {
        appController.functions.setPopUp({
          type: "people",
          ids: appController.states.popUp.ids,
          popUpData: response.person,
        });
      }
    );
    return <Loading type="Person" appController={appController} />;
  }

  const handleClick = (id, e) => {
    e.preventDefault();
    appController.functions.setPopUp({ type: "people", ids: [id] });
  };
  let person = appController.popUpData[appController.states.popUp.activeId];
  if (person === undefined) return <pre>{appController.popUp}</pre>;

  let ofs = {
    Possibly: " ",
    Preacher: "to",
    Teacher: "to",
    Mentioned: "by",
  };

  return (
    <>
      <Draggable handle=".person_head">
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
              <h3>
                {processName(person.name)}
                <br />
                <small className="ppbody-title">
                  {replaceNumbers(person.title)}
                </small>
              </h3>
              <div className="refbox">
                <h4>{label("relationships")}</h4>
                <table className="refbox-tabel">
                  <tbody>
                    {person.relations &&
                      person.relations.map((relation, index) => (
                        <tr key={index}>
                          <td className="refbox-relation">
                            {relation.relation}
                          </td>
                          <td className="refbox-relation-of">
                            {ofs[relation.relation] || "of"}
                          </td>
                          <td className="refbox-related">
                            {relation.person && (
                              <Link
                                onClick={(e) =>
                                  handleClick(relation.person.slug, e)
                                }
                                className="ppref"
                                to={`people/${relation.person.slug}`}
                                data-tip={replaceNumbers(relation.person.title)}
                                data-offset="{'left': 0}"
                                data-place="top"
                                effect="solid"
                              >
                                {processName(relation.person.name)}
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <ReferenceList
                  index={person.index}
                  appController={appController}
                />
              </div>
              <div className="ppimg">
                <img alt="reload" src={`${assetUrl}/people/${person.slug}`} />
                <br />
              </div>
              <div className="bodytext">
                {renderPersonPlaceHTML(person.description, appController)}
              </div>
            </div>
          </div>

          <Comments />
        </div>
      </Draggable>
    </>
  );
}

function Place({ appController }) {

  const [showMapsDropDown, showMapsDropDownSet] = useState(false),
    { push } = useHistory();

  if (!appController.popUpData[appController.states.popUp.activeId]) {
    BoMOnlineAPI({ places: appController.states.popUp.ids }).then(
      (response) => {
        appController.functions.setPopUp({
          type: "places",
          ids: appController.states.popUp.ids,
          popUpData: response.places,
        });
      }
    );
    return <Loading type="Place" appController={appController} />;
  }

  const onSelectMapType = (e, map, place) => {
    e.preventDefault()
    appController?.functions?.closePopUp()
    let event = new CustomEvent("handleMapChange");
    event.map = map;
    event.place = place;
    window.dispatchEvent(event);
    // 
    push(`/map/${map}/place/${place}`)
  };

  let place = appController.popUpData[appController.states.popUp.activeId];
  if (place === undefined) return <pre>{appController.popUp}</pre>;

  return (
    <Draggable handle=".place_head">
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
            <h3>
              <span>
                {Parser(
                  place.name
                    ? place.name.replace(/(\d+$)/, "<sup>$1</sup>")
                    : ""
                )}
              </span>
              <br />
              <small className="ppbody-title">{place.info}</small>
            </h3>
            <div className="refbox">
              <ReferenceList
                index={place.index}
                appController={appController}
              />
            </div>
            <div className="ppimg">
              <img alt="reload" src={`${assetUrl}/places/${place.slug}`} />
              <br />
              <br />
              {place?.maps?.length > 1 ? (
                <Dropdown isOpen={showMapsDropDown} toggle={() => showMapsDropDownSet(!showMapsDropDown)} direction="right">
                  <DropdownToggle>
                    {label("view_on_map")}
                  </DropdownToggle>
                  <DropdownMenu>
                    {place.maps.map((map, index) => <DropdownItem key={index} header>
                      <Link onClick={(e) => onSelectMapType(e, map.slug, place.slug)}>🌎 {map.name}</Link>
                    </DropdownItem>)}
                  </DropdownMenu>
                </Dropdown>
              ) : (
                place?.maps?.length === 1 && (
                  <Link to={`/map/neareast/place/${place.slug}`} onClick={(e) => onSelectMapType(e, 'neareast', place.slug)}>
                    <Button
                      className="map-dropdown"
                    >
                      {label("view_on_map")}
                    </Button></Link>
                )
              )}
            </div>

            <div className="bodytext">
              {renderPersonPlaceHTML(place.description, appController)}
            </div>
          </div>
        </div>
        <Comments />
      </div>
    </Draggable>
  );
}

function ReferenceList({ index, appController }) {
  return (
    <>
      <h4>{label("references")}</h4>
      <ol className="reference-list">
        {index &&
          index.map((reference, i) => (
            <li key={i}>
              <Link
                className="ppref"
                onClick={appController.functions.closePopUp}
                to={`/${reference.slug}`}
                data-tip={reference.ref}
              >
                {replaceNumbers(reference.text)}
              </Link>
            </li>
          ))}
      </ol>
      <ReactTooltip
        place="left"
        offset="{'bottom': 0, 'left': '10rem'}"
        effect="solid"
        backgroundColor={"#666"}
        arrowColor={"#666"}
      />
    </>
  );
}



export const displayDate = (date) => {
  let len = date.length;
  return moment(date, [(len === 4) ? "YYYY" : 'YYYY-MM-DD']).format((len === 4) ? label("history_date_format_year") : label("history_date_format_full"))
}


function History({ appController }) {

  const [doc, setData] = useState(null);

  let slug = appController.states.popUp.ids;

  useEffect(()=>{
    document.title = doc?.document + " (" + doc?.source + ") | " + label("home_title");
  },doc)

  useEffect(() => {
    setData(null);
    BoMOnlineAPI({ history: slug }).then((response) => {
      setData(response.history?.[slug]);

      let el = document.querySelector("#popUp .card-body");
      if (el) el.scrollTop = 0;
    });
  }, [slug])

  if (!doc) return <Loading appController={appController} type="history" />



  return <div
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
      <div className="popupwindow_head">{doc.source} <span>• {displayDate(doc.date)}</span></div>
    </div>
    <div className="card-body">
      <div id="my-tab-content" className="tab-content ">
        <div className="tab-pane active " id="home" role="tabpanel">
          <h3>{doc.document}</h3>
          <div className="transcript"> {Parser(doc.transcript)}</div>

          <div className='history_fax'>{[...Array(doc.pages).keys()].map(i => {
            return <img src={`${assetUrl}/history/fax/${doc.id}.${i + 1}`} />
          })}</div>

        </div>
      </div>
    </div>
    <Comments
      pageController={appController.activePageController}
      linkData={{ history: "slug" }}
    />
  </div>

}


export function setPopDocTitle(popUpData,type)
{
  if(!popUpData) return null;
  let title = null;
  
  title = processName(popUpData?.name) || popUpData?.title;

  //console.log(popUpData)
  const short = popUpData?.publication?.source_short || "";
  if(type==="commentary")  title = ( short && short + ": " ) + popUpData.title + " • " + label("commentary_on_x", [popUpData.reference]);
  

  if(title) document.title  = title + " | " + label("home_title");

}