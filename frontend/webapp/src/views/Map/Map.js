/** @format */

import React, { useState, useEffect, useCallback } from "react"
import { useParams } from "react-router-dom"
// VIEW
import TileMap from "./TileMap"
import Loader from "../_Common/Loader"
// AACTION TYPES
import BoMOnlineAPI from "src/models/BoMOnlineAPI"
// CSS
import "./Map.css"
import MapTypes from "./MapTypes";
import { label } from "src/models/Utils"

function MapContainer({ appController }) {

  const params = useParams(),
    [currentMap, setCurrentMap] = useState(null),
    [mapName, setMapName] = useState(""),
    [placeName, setPlaceName] = useState(params.placeName);

  useEffect(() => {

    appController.functions.closePopUp()

    const element = document.getElementsByClassName("main-panel")[0]
    element.style.paddingRight = 0
    getMap(params.mapType, params.placeName)


  }, [])

  useEffect(() => {
    window.addEventListener("handleMapChange", handleMapChange, false);
    return ()=>{
      window.removeEventListener("handleMapChange", handleMapChange, false)
    }
  }, [])

  // get active map data
  const getMap = useCallback((type = "internal", place) => {
    // update Url
    updateUrl(`/map/${type}`)
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
    console.log(map, place)
    getMap(map, place)
    appController.functions.closePopUp()
  }

  return (
    <>
      <MapTypes getMap={getMap} mapName={mapName} />
      <div id='map' className='map' style={{ overflow: "hidden" }}>
        {currentMap ? (
          <TileMap
            mapData={currentMap}
            placeName={placeName}
            updateUrl={updateUrl}
            appController={appController}
          />
        )
          : <Loader />
        }
      </div>
    </>
  )
}

export default MapContainer;