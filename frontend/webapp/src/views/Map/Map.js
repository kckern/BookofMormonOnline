/** @format */

import React, { useState, useEffect, useCallback } from "react"
import Parser from "html-react-parser";
import { useParams } from "react-router-dom"
// VIEW
import TileMap from "./TileMap"
import spinner from  "../_Common/svg/loadbar.svg"
import Loader from "../_Common/Loader"
import places from "../_Common/svg/places.svg";
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
  CardHeader,
  Nav,
  NavItem,
  NavLink,
  TabPane,
  TabContent
} from "reactstrap";
import { assetUrl } from "../../models/BoMOnlineAPI"
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
    [panelContents, setPanelContents] = useState({});

  useEffect(() => {

    appController.functions.closePopUp()

    if(!appController.preLoad.placeList) return;

    getMap(params.mapType, params.placeName)

    if(params.placeName){
      setPanelContents({slug: params.placeName});
    }

  }, [appController.preLoad.placeList])

  useEffect(() => {
    window.addEventListener("handleMapChange", handleMapChange, false);
    return ()=>{
      window.removeEventListener("handleMapChange", handleMapChange, false)
    }
  }, [])

  // get active map data
  const getMap = useCallback((type = "baja", place) => {
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



  const mapController = {
    setPanelContents,
    panelContents,
    getMap,
    mapName,
    placeName,
    updateUrl,
    appController,
    setTooltip,
    tooltip,
    mapFunctions,
    setMapFunctions,
    currentMap
  }
  const {placeList} = appController.preLoad;

  return (  <>
      <div className={`mappanel_wrapper ${!!panelContents.slug ? "open" : ""}`}>
        <MapTypes getMap={getMap} mapName={mapName} />
        <MapPanel mapController={mapController}  />
        <MapSpotlight mapController={mapController} />
        <MapToolTip {...mapController} />
        {placeList && currentMap?.places ?  <MapContents  mapController={mapController}  />  : <Loader />  }
      </div>
    </>
  )
}
function MapSpotlight({ mapController }) {

  return null;
  return <div className="mapHighlight">
  <svg width="100%" height="100%" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <mask id="circleMask">
        <rect width="100%" height="100%" fill="white" />
        <circle cx="500" cy="500" r="50" fill="black" />
      </mask>
    </defs>
    <circle cx="500" cy="500" r="50" fill="transparent" />
    <rect width="100%" height="100%" fill="#00000022" mask="url(#circleMask)" />
  </svg>
</div>

}


function getPlaceInfo(slug, appController) {
  const keys = Object.keys(appController.preLoad.placeList || {});
  const key = keys.find((key) => appController.preLoad.placeList[key].slug === slug);
  return key ? appController.preLoad.placeList[key] : {};
}

function MapToolTip({ tooltip, appController, panelContents }) {
  const { x, y, w,h, slug } = tooltip;
  if(!slug) return null;
  const placeInfo = getPlaceInfo(slug, appController);
  const {name, info, location, occupants, type} = placeInfo;

  const [boxH,boxW] = [100,150];
  const margin = 10;

  const leftVal = `calc( ${!!panelContents.slug ? 30 : 0}% + ${x - (boxW/2)}px )`;

  return (
    <div className="mapTooltip" style={{left: leftVal, top: y - boxH - (h/2) - margin
    ,backgroundImage: `url(${assetUrl}/places/${slug})`, width: boxW, height: boxH
    }}
    >
     
      <div className="placeInfo"> <h4>{name}</h4><p>{info}</p></div>
    </div>
  )
}


function MapPanel({mapController})
{
  const {panelContents, setPanelContents,mapFunctions} = mapController;

  const {slug} = panelContents || {};

  const placeInfo = getPlaceInfo(slug, mapController.appController);
  const title = placeInfo?.name;
  const info = placeInfo?.info;

  const [placeDetails, setPlaceDetails] = useState({});
  useEffect(()=>{
    //scroll .mapPanel to top
    const panel = document.querySelector('.mapPanel');
    setScripture(null);
    if(panel) panel.scrollTop = 0;

    if(slug){

      //update router path
      mapController.appController.functions.setSlug(`/map/${mapController.currentMap?.slug}/place/${slug}`);

      BoMOnlineAPI({places: [slug]}).then((result)=>{
        setPlaceDetails(result?.places?.[slug] || {});
      })
    }
    else{
      mapController.appController.functions.setSlug(`/map/${mapController.currentMap?.slug}`);

    }
  }, [slug,panelContents?.slug])


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
      <img src={places} alt="places" style={{filter: "invert(1)", opacity: 0.5}} />
      <div>Description</div>
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
      <div>References</div>
    </NavItem>
</Nav>
<TabContent activeTab={activeTab}>
    <TabPane tabId="1">
        <div className="desc" >
          {Parser(desc_with_scripturelinks,parseOptions)}</div>
    </TabPane>
    <TabPane tabId="2">
        <div>Events</div>
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
                        <td>{item.text}</td>
                    </tr>
                })}
            </tbody>
        </table>
    </TabPane>
</TabContent>
    </>


  return <div className="mapPanel">
    <div className="mapPanelCardContainer">
    <Card>
      <CardHeader>
        <h5 className="title">{title}</h5>
       <div className="info">{info}</div>
        <span 
          className="closePanelButton"
          onClick={()=>setPanelContents(false)}
        >
          ×
        </span>
      </CardHeader>
        <img src={`${assetUrl}/places/${slug}`} alt={title} />
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