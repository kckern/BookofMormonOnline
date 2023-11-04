import React, { useState } from 'react';
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