
import Parser from "html-react-parser";
import React, { useEffect, useRef, useState } from "react";
import { useHistory } from 'react-router';
import spinner from "../_Common/svg/loadbar.svg";
import placesIcon from "../_Common/svg/places.svg";
// AACTION TYPES
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
// CSS
import { getDistance } from 'geolib';
import { isMobile } from "src/models/Utils";
import searchIcon from "../_Common/svg/search.svg";
import "./Map.css";

import axios from "axios";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Nav,
  NavItem,
  TabContent,
  TabPane
} from "reactstrap";
import { detectScriptures, generateReference } from "scripture-guide";
import { determineLanguage } from "../../models/Utils";
import { ApiBaseUrl, assetUrl } from "../../models/BoMOnlineAPI";
import { ScripturePanelSingle } from "../Page/Narration";
import { getHtmlScriptureLinkParserOptions } from "../_Common/ViewUtils";
import RangeSlider from "./RangeSlider";
import { computeRuns, colorForRun, buildPanelItems } from './colors';

const metersToMiles = (meters) => Math.round(meters * 0.000621371192 * 1) / 1;


export function getPlaceInfo(slug, appController) {
    const keys = Object.keys(appController.preLoad.placeList || {});
    const key = keys.find((key) => appController.preLoad.placeList[key].slug === slug);
    return key ? appController.preLoad.placeList[key] : {};
  }

