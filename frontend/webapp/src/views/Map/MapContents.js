
import React, { useEffect, useRef, useState } from 'react';
import BoMOnlineAPI, { assetUrl } from "../../models/BoMOnlineAPI";
import { CanvasMarker } from "./MapMarkers";


const MapContents = ({mapController}) => {
    const mapElement = useRef(); // This ref will point to the map container
    const map = useRef(); // This ref will store the initialized map
    const {currentMap} = mapController;
    const {slug:mapslug,places} = currentMap;

    const {centerx, centery, minzoom, maxzoom, zoom} = currentMap;

    const isAdmin = true;


    const mapCenter = [centery, centerx];
    const minZoom = minzoom;
    const maxZoom = maxzoom;
    const iniZoom = zoom;
    
const drawMap = ()=>{

    if (!window.ol) return console.error('OpenLayers library not found');
    
    map.current = new window.ol.Map({
        target: mapElement.current,
        layers: [new window.ol.layer.Tile({
            source: new window.ol.source.XYZ({
                url: `${assetUrl}/maptiles/${mapslug}/{z}/{x}/{y}`, 
                tilePixelRatio: 1, minZoom,  maxZoom
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

    function createIconStyle(i,isActive) {
        const [height, width, anchor, src] = CanvasMarker({...i, isActive});
        const image     = new window.ol.style.Icon({ src, size: [width, height], anchor });
        let iconStyle   = new window.ol.style.Style({image});
        return [iconStyle,height];
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
        console.log({i});
        const geometry  = new window.ol.geom.Point(window.ol.proj.fromLonLat(xy));
        const marker    = new window.ol.Feature({ geometry });
        let [iconStyle,height] = createIconStyle(i);
        let [iconStyleActive] = createIconStyle(i,true);
        marker.setStyle(()=>{
            const slug = window.ol.panelMapSlug; //TODO: dont use global, get from mapController state
            const zoom = view.getZoom();
            if(zoom < minZoom || zoom > maxZoom) return null;
            if(i.slug === slug) return iconStyleActive;
            return iconStyle;
        });
        marker.set('name', name);
        marker.set('slug', i.slug);
        marker.set('label_height', height);
        return marker;
    });
    


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
        const [x,y,w,h] = position || [0,0,0,0];
        mapElement.current.style.cursor = cursorStyle;
        if (isHovering) {
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
            const style = feature.getStyle();
            if(!style) return;
            if(!style.getImage) return;
            const [w,h] = style.getImage()?.getSize();
            markerPosition = [x, y, w , h];
            return true; 
        });
        setTooltipAndCursor(isHoveringOverMarker, markerPosition, markerSlug);
    });

    //on click alert the marker name
    map.current.on('click', function(e) {
        map.current.forEachFeatureAtPixel(e.pixel, (feature) => {
            mapController.setPanelContents({slug: feature.get('slug')});
            const coords = feature.getGeometry().getCoordinates();
            mapController.setTooltip({x: coords[0], y: coords[1], slug: null});
            map.current.getView().animate({center: coords, duration: 500});
            markers_tmp.forEach(i=>i.changed());
        });
    });
    

    if(isAdmin){
        var modify = new window.ol.interaction.Modify({ 
            features: new window.ol.Collection(markers_tmp),
            style: ()=>[],
            hitTolerance: 1000 // Increase this value to increase the draggable area
        });
        modify.on('modifystart', (e) => {
            setTooltipAndCursor(false);
        });
        modify.on('modifyend', (e) => {
            var coords = e.features.getArray()[0].getGeometry().getCoordinates();
            var lonLatCoords = window.ol.proj.transform(coords, 'EPSG:3857', 'EPSG:4326');
            alert(JSON.stringify(lonLatCoords));
            console.log(e.features.getArray());
        });
        map.current.addInteraction(modify);
    }


    mapController.setMapFunctions({
        selectPlace: (slug) => {
            slug = "midian";
            const feature = map.current.getLayers().getArray()[1].getSource().getFeatures().find(i=>i.get('slug') === slug);
            const coords = feature.getGeometry().getCoordinates();
            map.current.getView().animate({center: coords, duration: 500});
            //set tooltip
            setTooltipAndCursor(true, coords, slug);
            //TODO: Highlight the marker
            //TODO: Zoom if needed
        }
    });



    return () => { 
        if (map.current) map.current.setTarget(undefined);  
        map.current.removeInteraction(modify);
    };


}


    useEffect(drawMap, [mapslug]);

    useEffect(async () => {

        map.current.updateSize();
        //set slug into global space
        window.ol.panelMapSlug = mapController.panelContents.slug;
        const markers = map.current.getLayers().getArray()[1].getSource().getFeatures();
        markers.forEach(i=>i.changed());


    }, [mapController.panelContents.slug]);



    return <>
    <div id="map" ref={mapElement} ></div>
    </>
};





export default MapContents;