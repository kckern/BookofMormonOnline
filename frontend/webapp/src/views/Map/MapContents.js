
import React, { useEffect, useRef } from 'react';
import BoMOnlineAPI, { assetUrl } from "../../models/BoMOnlineAPI";


const CanvasMarker = ({ name, style }) => {

    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    const fontSize = 20;
    const fontString = `${fontSize}px 'Roboto Condensed'`;

    const iconPadding = 5;
    context.font = fontString;
    let metrics = context.measureText(name);
    const textWidth = metrics.width;
    let fontHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
    const diff = fontHeight - fontSize;
    const iconWidth = fontHeight;


    canvas.width = textWidth + iconWidth + iconPadding;
    canvas.height = fontHeight;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(iconWidth, 0);
    context.lineTo(iconWidth/2, iconWidth);
    context.closePath();
    context.fillStyle = style.fill;
    context.fill();


    //set the font
    context.font = fontString;
    
    context.lineWidth = 3;
    context.strokeStyle = "#FFFFFF"; // Use strokeStyle for the outline
    context.strokeText(name, iconWidth + iconPadding, fontHeight - (diff *2) ); // Draw the outline

    //thin black text, no stroke
    context.lineWidth = 1;
    context.fillStyle = "#000000"; // Fill should be black
    context.fillText(name, iconWidth + iconPadding, fontHeight - (diff *2)); // Draw the filled text


    

    return canvas.toDataURL();

};




const MapContents = () => {
    const mapElement = useRef(); // This ref will point to the map container
    const map = useRef(); // This ref will store the initialized map

    const isAdmin = true;

    const mapslug = "baja";
    const mapCenter = [-113.337377, 27.047839];
    const mapBounds = [-117.729321, 22.298062, -108.945432, 31.797617];
    const minZoom = 4;
    const maxZoom = 9;
    const iniZoom = 6;

    const markers = [
        {  name: "New York", coords: [-113.337377, 27.047839], style: { fill: "#6b7d91" }  },
        {  name: "Zarahemla", coords: [-113.337377, 28.047839], style: { fill: "#6b7d91" }  },
        {  name: "서울", coords: [-111.337377, 29.047839], style: { fill: "#6b7d91" }  },
        {  name: "Land of Nephi", coords: [-112.337377, 26.047839], style: { fill: "#6b7d91" }  },
    ]
    .map(i=>{
        const marker = new window.ol.Feature({
            geometry: new window.ol.geom.Point(window.ol.proj.fromLonLat(i.coords)),
            anchor: [0.5, 1],

        });
    
        let iconStyle = new window.ol.style.Style({
            image: new window.ol.style.Icon({
                src: CanvasMarker({...i}),
                scale: 1,
            })
        });
    
       marker.setStyle(iconStyle);
    
        return marker;
    });

    

    useEffect(() => {
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


    }, []);

    return <div id="map" ref={mapElement} ></div>
};

export default MapContents;