export function MapPanel({mapController}) {
  const [activeTab, setActiveTab] = useState("1");
  const [scripture, setScripture] = useState(null);
  const parserOptions = getHtmlScriptureLinkParserOptions(setScripture);
  const [prevMapType, setPrevMapType] = useState(null);
  const {panelContents, zoomLevel, currentMap, mapCenter, setPanelContents,mapFunctions, isAdmin, placeList, selectedStory, setSelectedStory} = mapController;
  const {slug} = panelContents || {};
  const placeInfo = getPlaceInfo(slug, mapController.appController);
  const title = placeInfo?.name;
  const info = placeInfo?.info;
  const {places} = currentMap || {};
  const [place, setPlace] = useState(places?.find((place) => place.slug === slug));
  const [placeDetails, setPlaceDetails] = useState({});

	const history = useHistory();

  useEffect(() => {
    // First useEffect logic
    if (!slug || !currentMap) return;
    setPlace(currentMap.places?.find((place) => place.slug === slug));

    if (selectedStory && !selectedStory.moves.some((move) => move.startPlace.slug === slug || move.endPlace.slug === slug)) {
        setSelectedStory(null);
    }

    // Second useEffect logic
    const panel = document.querySelector('.mapPanel');
    setScripture(null);
    if (panel) panel.scrollTop = 0;
    const mapSlug = mapController.currentMap?.slug;
    if (!mapSlug) return;
    // When the URL points at a story, the story URL is canonical — don't
    // overwrite it with the place URL here.
    const onStoryUrl = !!mapController.storySlug;
    if (slug) {
        if (!onStoryUrl) {
          mapController.appController.functions.setSlug(`/map/${mapSlug}/place/${slug}`);
        }
        setPlaceDetails({});
        BoMOnlineAPI({ places: [slug] }, { useCache: false }).then((result) => {
            setPlaceDetails(result?.places?.[slug] || {});
        });
    } else if (!onStoryUrl) {
        mapController.appController.functions.setSlug(`/map/${mapSlug}`);
    }
  }, [slug, currentMap?.slug, selectedStory, mapController.storySlug]);

  useEffect(() => {
    const urlStorySlug = mapController.storySlug;
    if (!currentMap?.stories) return;
    if (!urlStorySlug) {
      if (selectedStory) setSelectedStory(null);
      return;
    }
    const story = currentMap.stories.find((s) => s.slug === urlStorySlug);
    if (!story) {
      if (selectedStory) setSelectedStory(null);
      return;
    }
    if (selectedStory?.slug !== story.slug) setSelectedStory(story);
    if (!slug) {
      const firstMoveSlug = story.moves?.[0]?.startPlace?.slug;
      if (firstMoveSlug) setPanelContents({ slug: firstMoveSlug });
    }
    // Auto-add /move/1 to the URL so the seq is always explicit.
    if (mapController.moveSeq == null && story.moves?.length) {
      const firstSeq = story.moves[0]?.seq;
      if (firstSeq != null) {
        history.replace(`/map/${currentMap?.slug}/story/${story.slug}/move/${firstSeq}`);
      }
    }
  }, [mapController.storySlug, currentMap?.slug, currentMap?.stories?.length]);


  const index = placeDetails?.index || [];
  const maps = placeDetails?.maps || [];

  let desc_with_scripturelinks =  placeDetails?.description;


    desc_with_scripturelinks = detectScriptures(
    placeDetails?.description || "",
    (scripture) => { if (!scripture) return;
       return `<a className="scripture_link">${scripture}</a>` }
       , determineLanguage()
       );


       const matchingStories = currentMap?.stories?.filter((story) => story.moves.some((move) => move.startPlace.slug === slug || move.endPlace.slug === slug)) || [];

  const storyCount = matchingStories.length;

  const  body = !placeDetails?.description ?  <div className='noselect' style={{display : "flex", justifycontent: "center"}}>
    <img  src={spinner} alt="loading"  style={{ height: "10rem" }} />
    </div> : <><Nav tabs className="noselect">
    <NavItem onClick={() => setActiveTab("1")} className={activeTab === "1" ? "active" : ""}>
      <img src={placesIcon} alt="places" style={{filter: "invert(1)", opacity: 0.5}} />
      <div>Description</div>
    </NavItem>
    {!!storyCount && <NavItem onClick={() =>{
        if(storyCount===1) {
            const firstAndOnlyStory = matchingStories[0];
            history.push(`/map/${currentMap?.slug}/story/${firstAndOnlyStory.slug}`);
        }else setActiveTab("2")
        }} className={activeTab === "2" ? "active" : ""}>
      <div><span className="counter">{storyCount}</span></div>
      <div>Events</div>
    </NavItem>}

    <NavItem onClick={() => setActiveTab("4")} className={activeTab === "4" ? "active" : ""}>
      <div><span className="counter">{placeDetails.index?.length || 0}</span></div>
      <div>References</div>
    </NavItem>
</Nav>
<TabContent activeTab={activeTab}>
    <TabPane tabId="1">
        <div className="desc">{Parser(desc_with_scripturelinks, parserOptions)}</div>
    </TabPane>
    <TabPane tabId="2">
    {matchingStories.map((story, i) => {
    return <div key={i} className="map_story" onClick={()=>{
        history.push(`/map/${currentMap?.slug}/story/${story.slug}`);
        }}>
            <h6>{story.title}</h6>
            <p>{story.description}</p>
        </div>
    })}
    </TabPane>
    <TabPane tabId="3" className="viscinity">
        {["jerusalem-1","zarahemla","land-bountiful","bountiful"].map((place_slug, i) => {
          // get more info
            return <div key={i} className="viscinity_place" onClick={()=>{


                mapController.setPanelContents({slug: place_slug});
                setActiveTab("1");
                mapFunctions.selectPlace("midian");

            }}>
                <img src={`${assetUrl}/places/${place_slug}`} alt={place_slug} />
                <p>{getPlaceInfo(place_slug, mapController.appController).name}</p>
            </div>
        })}
    </TabPane>
    <TabPane tabId="4">
        <table className="place_refs">
            <tbody>
                {index.map((item, i) => {
                    return <tr key={i}>
                        <td className="ref">
                          <a onClick={()=>
                            setScripture(item.ref)
                          } className="scripture_link">
                          {item.ref}
                          </a>
                          </td>
                        <td>{["1","2","3","4"].reduce((a, e, i) =>
                          a.replace(new RegExp(e, "g"), ["¹","²","³","⁴"][i]), item.text)}</td>
                        </tr>
                })}
            </tbody>
        </table>
    </TabPane>
</TabContent>
    </>
const [[minZoom,maxZoom],setMinMaxZoom] = useState([place?.minZoom,place?.maxZoom]);
useEffect(()=>{setMinMaxZoom([place?.minZoom,place?.maxZoom])},[place?.minZoom,place?.maxZoom]);

const preloadedPlace = Object.values(placeList||{}).find((place)=>place.slug === slug) || null;

useEffect(()=>{
  if(!preloadedPlace) return false;
  const isOutOfMapScope = (currentMap?.slug === "neareast") !== (preloadedPlace?.location === "W");
  if(!isOutOfMapScope) return false;
  // TODO: prevMapType is not being set correctly
  const dstMap = currentMap?.slug === "neareast" ? (prevMapType || "internal") : "neareast";
  if(dstMap !== "neareast") setPrevMapType(dstMap);
   mapController.getMap(dstMap,slug)
},[preloadedPlace?.location]);

useEffect(()=>{
  const isOutOfMapScope = (currentMap?.slug === "neareast") !== (preloadedPlace?.location === "W");
  if(!isOutOfMapScope) return false;
  //clear panel setPanelContents(false);
},[currentMap?.slug])


if(selectedStory) return <MapStoryPanel mapController={mapController}  />


const zoomRange = currentMap?.maxzoom - currentMap?.minzoom;


const clearCache = (slug)=>{
  let databaseName = "BoMCache";
  var request = indexedDB.open(databaseName, 1);
  request.onsuccess = function (event) {
    var db = event.target.result;
    var transaction = db.transaction(["items"], "readwrite");
    var objectStore = transaction.objectStore("items");
    //delete entire store
    objectStore.clear();
    mapController.setCurrentMap("neareast");
    //clear panel

		if(slug){
			setTimeout(()=>{
				mapController.getMap(currentMap?.slug)
				mapController.setPanelContents({slug});
			},1000);
		}
  }

}

const savePointConfig = () => {

  const button = document.querySelector("#saveButton");
  //saving...
  button.innerHTML = "Saving...";



  const data = {
    name: document.querySelector("#placeName")?.value,
    label: document.querySelector("#placeLabel")?.value,
    min:minZoom,
    max:maxZoom,
    map:currentMap?.slug,
    zoom:Math.round(zoomLevel),
    slug
  }

  if(!data.name) delete data.name;
  if(!data.label) delete data.label;
  if(!data.min) delete data.min;
  if(!data.max) delete data.max;
  if(!data.zoom) delete data.zoom;


  const token = mapController.appController.states.user.token;
  var options = {
    method: 'POST',
    url: `${ApiBaseUrl}/coords`,
    headers: {'Content-Type': 'application/json', token},
    data
  };
  axios.request(options).then(function (response) {
    button.innerHTML = "Saved";
    clearCache();

    setTimeout(()=>{button.innerHTML = "Save"},2000);
    //redraw map
    mapController.getMap(null,null);
		setTimeout(()=>{
			mapController.getMap(currentMap?.slug,response.data.items.slug)
			mapController.setPanelContents({slug:response.data.items.slug});
		},1000)

  }).catch(function (error) {
    console.error(error);
    button.innerHTML = "Error";
  });
}

const addNewPlace = () => {

  const {minzoom,maxzoom} = currentMap;
  const token = mapController.appController.states.user.token;

  const data = {
    lat: mapCenter.lat,
    lng: mapCenter.lng,
    zoom: Math.round(minzoom+1),
    min: minzoom,
    max: maxzoom,
    map: currentMap?.slug,
    slug
  }

  const config = {
    method: 'POST',
    url: `${ApiBaseUrl}/coords`,
    headers: {'Content-Type': 'application/json', token},
    data
  };

  axios.request(config).then(function (response) {
		clearCache();
    mapController.getMap(null,null);
    setTimeout(()=>{
			mapController.getMap(currentMap?.slug,response.data.items.slug)
			mapController.setPanelContents({slug:response.data.items.slug});
		},100);
  }).catch(function (error) {
    console.error(error);
  });

}

const adminPanel = isAdmin ? place ? <Card className="adminPanel" onKeyDown={(e)=>{if(e.key === "Enter") savePointConfig()}}>

    <CardBody>
    <div className="grid-container">
      <div className="grid-item">
        <label>Place Name</label>
        <input type="text" defaultValue={title} id="placeName"  key={title} />
      </div>
      <div className="grid-item">
        <label>Place Label</label>
        <input defaultValue={place.label} id="placeLabel" type="text" key={place.label} />
      </div>
    </div>
  </CardBody>
  {!!zoomRange && (<><CardHeader>
    <h6 className="title">Zoom Levels
    (Current: <code>{Math.round(zoomLevel)}</code>)
    </h6>
  </CardHeader>
  <CardBody>
    {/* 3 columns: Current, min max: 1. read only input, 2 and 3 dropdowns 3-9*/}
    <div className="zoomLevels" style={{display: "flex", justifyContent: "space-between", gap: "1rem"}}>


{minZoom && (
  <div
    style={{display: "flex", flexDirection: "column-reverse", justifycontent: "space-between", flexGrow: 1}}
    className="rangeSliderContainer"
  >
    <RangeSlider
      min={currentMap?.minzoom}
      max={currentMap?.maxzoom}
      step={1}
      value={{ min: minZoom, max:maxZoom }}
      onChange={value => setMinMaxZoom([value.min,value.max])}
    />
    <div className="minMax" style={{display: "flex", justifycontent: "space-between",marginBottom:"1ex"}}>
      {Array.from({length: currentMap?.maxzoom - currentMap?.minzoom + 1}, (_, i) => currentMap?.minzoom + i).map((zoomLevelLabel) => (
        <span
          key={zoomLevelLabel}
          className={`
            ${zoomLevelLabel === minZoom || zoomLevelLabel === maxZoom ? 'selected' : ''}
            ${zoomLevelLabel === Math.round(zoomLevel) ? 'current' : ''}
          `}
        >
          {zoomLevelLabel}
        </span>
      ))}
    </div>
  </div>

)}
    </div>
  </CardBody></>)}
  <CardFooter style={{ display: 'flex', justifycontent: 'flex-end' }}>

    <Button id="saveButton"
      onClick={savePointConfig}
    >Save</Button>
  </CardFooter>
</Card> :  <><Button
      disabled={!mapController.panelContents.slug || !mapCenter.lat || !mapCenter.lng}
      onClick={addNewPlace}
>Place on Map</Button></>: null;


if(isMobile()) return null;



  return <div className="mapPanel">
    <div className="mapPanelCardContainer">
    <Card>
      <CardHeader>
        <div  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height:"1.5rem" }}>
        <span
          className="searchPanelButton"
          onClick={()=>mapController.setSearching({firstLetter:""})}
          style={{ flexShrink: 0 }}
        >
          <img src={searchIcon} alt="search" />
        </span>
        <h5 className="title" style={{ flexGrow: 1, textAlign: 'center' }}>{Parser((title||"").replace(/([0-9])/, "<sup>$1</sup>"))
        }</h5>
        <span
          className="closePanelButton"
          onClick={()=>{
						setPanelContents(false)
						history.push({
							pathname:`/map/${currentMap.slug}`
						})
						}}
          style={{ flexShrink: 0 }}
        >
          ×
        </span>
        </div>
        <div className="info">{Parser((info||"").replace(/([0-9])/, "<sup>$1</sup>"))}</div>
      </CardHeader>
        <img src={`${assetUrl}/places/${slug}`} alt={title} />
      {adminPanel}
      <CardBody>
        {body}
      </CardBody>
    </Card>
    </div>
    <div className="mapPanelScripture">
      <ScripturePanelSingle closeButton={true} scriptureData={{ref:scripture}}  setPopUpRef={setScripture} />
    </div>
  </div>
}


