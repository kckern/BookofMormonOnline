/** @format */

import React, { useState, useEffect, useCallback } from "react"
import Parser from "html-react-parser";
import { useParams } from "react-router-dom"
// VIEW
import TileMap from "./TileMap"
import spinner from  "../_Common/svg/loadbar.svg"
import Loader from "../_Common/Loader"
import placesIcon from "../_Common/svg/places.svg";
// AACTION TYPES
import BoMOnlineAPI from "src/models/BoMOnlineAPI"
// CSS
import "./Map.css"
import MapTypes from "./MapTypes";
import { label,isMobile } from "src/models/Utils"
import MapContents from "./MapContents"
import {MapPlaceSearch} from "./MapPlaceSearch"
import RangeSlider from 'react-range-slider-input';
import searchIcon from "../_Common/svg/search.svg";
import 'react-range-slider-input/dist/style.css';
import axios from "axios";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Nav,
  NavItem,
  NavLink,
  TabPane,
  TabContent,
  Alert
} from "reactstrap";
import { ApiBaseUrl, assetUrl } from "../../models/BoMOnlineAPI"
import { ScripturePanelSingle } from "../Page/Narration";
import { detectScriptures } from "scripture-guide";
import { renderPersonPlaceHTML } from "../Page/PersonPlace";
import { map } from "highcharts";
function MapContainer({ appController }) {

  const params = useParams(),
    [currentMap, setCurrentMap] = useState(null),
    [mapName, setMapName] = useState(""),
    [placeName, setPlaceName] = useState(params.placeName),
    [tooltip, setTooltip] = useState({ x: 0, y: 0, slug: null }),
    [mapFunctions, setMapFunctions] = useState({}),
    [zoomLevel,setZoomLevel] = useState(0),
    [mapCenter, setMapCenter] = useState([0,0]),
    [searching,setSearching] = useState(null),
    [initSearchLetter, setInitSearchLetter] = useState(null),
    [panelContents, setPanelContents] = useState({});


  const userMetadata = appController.sendbird?.getCurrentUser()?.metaData
  const metaKeys = Object.keys(userMetadata || {});
  const isAdmin = ["isAdmin", "isMapper"].some((key) => metaKeys.includes(key));

  //set keyboard listener so that typing will populate searching with seatSearching, escape will set it back to null

  const handleKeyDown = (event) => {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return false;
    if (event.key === 'Escape') {
      setSearching(null);
    }

    //input is focused
    if (document.activeElement.tagName === "INPUT") {
      event.stopPropagation();
      return false;
    }

    // todo: handle arrows and +/-
    else {
      if(event.key.length > 1) return false;
      setSearching(true);
      setInitSearchLetter(event.key);
    }
  };
  useEffect(() => {
    appController.functions.closePopUp()
    if(!appController.preLoad.placeList) return;
    getMap(params.mapType, params.placeName)
    if(params.placeName){
      if(isMobile())  appController.functions.setPopUp({ type: "places", ids: [params.placeName] });
      else setPanelContents({slug: params.placeName});
    }
  }, [appController.preLoad.placeList])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener("handleMapChange", handleMapChange, false);
    return ()=>{
      window.removeEventListener("handleMapChange", handleMapChange, false)
      window.removeEventListener('keydown', handleKeyDown);
    }
  }, [])

  // get active map data
  const getMap = useCallback((type = "internal", place) => {
    // update Url
    if(!type) return;
    updateUrl(`/map/${type}${place ? "/place/" + place : ""}`)
    setMapName(label("loading"))
    
    BoMOnlineAPI({ map: type }).then((result) => {
      setPlaceName(place)
      setMapName(result.map?.[type]?.name)
      setCurrentMap({ ...result.map[type] })

      document.title = result.map?.[type]?.name + " " + label("menu_map")  + " | " + label("home_title");
    })
  }, [])

  // only update Url not redirect the page
  const updateUrl = (pageUrl) => {
    appController.functions.setSlug(pageUrl);
  }

  const handleMapChange = ({ map, place }) => {
    place = place || mapController.panelContents.slug;
    getMap(map, place)
    appController.functions.closePopUp()
  }



  const {placeList} = appController.preLoad;
  const mapController = {
    setPanelContents,
    panelContents,
    getMap,
    mapName,
    placeList,
    placeName,
    updateUrl,
    appController,
    setTooltip,
    tooltip,
    mapFunctions,
    setMapFunctions,
    currentMap,
    setCurrentMap,
    isAdmin,
    searching,
    setSearching,
    zoomLevel,
    setZoomLevel,
    mapCenter,
    setMapCenter,
  }

  return (  <>
      <div className={`mappanel_wrapper ${!!panelContents.slug ? "open" : ""}`}>
        <MapTypes getMap={getMap} mapName={mapName} mapController={mapController} />
        <MapPanel mapController={mapController}   />
        <MapToolTip {...mapController} />
        {placeList && currentMap?.places ? <>
          <MapContents  mapController={mapController}  />
          <MapPlaceSearch {...{mapController}} />
          </>   : <Loader />  }
       
      </div>
    </>
  )
}

