/** @format */

import React, { useState, useEffect, useCallback } from "react"
import { useParams } from "react-router-dom"
// VIEW
import Loader from "../_Common/Loader"
// AACTION TYPES
import BoMOnlineAPI from "src/models/BoMOnlineAPI"
// CSS
import "./Map.css"
import MapTypes from "./MapTypes";
import { label,isMobile } from "src/models/Utils"
import MapContents from "./MapContents"
import {MapPanel,getPlaceInfo} from "./MapPanel.js"
import {  assetUrl } from "../../models/BoMOnlineAPI"
import { SearchPopUp } from "../_Common/SearchPopUp.js"
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
  const ignoreKeys = ['-', '_', '=', '+', '[', ']', 'Tab',"\\","/","|"];
    if (document.activeElement.tagName !== "INPUT" && ignoreKeys.includes(event.key)) {
      return false;
    }
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

    BoMOnlineAPI({ map: type, mapstories: [type] },{useCache:false}).then((result) => {
      result.map[type].stories = result?.mapstories || [];
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

  const selectItemHandler = (slug) => {
    //TODO: Mobile Drawer
    if(isMobile())  mapController.appController.functions.setPopUp({ type: "places", ids: [slug] });
    else    mapController.setPanelContents({slug});
    setSearching(null);
}


  return (  <>
      <div className={`mappanel_wrapper ${!!panelContents.slug ? "open" : ""}`}>
        <MapTypes getMap={getMap} mapName={mapName} mapController={mapController} />
        <MapPanel mapController={mapController}   />
        <MapToolTip {...mapController} />
        {placeList && currentMap?.places ? <>
          <MapContents  mapController={mapController}  />
          <SearchPopUp
          placeholder="search_for_a_place"
          preLoadData={placeList}
          selectItemHandler={selectItemHandler}
          isOpen={searching}
          setIsOpen={setSearching}
          testFieldNames={{primary:'info',secondary:'name'}}
          assetName="places"
          />
          </>   : <Loader />  }

      </div>
    </>
  )
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




export default MapContainer;