function MapStoryPanel({mapController})
{
    const {selectedStory, moveSeq, currentMap, panelContents} = mapController;
    const [scripture, setScripture] = useState(null);
	  const parserOptions = getHtmlScriptureLinkParserOptions(setScripture);
    const history = useHistory();
    const fenceRefs = useRef({});
    const cardBodyRef = useRef(null);
    const [avatarTop, setAvatarTop] = useState(0);

    const moveCount = selectedStory.moves.length;

    useEffect(() => {
      if (!moveSeq) return;
      const fence = fenceRefs.current[moveSeq];
      if (fence) fence.scrollIntoView({behavior: 'smooth', block: 'center'});
    }, [moveSeq, selectedStory?.slug]);

    useEffect(() => {
      const seq = mapController.selectedMoveSeq;
      if (!seq) return;
      const fence = fenceRefs.current[seq];
      const container = cardBodyRef.current;
      if (!fence || !container) return;
      // Vertically center the 28px avatar row on the fence card.
      const top = fence.offsetTop + fence.offsetHeight / 2 - 14;
      setAvatarTop(top);
    }, [mapController.selectedMoveSeq, selectedStory?.slug]);

    const closeStory = () => {
      const mapSlug = currentMap?.slug;
      const placeSlug = panelContents?.slug;
      const placeBelongsToStory = placeSlug && selectedStory?.moves?.some((m) =>
        m.startPlace.slug === placeSlug || m.endPlace.slug === placeSlug
      );
      if (placeBelongsToStory) {
        history.push(`/map/${mapSlug}/place/${placeSlug}`);
      } else {
        history.push(`/map/${mapSlug}`);
      }
    };

    const selectedMoveSeq = mapController.selectedMoveSeq;
    const selectedMove = selectedStory.moves.find((m) => m.seq === selectedMoveSeq) || selectedStory.moves[0];
    const selectedPeople = selectedMove?.people || [];

    return <div className="mapPanel">
    <div className="mapPanelCardContainer">
        <Card>
            <CardHeader>
                <span
                    onClick={closeStory}
                    style={{cursor: "pointer", fontSize: "1.5rem", marginRight: "1rem", float: "left", opacity: 0.5}}
                >⬅</span>
                <h5 className="title">{selectedStory.title}</h5>
            </CardHeader>
            <CardBody innerRef={cardBodyRef}>
                <p>{selectedStory.description}</p>
                <h6>{moveCount} Movements</h6>
                {(() => {
                  const items = buildPanelItems(selectedStory.moves);
                  let prevTravelers = null;
                  return items.map((item) => {
                    if (item.kind === 'post') {
                      return (
                        <MapStoryPost
                          key={item.key}
                          place={item.place}
                          runColor={item.runColor}
                          connectsBelow={item.connectsBelow}
                        />
                      );
                    }
                    // fence
                    const { move: m, runColor, connectsBelow } = item;
                    const hideTravelers = m.travelers === prevTravelers;
                    prevTravelers = m.travelers;
                    const startPoint = [m.startPlace.lat, m.startPlace.lng];
                    const endPoint = [m.endPlace.lat, m.endPlace.lng];
                    const miles = metersToMiles(getDistance(startPoint, endPoint));
                    const isSelected = mapController.selectedMoveSeq === m.seq;
                    return (
                      <MapStoryFence
                        key={item.key}
                        move={m}
                        runColor={runColor}
                        connectsBelow={connectsBelow}
                        isSelected={isSelected}
                        hideTravelers={hideTravelers}
                        miles={miles}
                        parserOptions={parserOptions}
                        onClick={() => history.push(`/map/${currentMap?.slug}/story/${selectedStory.slug}/move/${m.seq}`)}
                        refCallback={(el) => { if (el) fenceRefs.current[m.seq] = el; }}
                      />
                    );
                  });
                })()}
                <MapStoryAvatars people={selectedPeople} top={avatarTop} />
            </CardBody>
        </Card>
    </div>
    <div className="mapPanelScripture">
      <ScripturePanelSingle closeButton={true} scriptureData={{ref:scripture}}  setPopUpRef={setScripture} />
    </div>
    </div>
}