function getPlaceInfo(slug, appController) {
  const keys = Object.keys(appController.preLoad.placeList || {});
  const key = keys.find((key) => appController.preLoad.placeList[key].slug === slug);
  return key ? appController.preLoad.placeList[key] : {};
}

function MapToolTip({ tooltip, appController, panelContents }) {
  const { x, y, w,h, slug, moving } = tooltip;
  if(!slug || moving) return null;
  const placeInfo = getPlaceInfo(slug, appController);
  const {name, info, location, occupants, type} = placeInfo;

  const [boxH,boxW] = [100,150];
  const margin = 10;

  const leftVal = `calc( ${!!panelContents.slug ? 30 : 0}% + ${x - (boxW/2)}px )`;

  const isSelectedInPanel = panelContents.slug === slug;


  if(isMobile() || isSelectedInPanel) return null;

  const toolTip =  <div className="mapTooltip" style={{left: leftVal, top: y - boxH - (h/2) - margin
    ,backgroundImage: `url(${assetUrl}/places/${slug})`, width: boxW, height: boxH
    }}>
      <div className="placeInfo"> <h4>{name}</h4><p>{info}</p></div>
    </div>
  
  

    return toolTip
}


function MapPanel({mapController})
{
  
  const [prevMapType, setPrevMapType] = useState(null);

  const {panelContents, zoomLevel, currentMap, mapCenter, setPanelContents,mapFunctions, isAdmin, placeList} = mapController;

  const {slug} = panelContents || {};

  const placeInfo = getPlaceInfo(slug, mapController.appController);
  const title = placeInfo?.name;
  const info = placeInfo?.info;

  const {places} = currentMap || {};

  const [place, setPlace] = useState(places?.find((place) => place.slug === slug));


  

  const [placeDetails, setPlaceDetails] = useState({});

  useEffect(()=>{
    if(!slug || !currentMap) return;
    setPlace(currentMap.places?.find((place) => place.slug === slug));
  },[slug,currentMap])


  useEffect(()=>{
    //scroll .mapPanel to top
    const panel = document.querySelector('.mapPanel');
    setScripture(null);
    if(panel) panel.scrollTop = 0;
    const mapSlug = mapController.currentMap?.slug;
    if(!mapSlug) return;
    if(slug){

      //update router path
     
      mapController.appController.functions.setSlug(`/map/${mapSlug}/place/${slug}`);
      setPlaceDetails({});
      //TODO: use the cache after data entry is complete, is not admin
      BoMOnlineAPI({places: [slug]},{ useCache: false }).then((result)=>{
        setPlaceDetails(result?.places?.[slug] || {});
      })
    }
    else{
      mapController.appController.functions.setSlug(`/map/${mapSlug}`);

    }
  }, [slug,panelContents?.slug,mapController.currentMap?.slug])

  const index = placeDetails?.index || [];
  const maps = placeDetails?.maps || [];

  const [activeTab, setActiveTab] = useState("1");
  const [scripture, setScripture] = useState("1 Nephi 1:1");


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

  let desc_with_scripturelinks =  placeDetails?.description;
  

    desc_with_scripturelinks = detectScriptures(
    placeDetails?.description || "", 
    (scripture) => { if (!scripture) return;
       return `<a className="scripture_link">${scripture}</a>` }
       );

  const  body = !placeDetails?.description ?  <div className='noselect' style={{display : "flex", justifyContent: "center"}}>
    <img  src={spinner} alt="loading"  style={{ height: "10rem" }} />
    </div> : <><Nav tabs className="noselect">
    <NavItem onClick={() => setActiveTab("1")} className={activeTab === "1" ? "active" : ""}>
      <img src={placesIcon} alt="places" style={{filter: "invert(1)", opacity: 0.5}} />
      <div>{label("description")}</div>
    </NavItem>
    {/*<NavItem onClick={() => setActiveTab("2")} className={activeTab === "2" ? "active" : ""}>
      <div><span className="counter">{placeDetails.index?.length || 0}</span></div>
      <div>Events</div>
    </NavItem>
    <NavItem onClick={() => setActiveTab("3")} className={activeTab === "3" ? "active" : ""}>
      <div><span className="counter">{placeDetails.index?.length || 0}</span></div>
      <div>Viscinity</div>
</NavItem>*/}
    <NavItem onClick={() => setActiveTab("4")} className={activeTab === "4" ? "active" : ""}>
      <div><span className="counter">{placeDetails.index?.length || 0}</span></div>
      <div>{label("references")}</div>
    </NavItem>
</Nav>
<TabContent activeTab={activeTab}>
    <TabPane tabId="1">
        <div className="desc" >
          {Parser(desc_with_scripturelinks,parseOptions)}</div>
    </TabPane>
    <TabPane tabId="2">
        <div>{label("events")}</div>
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

const preloadedPlace = Object.values(placeList||{}).find((place)=>place.slug === slug);


useEffect(()=>{
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
    setTimeout(()=>{
      mapController.getMap(currentMap?.slug)

      if(isMobile())  mapController.appController.functions.setPopUp({ type: "places", ids: [slug] });
      else  mapController.setPanelContents({slug});

    },1000);
  }

}

const savePointConfig = () => {

  const button = document.querySelector("#saveButton");
  //saving...
  button.innerHTML = label("saving");



  const data = {
    name: document.querySelector("#placeName")?.value,
    label: document.querySelector("#placeLabel")?.value,
    min:minZoom,
    max:maxZoom,
    map: currentMap?.slug,
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
    console.log(response.data);
    button.innerHTML = label("saved");
    clearCache();

    setTimeout(()=>{button.innerHTML = label("save")},2000);
    //redraw map
    mapController.getMap(null,null);
    setTimeout(()=>{mapController.getMap(currentMap?.slug,slug)},100);

  }).catch(function (error) {
    console.error(error);
    button.innerHTML = label("error");
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

  //alert(JSON.stringify(data,null,2));
  const config = {
    method: 'POST',
    url: `${ApiBaseUrl}/coords`,
    headers: {'Content-Type': 'application/json', token},
    data
  };

  axios.request(config).then(function (response) {
    mapController.getMap("neareast",null);
    setTimeout(()=>{mapController.getMap(currentMap?.slug,slug)},100);
  }).catch(function (error) {
    console.error(error);
  });

}

const adminPanel = isAdmin ? place ? <Card className="adminPanel" onKeyDown={(e)=>{if(e.key === "Enter") savePointConfig()}}>

    <CardBody>
    <div className="grid-container">
      <div className="grid-item">
        <label>{label("place_name")}</label>
        <input type="text" defaultValue={title} id="placeName"  key={title} />
      </div>
      <div className="grid-item">
        <label>{label("place_label")}</label>
        <input defaultValue={place.label} id="placeLabel" type="text" key={place.label} />
      </div>
    </div>
  </CardBody>
  {!!zoomRange && (<><CardHeader>
    <h6 className="title">{label("zoom_levels")}
    {" "}({label("current_zoom")}: <code>{Math.round(zoomLevel)}</code>)
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
      defaultValue={[minZoom,maxZoom]}
      onInput={([min,max])=>{ setMinMaxZoom([min,max])}}
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
>{label("place_on_map")}</Button></>: null;


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
          onClick={()=>setPanelContents(false)}
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


export default MapContainer;