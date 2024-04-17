
import React, { useState, useEffect, useCallback } from "react"
import Parser from "html-react-parser";
import spinner from  "../_Common/svg/loadbar.svg"
import placesIcon from "../_Common/svg/places.svg";
import { useHistory } from 'react-router';
// AACTION TYPES
import BoMOnlineAPI from "src/models/BoMOnlineAPI"
// CSS
import "./Map.css"
import { isMobile } from "src/models/Utils"
import RangeSlider from 'react-range-slider-input';
import searchIcon from "../_Common/svg/search.svg";
import 'react-range-slider-input/dist/style.css';
import { getDistance } from 'geolib';

import axios from "axios";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Nav,
  NavItem,
  TabPane,
  TabContent
} from "reactstrap";
import { ApiBaseUrl, assetUrl } from "../../models/BoMOnlineAPI"
import { ScripturePanelSingle } from "../Page/Narration";
import { detectScriptures, generateReference } from "scripture-guide";

const metersToMiles = (meters) => Math.round(meters * 0.000621371192 * 1) / 1;


export function getPlaceInfo(slug, appController) {
    const keys = Object.keys(appController.preLoad.placeList || {});
    const key = keys.find((key) => appController.preLoad.placeList[key].slug === slug);
    return key ? appController.preLoad.placeList[key] : {};
  }

