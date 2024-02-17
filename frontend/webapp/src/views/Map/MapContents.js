import React, { useEffect, useState } from 'react';
import {
    interaction, layer, custom, control, //name spaces
    Interactions, Overlays, Controls,     //group
    Map, Layers, Overlay, Util    //objects
} from "react-openlayers";

import * as ol from 'openlayers';
import Loader from "../_Common/Loader";

const MapContents = ({ currentMap, placeName, updateUrl, appController }) => {
    const [source, setSource] = useState(null);

    useEffect(() => {
        setSource(new ol.source.XYZ({
            url: 'https://media.bookofmormon.online/map/malay3/{z}/{x}/{y}',
            projection: 'EPSG:4326'
        }));
    }, []);

    const showPopup = (evt) => {
        alert("showPopup");
    }

    if(!appController.states.preloaded) return <Loader />

    return source ? <Map view={{center: [0, 0], zoom: 2}} >
        <Layers>
            <layer.Tile rename_me_to_source={source} />
        </Layers>
        <Controls attribution={false} zoom={true}>
            <control.ScaleLine />
            <control.FullScreen />
            <control.OverviewMap />
            <control.Zoom />
        </Controls>
        <Interactions>
            <interaction.KeyboardPan />
            <interaction.KeyboardZoom />
        </Interactions>
    </Map> : null;
}

export default MapContents;