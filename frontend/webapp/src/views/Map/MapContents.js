
import React, { useEffect, useRef, useState } from 'react';
import BoMOnlineAPI, { assetUrl } from "../../models/BoMOnlineAPI";
import { CanvasMarker } from "./MapMarkers";


const MapContents = ({mapController}) => {
    const mapElement = useRef(); // This ref will point to the map container
    const map = useRef(); // This ref will store the initialized map

    const isAdmin = true;

    const mapslug = "baja";
    const mapCenter = [-113.337377, 27.047839];
    const mapBounds = [-117.729321, 22.298062, -108.945432, 31.797617];
    const minZoom = 6;
    const maxZoom = 9;
    const iniZoom = 6;

    const markers = [
        {  name: "Town", xy: [-112.337377, 31.047839], location_type: "town"  , slug: "midian" },
        {  name: "New York", xy: [-113.337377, 27.047839], location_type: "city" , slug: "hill-cumorah" },
        {  name: "City Sea", xy: [-113.337377, 30.047839], location_type: "city_right" , slug: "city-by-the-sea" },
        {  name: "Zarahemla", xy: [-113.337377, 28.047839], location_type: "land" , slug: "zarahemla" },
        {  name: "서울", xy: [-111.337377, 29.047839], location_type: "region",  maxResolution: 6 , slug: "valley-of-alma" },
        {  name: "Land of Nephi", xy: [-112.337377, 26.047839], location_type: "geo" , slug: "land-of-nephi" },
        {  name: "Sea/South", xy: [-112.337377, 25.047839], location_type: "aqua", slug: "sea-south" },
    ]
    .map(i=>{

        const {minResolution = minZoom, maxResolution = maxZoom} = i;
        const [height, width, anchor, src] = CanvasMarker({...i});
        const geometry  = new window.ol.geom.Point(window.ol.proj.fromLonLat(i.xy));
        const image     = new window.ol.style.Icon({ src, size: [width, height], anchor });
        let iconStyle   = new window.ol.style.Style({image, minResolution, maxResolution});
        const marker    = new window.ol.Feature({ geometry });
        marker.setStyle(iconStyle);
        marker.set('name', i.name);
        marker.set('slug', i.slug);
        return marker;
    });
    
const drawMap = ()=>{

    if (!window.ol) return console.error('OpenLayers library not found');
    
    map.current = new window.ol.Map({
        target: mapElement.current,
        layers: [new window.ol.layer.Tile({
            extent: window.ol.proj.transformExtent(mapBounds, 'EPSG:4326', 'EPSG:3857'),
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
        })
    });

    map.current.addLayer(new window.ol.layer.Vector({ source: new window.ol.source.Vector({ features: [...markers] }) }));

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
            const resolution = map.current.getView().getResolution();
            const extent = geometry.getExtent();

            //Calculate the XY position of the marker relative to the map current view
            const [x, y] = map.current.getPixelFromCoordinate(coordinates);
            const [w, h] = feature.getStyle().getImage().getSize();

        
            markerPosition = [x, y, w, h];
            return true; // Stop the forEachFeatureAtPixel loop after the first feature
        });
        setTooltipAndCursor(isHoveringOverMarker, markerPosition, markerSlug);
    });

    //on click alert the marker name
    map.current.on('click', function(e) {
        map.current.forEachFeatureAtPixel(e.pixel, (feature) => {
            var coords = feature.getGeometry().getCoordinates();
            var lonLatCoords = window.ol.proj.transform(coords, 'EPSG:3857', 'EPSG:4326');
            alert(feature.get('name') + ' ' + JSON.stringify(lonLatCoords));
        });
    });
    


    if(isAdmin){
        var modify = new window.ol.interaction.Modify({ 
            features: new window.ol.Collection(markers),
            style: ()=>[]
        });
        modify.on('modifyend', (e) => {
            var coords = e.features.getArray()[0].getGeometry().getCoordinates();
            var lonLatCoords = window.ol.proj.transform(coords, 'EPSG:3857', 'EPSG:4326');
            alert(JSON.stringify(lonLatCoords));
            //then alert the marker name
            console.log(e.features.getArray());
        });
        map.current.addInteraction(modify);
    }

    return () => { 
        if (map.current) map.current.setTarget(undefined);  
        map.current.removeInteraction(modify);
    };


}

    useEffect(drawMap, []);

    return <>
    <pre>{JSON.stringify(mapController.tooltip.slug)}</pre>
    <div id="map" ref={mapElement} ></div>
    </>
};





export default MapContents;