export function MapPanel({mapController})
{
    const parseOptions = {
        replace: (domNode) => {
          const attribs = { ...domNode.attribs };
          if (attribs?.classname === 'scripture_link') {
            const ref = domNode.children[0].data;
            attribs.class = attribs.classname;
            delete attribs.classname;
            return <a {...attribs} onClick={()=>setScripture(ref)}>{ref}</a>;
          }
        }
      }

  const [prevMapType, setPrevMapType] = useState(null);
  const [selectedStory, setSelectedStory] = useState(null);
  const {panelContents, zoomLevel, currentMap, mapCenter, setPanelContents,mapFunctions, isAdmin, placeList} = mapController;
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
    if (slug) {
        mapController.appController.functions.setSlug(`/map/${mapSlug}/place/${slug}`);
        setPlaceDetails({});
        BoMOnlineAPI({ places: [slug] }, { useCache: false }).then((result) => {
            setPlaceDetails(result?.places?.[slug] || {});
        });
    } else {
        mapController.appController.functions.setSlug(`/map/${mapSlug}`);
    }
}, [slug, currentMap?.slug, selectedStory]);


  const index = placeDetails?.index || [];
  const maps = placeDetails?.maps || [];

  const [activeTab, setActiveTab] = useState("1");
  const [scripture, setScripture] = useState(null);

  let desc_with_scripturelinks =  placeDetails?.description;
  

    desc_with_scripturelinks = detectScriptures(
    placeDetails?.description || "", 
    (scripture) => { if (!scripture) return;
       return `<a className="scripture_link">${scripture}</a>` }
       );


       const matchingStories = currentMap?.stories?.filter((story) => story.moves.some((move) => move.startPlace.slug === slug || move.endPlace.slug === slug)) || [];

  const storyCount = matchingStories.length;

  const  body = !placeDetails?.description ?  <div className='noselect' style={{display : "flex", justifyContent: "center"}}>
    <img  src={spinner} alt="loading"  style={{ height: "10rem" }} />
    </div> : <><Nav tabs className="noselect">
    <NavItem onClick={() => setActiveTab("1")} className={activeTab === "1" ? "active" : ""}>
      <img src={placesIcon} alt="places" style={{filter: "invert(1)", opacity: 0.5}} />
      <div>Description</div>
    </NavItem>
    {!!storyCount && <NavItem onClick={() =>{
        if(storyCount===1) {
            const firstAndOnlyStory = matchingStories[0];
            mapController.updateUrl(`/map/${currentMap?.slug}/story/${firstAndOnlyStory.slug}`);
            setSelectedStory(firstAndOnlyStory)
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
        <div className="desc" >
          {Parser(desc_with_scripturelinks,parseOptions)}</div>
    </TabPane>
    <TabPane tabId="2">
    {matchingStories.map((story, i) => {
    return <div key={i} className="map_story" onClick={()=>{
        mapController.updateUrl(`/map/${currentMap?.slug}/story/${story.slug}`);
        setSelectedStory(story)
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
  //clear panel
  setPanelContents(false);
},[currentMap?.slug])


mapController.selectedStory = selectedStory;
mapController.setSelectedStory = setSelectedStory;

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
    mapController.setPanelContents(false);

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
    style={{display: "flex", flexDirection: "column-reverse", justifyContent: "space-between", flexGrow: 1}}
    className="rangeSliderContainer"
  >
    <RangeSlider
      key={`${minZoom}-${maxZoom}`}
      min={currentMap?.minzoom}
      max={currentMap?.maxzoom}
			value={[minZoom,maxZoom]}
      defaultValue={[minZoom,maxZoom]}
      onInput={(data)=>setMinMaxZoom(data)}
    />
    <div className="minMax" style={{display: "flex", justifyContent: "space-between",marginBottom:"1ex"}}>
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
  <CardFooter style={{ display: 'flex', justifyContent: 'flex-end' }}>

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
    const {selectedStory, setSelectedStory} = mapController;
    const preLoadedPlaces = Object.values(mapController.placeList);
    const [scripture, setScripture] = useState(null);
    const parseOptions = {
        replace: (domNode) => {
          const attribs = { ...domNode.attribs };
          if (attribs?.classname === 'scripture_link') {
            const ref = domNode.children[0].data;
            attribs.class = attribs.classname;
            delete attribs.classname;
            return <a {...attribs} onClick={()=>setScripture(ref)}>{ref}</a>;
          }
        }
      } 

    const moveCount = selectedStory.moves.length;


    return <div className="mapPanel">
    <div className="mapPanelCardContainer">
        <Card>
            <CardHeader>
                <span
                    onClick={()=>setSelectedStory(null)}
                    style={{cursor: "pointer", fontSize: "1.5rem", marginRight: "1rem", float: "left", opacity: 0.5}}
                >⬅</span>
                <h5 className="title">{selectedStory.title}</h5>
            </CardHeader>
            <CardBody>
                <p>{selectedStory.description}</p>
                <h6>{moveCount} Movements</h6>
                {selectedStory.moves.map((move, i) => {
                    const {seq, travelers, verse_ids, description, startPlace, endPlace, duration} = move;
                    const scriptureref = generateReference(verse_ids);
                    const ref = `<a className="scripture_link">${scriptureref}</a>`;
  

                    const start = preLoadedPlaces.find((place) => place.slug === startPlace.slug);
                    const end = preLoadedPlaces.find((place) => place.slug === endPlace.slug);

                    const startPoint = [startPlace.lat, startPlace.lng];
                    const endPoint = [endPlace.lat, endPlace.lng];
                    const miles =  metersToMiles(getDistance(startPoint, endPoint));

                    return <div key={i+seq} className="map_story_move" >
                            <MapEventImageCaption location={start} />
                            <div className="map_story_move_desc">
                                <p><b>{travelers}</b><span className="distance"> • {miles} miles</span>{!!duration && <span className="duration"> • {duration}</span>}
                                </p>
                                {Parser(`<p class='desc'>${description} (${ref})</p>`, parseOptions)}
                            </div>
                            <MapEventImageCaption location={end} />
                        </div>
                })}
            </CardBody>
        </Card>
    </div>
    <div className="mapPanelScripture">
      <ScripturePanelSingle closeButton={true} scriptureData={{ref:scripture}}  setPopUpRef={setScripture} />
    </div>
    </div>
}


function MapEventImageCaption({location}){

    if(!location?.slug) return null
    const label = (location?.label || location?.name)?.replace(/\//g, " ").replace(/ +/g, " ");

    return <div className="map_story_move_place">
    <img src={`${assetUrl}/places/${location.slug}`} alt={location.slug} />
    <caption>{label}</caption>
</div>
}