function MapStoryPost({ place, runColor, connectsBelow, refCallback }) {
  if (!place?.slug) return null;
  const label = (place?.label || place?.name)?.replace(/\//g, " ").replace(/ +/g, " ");
  return (
    <div
      className={`map_story_post${connectsBelow ? ' connects' : ''}`}
      style={{ '--run-color': runColor }}
      ref={refCallback || undefined}
    >
      <img src={`${assetUrl}/places/${place.slug}`} alt={place.slug} />
      <span className="map_story_post_caption">{label}</span>
    </div>
  );
}

function MapStoryFence({
  move,
  runColor,
  connectsBelow,
  isSelected,
  hideTravelers,
  miles,
  parserOptions,
  onClick,
  refCallback,
}) {
  const { seq, travelers, verse_ids, description, duration } = move;
  const lang = determineLanguage();
  const scriptureref = generateReference(verse_ids, lang);
  const ref = `<a className="scripture_link">${scriptureref}</a>`;
  const showHeader = !hideTravelers || !!duration;
  return (
    <div
      className={`map_story_fence${isSelected ? ' selected' : ''}${connectsBelow ? ' connects' : ''}`}
      style={{ '--run-color': runColor }}
      data-seq={seq}
      onClick={onClick}
      ref={refCallback || undefined}
    >
      <span className="map_story_distance_badge">{miles} mi</span>
      <div className="map_story_fence_body">
        {showHeader && (
          <p>
            {!hideTravelers && <b>{travelers}</b>}
            {!hideTravelers && !!duration && <span> • </span>}
            {!!duration && <span className="duration">{duration}</span>}
          </p>
        )}
        {Parser(`<p class='desc'>${description} (${ref})</p>`, parserOptions)}
      </div>
    </div>
  );
}

function MapStoryAvatars({people, top}) {
  if (!people?.length) return null;
  return (
    <div className="map_story_avatars" aria-hidden="true" style={{ top }}>
      {people.map((p) => (
        <img
          key={p.slug}
          src={`${assetUrl}/people/${p.slug}`}
          alt={p.name || p.slug}
        />
      ))}
    </div>
  );
}
