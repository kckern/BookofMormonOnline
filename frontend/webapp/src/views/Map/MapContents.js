
import React, { useCallback, useEffect, useRef, useState } from 'react';
import BoMOnlineAPI, { assetUrl } from "../../models/BoMOnlineAPI";
import { CanvasMarker } from "./MapMarkers";
import { updatePlaceCoords } from '../Audit/Audit';
import { isMobile } from "../../models/Utils";

import mapIcon from "../_Common/svg/maps.svg";
import { useParams } from "react-router-dom"


const MapContents = ({mapController}) => {
    const mapElement = useRef(); // This ref will point to the map container
    const map = useRef(); // This ref will store the initialized map
    let {currentMap,isAdmin} = mapController;
    const {slug:mapslug,places,stories} = currentMap;
		const [animateZoom,setAnimateZoom] = useState(0);
		const [isMoving,setIsMoving] = useState(false);

    const {centerx, centery, minzoom, maxzoom, zoom} = currentMap;

    const panelSlug = mapController.panelContents.slug;
    const activePlace = places.find(i=>i.slug === panelSlug);
		const [activeStyleIcons,setActiveStyleIcons] = useState({
			activeIcon:'',
			icons:[]
		});
		const [styleIcons,setStyleIcons]=useState([]);


    const mapCenter = [activePlace?.lat || centery, activePlace?.lng || centerx];
    const minZoom = minzoom;
    const maxZoom = maxzoom;
    const iniZoom =  activePlace?.minZoom || zoom;

		const keyDownHandler = (event)=>{
			if(event.key === 'Tab'){
				event.preventDefault();
				const markers = map.current.getLayers().getArray()[1].getSource().getFeatures().sort((a,b)=>a.A.name > b.A.name?1:-1);
				let slug = null;
				let cordsLatLng = null;
				let cordsXY = null;
				if(activePlace?.slug){
					const activeMarkerIndex = markers.findIndex(i=>i.get('slug') === activePlace?.slug);
					if(activeMarkerIndex === markers.length -1){
						slug = markers[0].get('slug');
            cordsLatLng = markers[0].getGeometry().getCoordinates();
            cordsXY = map.current.getPixelFromCoordinate(cordsLatLng);
					}else{
						slug = markers[activeMarkerIndex + 1].get('slug');
            cordsLatLng = markers[activeMarkerIndex + 1].getGeometry().getCoordinates();
            cordsXY = map.current.getPixelFromCoordinate(cordsLatLng);
					}
				}else{
					slug = markers[0].get('slug');
					cordsLatLng = markers[0].getGeometry().getCoordinates();
					cordsXY = map.current.getPixelFromCoordinate(cordsLatLng);	
				}   

			  mapController.setPanelContents({slug, ...cordsLatLng});
				mapController.setTooltip({...cordsXY, slug: null});
				setIsMoving(true);
				setTimeout(()=>{
						markers.forEach(i=>i.changed());
						map.current.getView().animate({center: cordsLatLng, duration: 500}, ()=>setIsMoving(false));
				}, 0);
				setTimeout(()=>{
					window.focus();
				},0)
			}

            const view = map.current.getView();
          
            const zoomOutChars = ["_","-","["];
            const zoomInChars = ["+","=","]"];

            
            if ([...zoomOutChars, ...zoomInChars].includes(event.key)) {
                event.preventDefault();
                const currentZoom = view.getZoom();
                const newZoom = currentZoom + ((zoomOutChars.includes(event.key) ? -1 : 1)/2);
                view.animate({zoom: newZoom, duration: 500});
            }
        }

    
const drawMap = ()=>{

    if (!window.ol) return console.error('OpenLayers library not found');
		setAnimateZoom(mapController.zoomLevel || iniZoom);
    mapController.setZoomLevel(iniZoom);
    mapController.setMapCenter({lat: mapCenter[0], lng: mapCenter[1]});
    
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
        interactions: window.ol.interaction.defaults({KeyboardPan: false, KeyboardZoom: false}).extend([
            new window.ol.interaction.KeyboardPan({ pixelDelta: 64})
            //new window.ol.interaction.KeyboardZoom(),
        ]),
				keyboardEventTarget:window
    });
    function createIconStyle(i, isActive) {
        const hasActive = !!activePlace;
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
    const markers = places
    .map(i=>{
        const xy = [i.lat, i.lng];
        const { minZoom, maxZoom} = i;
        const name =  getPlaceInfo(i.slug, mapController.appController).name;
        i.name = name;
        const geometry  = new window.ol.geom.Point(window.ol.proj.fromLonLat(xy));
        const marker    = new window.ol.Feature({ geometry });
        let [iconStyle,width,height] = createIconStyle(i);
        let [iconStyleActive] = createIconStyle(i,true);
				setActiveStyleIcons(prev=>({
					...prev,
					icons:[...prev.icons,{slug:i.slug,icon:iconStyleActive}]
				}));
				setStyleIcons(prev=>([...prev,{slug:i.slug,icon:iconStyle}]));
        marker.setStyle(()=>{
            const zoom = view.getZoom();
            if(zoom < minZoom || zoom > maxZoom) return null;
            return iconStyle;
        });
        marker.set('name', name);
        marker.set('slug', i.slug);
        marker.set('minZoom', minZoom);
        marker.set('wh', [width, height]);
        return marker;
    })


    const moves = stories?.map(s=>s.moves).flat() || [];
    const lines =  moves.map((m,i)=>{
        return [[m.startPlace.lat, m.startPlace.lng], [m.endPlace.lat, m.endPlace.lng]];
    })?.map(([start,end],i)=>{
        //trim to 4 decimal places
        start = [parseFloat(start[0]), parseFloat(start[1])];
        end = [parseFloat(end[0]), parseFloat(end[1])];
        const startCoords = window.ol.proj.fromLonLat(start);
        const endCoords = window.ol.proj.fromLonLat(end);
        const line =  new window.ol.Feature({
            geometry: new window.ol.geom.LineString([
                startCoords, endCoords
            ])
        });
        return line;
    });

		map.current.addLayer(
			new window.ol.layer.Vector({
				source: new window.ol.source.Vector({
					features: [...markers]
				}),
				style: function (feature, resolution) {
					console.log({feature,resolution});
				}
			})
		);

    map.current.addLayer(
        new window.ol.layer.Vector({
            source: new window.ol.source.Vector({
                features: []// [...lines]
            }),
            style: function (feature, resolution) {
                return new window.ol.style.Style({
                    stroke: new window.ol.style.Stroke({
                        color: '#FF000044',
                        lineDash: [10, 10],
                        lineDashOffset: 0,
                        width: 3
                    })
                });
            }
        })
    );





    // Extracted the repeated code into a separate function
    const setTooltipAndCursor = (isHovering, position, slug) => {
        const cursorStyle = isHovering ? 'pointer' : '';

        const isMovingValue =!!isMoving


        const [x,y,w,h] = position || [0,0,0,0];
        mapElement.current.style.cursor = cursorStyle;
        if (isHovering && !isMovingValue) {
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

             if(isMobile())  mapController.appController.functions.setPopUp({ type: "places", ids: [slug] });
             else    mapController.setPanelContents({slug, lat, lng});
      
            mapController.setTooltip({x, y, slug: null});
            setIsMoving(true);
            setTimeout(()=>{
                markers.forEach(i=>i.changed());
                map.current.getView().animate({center: [lat,lng], duration: 500}, ()=>setIsMoving(false));
            }, 0);
            
        });
    });

    map.current.getView().on('change:resolution', function(e) {
        const zoomLevel = map.current?.getView().getZoom() || 0;
        if(!mapController.panelContents) return;
        mapController.setZoomLevel(zoomLevel);
    });

    //on pan map setMapCenter
    map.current.getView().on('change:center', function(e) {
        const center = map.current?.getView().getCenter();
        const [lat,lng] = window.ol.proj.transform(center, 'EPSG:3857', 'EPSG:4326');
        mapController.setMapCenter({lat,lng});
    });

    if(isAdmin){
        console.log("Admin mode");
        var modify = new window.ol.interaction.Modify({ 
            features: new window.ol.Collection(markers),
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

		useEffect(()=>{
			window.addEventListener('keydown',keyDownHandler);
			return ()=>{
				window.removeEventListener('keydown',keyDownHandler);
			} 
			},[mapslug,activePlace?.slug])

    useEffect(async () => {
        //wait 500ms for the map to be drawn
        //set slug into global space
        const markers = map.current.getLayers().getArray()[1].getSource().getFeatures();
        markers.forEach(i=>i.changed());
        await new Promise(resolve => setTimeout(resolve, 500));
        map.current.updateSize();
				map.current.getView().on('change:resolution', function(e) {
					const zoomLevel = map.current?.getView().getZoom() || 0;
					if(!mapController.panelContents) return;
					mapController.setZoomLevel(zoomLevel);
			});
        //trigger click on the active place
        const activePlace = mapController.panelContents.slug;
        const activeMarker = markers.find(i=>i.get('slug') === activePlace);
        if(activeMarker){
					if(activeStyleIcons.activeIcon){
						const existedActiveMarker = markers.find(i=>i.get('slug') === activeStyleIcons.activeIcon);
						existedActiveMarker.setStyle(()=>{
							const zoom = map.current?.getView()?.getZoom();
							if(zoom < minZoom || zoom > maxZoom) return null;
							return styleIcons.find(icon=>icon?.slug === activeStyleIcons.activeIcon)?.icon;
					});
					}
					activeMarker.setStyle(()=>{
							const zoom = map.current?.getView()?.getZoom();
							if(zoom < minZoom || zoom > maxZoom) return null;
							return activeStyleIcons.icons.find(icon=>icon.slug === activePlace)?.icon;
					});
					setActiveStyleIcons(prev=>({
						...prev,
						activeIcon:activePlace
					}));
            const [lat,lng] = activeMarker.getGeometry().getCoordinates();
            const minZoom = activeMarker.get('minZoom');
            const zoomTo = Math.max(minZoom, animateZoom);
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