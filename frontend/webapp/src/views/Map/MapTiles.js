import React, { useEffect, useState } from 'react';
import { Map, Marker, InfoWindow, GoogleApiWrapper } from 'google-maps-react-17';

const MapContainer = ({ google, mapData, placeName, updateUrl, appController }) => {
    const [selectedPlace, setSelectedPlace] = useState({});
    const [activeMarker, setActiveMarker] = useState(null);
    const [showingInfoWindow, setShowingInfoWindow] = useState(false);

    const onMarkerClick = (props, marker) => {
        setSelectedPlace(props);
        setActiveMarker(marker);
        setShowingInfoWindow(true);
    };

    const onMapClicked = () => {
        if (showingInfoWindow) {
            setShowingInfoWindow(false);
            setActiveMarker(null);
        }
    };

    useEffect(() => {

        //update tile retrieval function
        if(!google?.map) return;
        alert("google map loaded")
        google.map.ImageMapType({
            getTileUrl: function (coord, zoom) {
                /*
              var normalizedCoord = getNormalizedCoord(coord, zoom)
              if (!normalizedCoord) return null
              var bound = Math.pow(2, zoom)
              return `${assetUrl}/tile/${mapData.slug}/${zoom}/${normalizedCoord.x
                }/${bound - normalizedCoord.y - 1}`
                */
            },
            tileSize: new google.maps.Size(256, 256),
            maxZoom: 10,
            minZoom: 4,
            name: "mapData.name",
          })


    }, [google?.map])

    return (
        <Map google={google} onClick={onMapClicked}>
            <Marker
                onClick={onMarkerClick}
                name={'Current location'}
            />
            <InfoWindow
                marker={activeMarker}
                visible={showingInfoWindow}
            >
                <div>
                    <h1>{selectedPlace.name}</h1>
                </div>
            </InfoWindow>
        </Map>
    );
};

const BoMGoogleApiWrapper = GoogleApiWrapper((props) => {
    return { apiKey: props.appController.preLoad.labels.gmaps };
});

const WrappedMapContainer = BoMGoogleApiWrapper(MapContainer);

export default WrappedMapContainer;