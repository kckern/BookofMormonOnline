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
import MapContents from "./MapContents"
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader
} from "reactstrap";
function MapContainer({ appController }) {

  const params = useParams(),
    [currentMap, setCurrentMap] = useState(null),
    [mapName, setMapName] = useState(""),
    [placeName, setPlaceName] = useState(params.placeName),
    [isOpen, openPanel] = useState(true);

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

  const mapController = {
    openPanel,
    isOpen,
    getMap,
    mapName,
    placeName,
    updateUrl,
    appController
  }


  return (  <>
      <div className={`mappanel_wrapper ${isOpen ? "open" : ""}`}>
        <MapTypes getMap={getMap} mapName={mapName} />
        <MapPanel mapController={mapController}  />
        <div id='map' className='map' style={{ overflow: "hidden" }}>
          {currentMap ?  <MapContents  mapController={mapController}  />  : <Loader />  }
        </div>
      </div>
    </>
  )
}


function MapPanel({mapController})
{
  const {isOpen, openPanel} = mapController;
  return <div className="mapPanel">
    <Card>
      <CardHeader>
        <h5 className="title">Map Panel</h5>
      </CardHeader>
      <CardBody>
        <Button onClick={()=>openPanel(false)}>Close</Button>
      </CardBody>
      <CardFooter>
        <p>Map Panel</p>
      </CardFooter>
    </Card>
  </div>
}


export default MapContainer;