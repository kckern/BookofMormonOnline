/** @format */

import React, { useState, useEffect } from "react";
import ReactDOM from 'react-dom';
import { useHistory } from "react-router-dom"
//API ACTIONS
import BoMOnlineAPI from "src/models/BoMOnlineAPI"
import { assetUrl } from 'src/models/BoMOnlineAPI';
// UTILS
import Loader from "../_Common/Loader"
//
import InfowindowContent from './InfowindowContent';

import loading from "src/views/_Common/svg/loadbar.svg"
import { isMobile, label, processName } from "src/models/Utils";

function getNormalizedCoord(coord, zoom) {
  var y = coord.y,
    x = coord.x,
    tileRange = 1 << zoom
  if (y < 0 || y >= tileRange) return null
  if (x < 0 || x >= tileRange) x = ((x % tileRange) + tileRange) % tileRange
  return { x: x, y: y }
}
export let google = window.google

function TileMap({ mapData, placeName, updateUrl, appController }) {
  const [placeSlug, setPlaceSlug] = useState(placeName),
    [activeInfoWindow, setActiveInfoWindow] = useState(null),
    { push } = useHistory();

  useEffect(() => {
    if (activeInfoWindow) activeInfoWindow.close()
    document.querySelector(".gm-style-iw button.gm-ui-hover-effect")?.click();
    checkInitialization(mapData)
  }, [mapData,mapData.slug])

  useEffect(() => {
    setPlaceSlug(placeName)
  }, [placeName])

  const checkInitialization = (mapData) => {
    if (mapData)
      if (google) initMap(mapData)
      else intializeGoogle(mapData)
  }

  const intializeGoogle = (mapData) => {
    google = window.google
    setTimeout(() => {
      initMap(mapData)
    }, 2000)
  }

  // uI of setilite map and timeline map
  const initMap = (mapData) => {
    var map = {},
      imageMapType = {},
      infoWindow = new google.maps.InfoWindow(),
      defaultMarker = null;
    //get place info if Url has place info slug
    let placeInfo = mapData?.places?.find((x) => x.slug === placeSlug)

    try {

      var mapOptions = {
        center: { lat: mapData.centerx, lng: mapData.centery },
        zoom: mapData.zoom,
        maxZoom: mapData.maxzoom,
        minZoom: mapData.minzoom,
        name: mapData.name,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        mapTypeControl: false,
        streetViewControl: false,
        fullScreenControl: true,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_CENTER,
        },
        scaleControl: true,
        backgroundColor: "#4c6171",
      }

      map = new google.maps.Map(document.getElementById("map"), mapOptions)

      // check map type stelite or imageMap(tyle map) if may type is tile then show imageMap(tyle map)
      if (mapData.tiles) {

        imageMapType = new google.maps.ImageMapType({
          getTileUrl: function (coord, zoom) {
            var normalizedCoord = getNormalizedCoord(coord, zoom)
            if (!normalizedCoord) return null
            var bound = Math.pow(2, zoom)
            return `${assetUrl}/tile/${mapData.slug}/${zoom}/${normalizedCoord.x
              }/${bound - normalizedCoord.y - 1}`
          },
          tileSize: new google.maps.Size(256, 256),
          maxZoom: mapData.maxzoom,
          minZoom: mapData.minzoom,
          name: mapData.name,
        })
        map.mapTypes.set("satellite ", imageMapType)
        map.setMapTypeId("satellite ")
      }
      //...end of map check

      const handleMove = (slug,e)=>{
        const [lat,lng] = [e.latLng.lat(),e.latLng.lng()];
       // window.open(`https://admin.bookofmormon.online/geo_place/?lat=${lat}&lng=${lng}&slug=${slug}`,'Coords','width=800,height=200,toolbar=no,menubar=no,location=no,status=no,scrollbars=no,resizable=no,left=0,top=0');
      }

      var markers = mapData.places.map((place) => {
        let image = {
          url: `${assetUrl}/map/markers/${place.slug}`,
          anchor: new google.maps.Point(place.ax, place.ay),
        },
          marker = new google.maps.Marker({
            position: { lat: place.lng, lng: place.lat },
            map: map,
            icon: image,
            title: place.slug,
            zoom: place.minZoom,
            maxZoom: place.maxZoom,
            draggable: false
          });

        marker.addListener('dragend', (e)=>handleMove(place.slug,e));

        if (placeSlug === place.slug) defaultMarker = marker;

        google.maps.event.addListener(marker, "click", (evt) => {
          managePlaceInfo(mapData.slug, marker.title, infoWindow, map, marker)
        })
        google.maps.event.addListener(infoWindow, 'closeclick', () => {
          updateUrl(`/map/${mapData.slug}`) // update URL
          setActiveInfoWindow(null)
        });
        return marker
      })
      // check map is assigne
      map && showZoomlevel(map.getZoom(), markers)
      google.maps.event.addListener(map, "zoom_changed", () => {
        // check map is assigne
        map && showZoomlevel(map.getZoom(), markers)
      })
      // open info windndow if place info fount in routing
      if (defaultMarker) openDefaultPopUp(mapData.slug, placeInfo, map, infoWindow, markers, defaultMarker)
    } catch (err) {
      console.log(err)
    }
  }

  // set zoom level of map
  const showZoomlevel = (zoom, markers) => {
    for (var i = 0; i < markers.length; i++) {
      if (markers[i].zoom <= zoom && markers[i].maxZoom >= zoom) {
        markers[i].setVisible(true)
      } else {
        markers[i].setVisible(false)
      }
    }
  }

  // open default pupup(info window) if url has place slug
  const openDefaultPopUp = (mapSlug, place, map, infoWindow, markers, marker) => {
    map.setZoom(place.minZoom) // set map zoom level
    map.setCenter(marker.position) // set infoWindow in centre
    showZoomlevel(place.minZoom, markers) // show marker
    managePlaceInfo(mapSlug, place.slug, infoWindow, map, marker)
  }

  // get place info and set place info
  const managePlaceInfo = (mapSlug, placeSlug, infoWindow, map, marker) => {

    if(isMobile())
    {

      return appController.functions.setPopUp({ 
        type: "places", 
        ids: [placeSlug], 
        underSlug: `/map/${mapSlug}`
       });

    }

    setActiveInfoWindow(infoWindow) // set active infow to close while change mapType
    updateUrl(`/map/${mapSlug}/place/${placeSlug}`) // update URL

    infoWindow.setContent(`<div id="infow-window"><img class='loader' src='${loading}'/></div>`);
    infoWindow.open(map, marker);
    let placeInfo = null;
    infoWindow.setContent(`<div id="infow-window"><img class='loader' src='${loading}'/></div>`);
    BoMOnlineAPI({ places: [placeSlug] }).then(({ places }) => {
      placeInfo = places[placeSlug];

      //console.log(places);
      setPlaceSlug(placeSlug)
      document.title = processName(placeInfo?.name) +  ` (${map.name}) `   + " | " + label("home_title");

      if (placeInfo) {
        infoWindow.setContent(`<div id="infow-window"><img class='loader' src='${loading}'/></div>`);
        // infoWindow.open(map, marker);

        google.maps.event.addListener(infoWindow, 'domready',
          () => {
            placeInfo && onInfowindowDomReady(placeInfo)
          });
      } else {
        infoWindow.setContent(`<img class="map-place-no-info" src="${loading}" />`)
        infoWindow.open(map, marker)
      }
    })
  }

  function onInfowindowDomReady(placeInfo) {
    const element = document.getElementById('infow-window')
    element && ReactDOM.render(<InfowindowContent placeInfo={placeInfo} push={push} appController={appController} />, document.getElementById('infow-window'))
    element && element.focus()
  }

  return mapData ? (
    <div id='tilemap' style={{ overflow: "hidden", height: '100vh', width: '100vw' }}>
      <div className='tilemap-data'></div>
    </div>
  ) : (
    <Loader />
  )
}

export default TileMap;
