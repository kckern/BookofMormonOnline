
import React, { useEffect, useRef } from 'react';
import BoMOnlineAPI, { assetUrl } from "../../models/BoMOnlineAPI";
import { CanvasMarker } from "./MapMarkers";


const MapContents = () => {
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
        {  name: "Town", xy: [-112.337377, 31.047839], location_type: "town"  },
        {  name: "New York", xy: [-113.337377, 27.047839], location_type: "city"  },
        {  name: "City Sea", xy: [-113.337377, 30.047839], location_type: "city_right"  },
        {  name: "Zarahemla", xy: [-113.337377, 28.047839], location_type: "land"  },
        {  name: "서울", xy: [-111.337377, 29.047839], location_type: "region"  },
        {  name: "Land of Nephi", xy: [-112.337377, 26.047839], location_type: "geo"  },
        {  name: "Sea/South", xy: [-112.337377, 25.047839], location_type: "aqua"  },
    ]
    .map(i=>{

        const {minResolution, maxResolution} = i;
        const [height, width, anchor, src] = CanvasMarker({...i});
        const geometry  = new window.ol.geom.Point(window.ol.proj.fromLonLat(i.xy));
        const image     = new window.ol.style.Icon({ src, size: [width, height], anchor });
        let iconStyle   = new window.ol.style.Style({image, minResolution, maxResolution});
        const marker    = new window.ol.Feature({ geometry });
        marker.setStyle(iconStyle);
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



    //onhover cursor pointer
    map.current.on('pointermove', function(e) {
        if (e.dragging) return;
        var pixel = map.current.getEventPixel(e.originalEvent);
        var hit = map.current.forEachFeatureAtPixel(pixel, function(feature) {
            return true;
        });
        map.current.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });


    



    // ADMIN ONLY: On marker Drag Function, Move the marker and get the new coordinates
    if(isAdmin){
        var modify = new window.ol.interaction.Modify({ 
            features: new window.ol.Collection(markers)
        });
        modify.on('modifyend', (e)=>alert(JSON.stringify(e.features.getArray()[0].getGeometry().getCoordinates())));
        map.current.addInteraction(modify);
    }


    return () => { 
        if (map.current) map.current.setTarget(undefined);  
        map.current.removeInteraction(modify);
    };


}

    useEffect(drawMap, []);

    return <div id="map" ref={mapElement} ></div>
};





export default MapContents;