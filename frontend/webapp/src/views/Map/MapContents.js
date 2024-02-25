
import React, { useEffect, useRef, useState } from 'react';
import BoMOnlineAPI, { assetUrl } from "../../models/BoMOnlineAPI";
import { CanvasMarker } from "./MapMarkers";
import { updatePlaceCoords } from '../Audit/Audit';

import mapIcon from "../_Common/svg/maps.svg";


const MapContents = ({mapController}) => {
    const mapElement = useRef(); // This ref will point to the map container
    const map = useRef(); // This ref will store the initialized map
    let {currentMap,isAdmin} = mapController;
    const {slug:mapslug,places} = currentMap;

    const {centerx, centery, minzoom, maxzoom, zoom} = currentMap;

    const panelSlug = mapController.panelContents.slug;
    const activePlace = places.find(i=>i.slug === panelSlug);


    const mapCenter = [activePlace?.lat || centery, activePlace?.lng || centerx];
    const minZoom = minzoom;
    const maxZoom = maxzoom;
    const iniZoom = activePlace?.minZoom || zoom;
    
const drawMap = ()=>{

    if (!window.ol) return console.error('OpenLayers library not found');

    const zoomLevel = map.current?.getView().getZoom();
    window.ol.zoomLevel = zoomLevel || 0;


    mapController.setZoomLevel(zoomLevel);
    
    map.current = new window.ol.Map({
        target: mapElement.current,
        layers: [new window.ol.layer.Tile({
            source: new window.ol.source.XYZ({
                url: `${assetUrl}/map/${mapslug}/{z}/{x}/{y}`, 
                tilePixelRatio: 2, 
                minZoom,  maxZoom
            })
        })],
        view: new window.ol.View({
            center: window.ol.proj.fromLonLat(mapCenter),
            zoom: iniZoom,
            minZoom: minZoom,
            maxZoom: maxZoom
        }),
        interactions: window.ol.interaction.defaults().extend([
            new window.ol.interaction.KeyboardPan(),
            new window.ol.interaction.KeyboardZoom()
        ])
    });
    function createIconStyle(i, isActive) {
        const hasActive = !!window.ol?.panelMapSlug;
        const dpr = window.devicePixelRatio || 1;
        const [height, width, anchor, src] = CanvasMarker({...i, isActive});
        const scale = 1 / dpr; // calculate scale based on device pixel ratio
        const image = new window.ol.style.Icon({ src, scale, anchor, opacity: isActive ? 1 : hasActive ? 1 : 1 });
        let iconStyle = new window.ol.style.Style({image});
        if(isActive) iconStyle.setZIndex(9999);

        let styles = [iconStyle];

        // If isActive is true, add a large red circle above the image
        if (isActive) {

            const relativeMargin = height > 50 ? 0.3 : 0.2; 

            const resolution = map.current.getView().getResolution();
            const mapPinStyle = new window.ol.style.Style({
                image: new window.ol.style.Icon({
                    src: "/img/pin.png",
                    scale: 0.5, // adjust the size as needed
                    anchor: [0.5, 1 + relativeMargin], // anchor at bottom center
                    anchorXUnits: 'fraction', // anchor units in fraction (relative to the icon)
                    anchorYUnits: 'fraction' // anchor units in fraction (relative to the icon)
                }),
                zIndex: 1
            });

            styles.push(mapPinStyle);

            // halo circle around the marker
            const padding = 2;
            const radius =(width/2) + padding;

            const haloStyle = new window.ol.style.Style({
                image: new window.ol.style.Circle({
                    radius,
                    anchor: [0.5, 0.5],
                    stroke: new window.ol.style.Stroke({
                        color: 'rgba(255, 255, 255, 0.2)',
                        width: 2
                    }),
                    fill: new window.ol.style.Fill({
                        color: 'rgba(255, 255, 255, 0.1)'
                    }),
                }),
                zIndex: 0
            });
            styles.push(haloStyle);



        }

        return [styles, width/dpr, height/dpr];
    }

    function getPlaceInfo(slug, appController) {
        const keys = Object.keys(appController.preLoad.placeList || {});
        const key = keys.find((key) => appController.preLoad.placeList[key].slug === slug);
        return key ? appController.preLoad.placeList[key] : {};
      }
    const view = map.current?.getView();
    const markers_tmp = places
    .map(i=>{
        const xy = [i.lat, i.lng];
        const { minZoom, maxZoom} = i;
        const name =  getPlaceInfo(i.slug, mapController.appController).name;
        i.name = name;
        const geometry  = new window.ol.geom.Point(window.ol.proj.fromLonLat(xy));
        const marker    = new window.ol.Feature({ geometry });
        let [iconStyle,width,height] = createIconStyle(i);
        let [iconStyleActive] = createIconStyle(i,true);
        marker.setStyle(()=>{
            const slug = window.ol?.panelMapSlug; //TODO: dont use global, get from mapController state
            const zoom = view.getZoom();
            if(zoom < minZoom || zoom > maxZoom) return null;
            if(i.slug === slug) return iconStyleActive;
            return iconStyle;
        });
        marker.set('name', name);
        marker.set('slug', i.slug);
        marker.set('minZoom', minZoom);
        marker.set('wh', [width, height]);
        return marker;
    })



    


    map.current.addLayer(
        new window.ol.layer.Vector({
          source: new window.ol.source.Vector({
            features: [...markers_tmp]
          }),
          style: function (feature, resolution) {
            console.log({feature,resolution});
          }
        })
      );



    // Extracted the repeated code into a separate function
    const setTooltipAndCursor = (isHovering, position, slug) => {
        const cursorStyle = isHovering ? 'pointer' : '';

        const isMoving =!!window.ol.isMoving


        const [x,y,w,h] = position || [0,0,0,0];
        mapElement.current.style.cursor = cursorStyle;
        if (isHovering && !isMoving) {
            //set cursor
            const mapTooltipFoundInDom = !!document.querySelector('.mapTooltip');
            if(mapTooltipFoundInDom) return;
            mapController.setTooltip({x, y, w, h,slug});

        } else {
            mapController.setTooltip({x: 0, y: 0, slug: null});
        }
    
    }



    map.current.on('pointermove', function(e) {
        if (e.dragging) return;

        const isHoveringOverMarker = map.current.forEachFeatureAtPixel(e.pixel, ()=>true);
        const markerSlug = map.current.forEachFeatureAtPixel(e.pixel, (feature) => feature.get('slug'));
        let markerPosition;
        map.current.forEachFeatureAtPixel(e.pixel, (feature) => {
            const geometry = feature.getGeometry();
            const coordinates = geometry.getCoordinates();
            const [x, y] = map.current.getPixelFromCoordinate(coordinates);
            const [w, h] = feature.get('wh') || [0,0];
            if(w === 0 || h === 0) return;
            markerPosition = [x, y, w , h];
            return true; 
        });
        setTooltipAndCursor(isHoveringOverMarker, markerPosition, markerSlug);
    });

    map.current.on('click', function(e) {
        map.current.forEachFeatureAtPixel(e.pixel, (feature) => {

            const slug = feature.get('slug');
            const [lat,lng] = feature.getGeometry().getCoordinates();
            const [x, y] = map.current.getPixelFromCoordinate([lat,lng]);   
            mapController.setPanelContents({slug, lat, lng});
            mapController.setTooltip({x, y, slug: null});
            window.ol.isMoving = true;
            setTimeout(()=>{
                markers_tmp.forEach(i=>i.changed());
                map.current.getView().animate({center: [lat,lng], duration: 500}, ()=>window.ol.isMoving = false);
               
            }, 0);
            
        });
    });

    map.current.getView().on('change:resolution', function(e) {
        const zoomLevel = map.current?.getView().getZoom() || 0;
        window.ol.zoomLevel = zoomLevel;
        if(!mapController.panelContents) return;
        mapController.setZoomLevel(zoomLevel);
    });

    if(isAdmin){
        console.log("Admin mode");
        var modify = new window.ol.interaction.Modify({ 
            features: new window.ol.Collection(markers_tmp),
            style: ()=>[],
            hitTolerance: 1000 // Increase this value to increase the draggable area
        });
        modify.on('modifystart', (e) => {
            setTooltipAndCursor(false);
        });
        modify.on('modifyend', (e) => {

            const item = e.features.getArray()
            .sort(()=>Math.random()-0.5)[0];
            var coords = item.getGeometry().getCoordinates();
            var lonLatCoords = window.ol.proj.transform(coords, 'EPSG:3857', 'EPSG:4326');
            const {token}  = mapController.appController.states.user;
            const map = mapController.currentMap?.slug;
            const slug = item.get('slug');

            const [lat,lng] = lonLatCoords;
            updatePlaceCoords({lat,lng,map,slug,token}).then((success)=>{
                if(success){
                    console.log(`Coords updated for ${slug} to ${lat},${lng}`);
                    //delete  map.{mapSlug} key from BoMCache.items indexDB
                    let databaseName = "BoMCache";
                    var request = indexedDB.open(databaseName, 1);
                    request.onsuccess = function (event) {
                        var db = event.target.result;
                        var transaction = db.transaction(["items"], "readwrite");
                        var objectStore = transaction.objectStore("items");
                        var objectStoreRequest = objectStore.delete(`map.${mapslug}`);
                        objectStoreRequest.onsuccess = function(event) {
                            console.log(`Deleted map.${mapslug} from BoMCache.items indexDB`);
                        };
                    };
                }
                else{
                    console.error(`Coords update failed for ${slug} to ${lat},${lng}`);
                }
            }).catch((e)=>{
                console.error(`Coords update failed for ${slug} to ${lat},${lng}`,e);
            });

        });
        map.current.addInteraction(modify);
    }else{
        console.log("Not admin mode", {mapController});
    }



    return () => { 
        if (map.current) map.current.setTarget(undefined);  
       if(isAdmin) map.current.removeInteraction(modify);
    };


}


    useEffect(drawMap, [mapslug,isAdmin]);

    useEffect(async () => {
        //wait 500ms for the map to be drawn
        //set slug into global space
        window.ol.panelMapSlug = mapController.panelContents.slug;
        const markers = map.current.getLayers().getArray()[1].getSource().getFeatures();
        markers.forEach(i=>i.changed());
        await new Promise(resolve => setTimeout(resolve, 500));
        map.current.updateSize();
        //trigger click on the active place
        const activePlace = mapController.panelContents.slug;
        const activeMarker = markers.find(i=>i.get('slug') === activePlace);
        if(activeMarker){
            const [lat,lng] = activeMarker.getGeometry().getCoordinates();
            const minZoom = activeMarker.get('minZoom');
            const zoomTo = Math.max(minZoom, window.ol.zoomLevel);
            setTimeout(() => {
                map.current.getView().animate({
                    center: [lat, lng],
                    zoom: zoomTo,
                    duration: 500
                });
            }, 0);
            //zoom to the active place minZoom

        }

    }, [mapController.panelContents.slug]);



    return <>
    <div id="map" ref={mapElement} ></div>
    </>
};





export default MapContents;