/** @format */

import React, { useState, useEffect, useRef, useCallback } from "react"
import ReactDOMServer from 'react-dom/server';
import Parser from "html-react-parser";
import leaflet from "leaflet"
import { Link, useRouteMatch, BrowserRouter as Router } from "react-router-dom"
// BROWSER HISTORY
import { history } from "../../models/routeHistory"
// media base url of BookOfMormon
import { assetUrl } from 'src/models/BoMOnlineAPI';
// COMPONENTS
import Loader from "../_Common/Loader"
import BoMOnlineAPI from "src/models/BoMOnlineAPI"
// CSS
import "./Timeline.css"
import {
  snapSelectionToWord,
  replaceNumbers,
  processName,
  label,
} from "src/models/Utils";


function TimeLine(props) {
  useEffect(()=>document.title = label("menu_timeline") + " | " + label("home_title"),[])
  const [timelineData, setTimelineData] = useState(null),
    map = useRef(null),
    match = useRouteMatch()

  

  useEffect(() => {
    BoMOnlineAPI({ timeline: true }).then((result) => {
      setTimelineData(result.timeline)
    })
  }, [])

  // if map initialie then remove map first and bind again
  const checkMapInitialie = () => {
    if (!map.current) leafletMap()
  }

  //set timeline map
  const leafletMap = () => {
    var mapMinZoom = 2,
      mapMaxZoom = 5,
      defalutZoom = window.innerWidth < 800 ? 3 : 4

    map.current = leaflet.map("timeline", {
      maxZoom: mapMaxZoom,
      minZoom: mapMinZoom,
      zoomControl: false,
      crs: leaflet.CRS.Simple,
    }).setView([-25.4375, 19.1875], defalutZoom)

    new leaflet.Control.Zoom({ position: "topright" }).addTo(map.current)

    var mapBounds = new leaflet.LatLngBounds(
      map.current.unproject([0, 5888], mapMaxZoom),
      map.current.unproject([1536, 0], mapMaxZoom)
    )

    // get tile from Api "z,x,y" (z is get zoom and x,y get lat,log) it is work on that you set "mapMinZoom,mapMaxZoom"
    leaflet.tileLayer(`${assetUrl}/timeline/{z}/{x}/{y}`, {
      minZoom: mapMinZoom,
      maxZoom: mapMaxZoom,
      bounds: mapBounds,
      attribution: "",
      noWrap: true,
    }).addTo(map.current)

    var markers = timelineData.map((mark, i) => {

      // get marker icon 
      var markerIcon = leaflet.icon({
        iconUrl: `${assetUrl}/timeline/markers/${mark.file}`,
        iconSize: [mark.w, mark.h],
        iconAnchor: [mark.w / 2, mark.h / 2],
      })
      //set marker (pass perameter lat, lang, icon, and z "z is user for contsol the zoom level")
      var marker = leaflet.marker([mark.x, mark.y], {
        icon: markerIcon,
        zoom: mark.z,
        opacity: mark.o,
      })

      mark.slug && mark.p &&
        marker.bindPopup(ReactDOMServer.renderToString(renderMarker(mark)))

      marker.on("click", (e) => {
        mark.p && onClickMarker(mark.slug)
      });

      mark.date &&
        marker
          .bindTooltip(mark.date, { direction: "bottom", sticky: false })
          .openTooltip()
      return marker
    })

    // show zoom level when time line is bind
    showZoomlevel(map.current, markers)
    // show zoom level on maxZoom and minZoom
    map.current.on("zoom", (e) => {
      showZoomlevel(map.current, markers)
    })
    // create and open coustem marker
    if (match.params && match.params.markerSlug) {
      openDefaultInfowWindow(timelineData)
    }
  }
  
  const renderMarker = (mark) => {



    console.log(mark);
    return (
      <Router>
        <div className="leaflet-marker-container">
          <Link className="heading-link" to={`/${mark.text?.slug}`}>
            <div className="heading">{replaceNumbers(mark.heading)}</div>
            <div className="date">{mark.date}</div>
          </Link>
          <div className="bgImageBox">
            <Link className="bgImage" style={{
              backgroundImage: `url(${assetUrl}/timeline/art/${mark.slug})`
            }}
              to={`/${mark.text?.slug}`} />
          </div>
          <div className="text">{Parser(mark?.html || "")}</div>
          
        </div>
      </Router>
    )
  }

  // create coustom marker and open infow window
  const openDefaultInfowWindow = (timelineData) => {
    let markerInfo = timelineData.filter(
      (x) => x.slug === match.params.markerSlug
    )
    if (markerInfo.length) {
      markerInfo = markerInfo[0]
      var markerIcon = leaflet.icon({
        iconUrl: `${assetUrl}/timeline/markers/${markerInfo.slug}`,
        iconSize: [markerInfo.w, markerInfo.h],
        iconAnchor: [markerInfo.w / 2, markerInfo.h / 2],
      })
      // map.current.setZoom(markerInfo.z)
      map.current.setView([markerInfo.x, markerInfo.y], markerInfo.z + 1)
      let marker = leaflet.marker([markerInfo.x, markerInfo.y], {
        icon: markerIcon,
        zoom: markerInfo.z,
      })
      
      markerInfo.slug &&
        marker.bindPopup(
          ReactDOMServer.renderToString(renderMarker(markerInfo))
        )

      marker.addTo(map.current).openPopup()
      //set popup model top position
      map.current.panTo([markerInfo.x + 10, markerInfo.y], { animate: true })
      marker
        .addTo(map.current)
        .on("click", () => onClickMarker(markerInfo.slug))
    }
  }

  // control zoom and show or hide the markers
  const showZoomlevel = (map, markers) => {
    var zoom = map.getZoom() // get current zoom
    for (var i in markers) {
      map.removeLayer(markers[i]) // remove all marker
      //check for match zoom level with current zoom and set marker
      if (markers[i].options.zoom <= zoom) markers[i].addTo(map)
    }
  }

  const onClickMarker = (markerslug) => {
    history.push(`/timeline/${markerslug}`) // update Url
  }

  return (
    <div className='map-container'>
      <div
        id='timeline'
        className='leaflet-container leaflet-fade-anim timeline-map'
      >
        {timelineData ? checkMapInitialie() : <Loader />}
      </div>
    </div>
  )

}

export default TimeLine;


