
import React from "react";
import { assetUrl } from 'src/models/BoMOnlineAPI';
import { label, processName, replaceNumbers } from "src/models/Utils"
import { BrowserRouter } from "react-router-dom";
import { renderPersonPlaceHTML } from "../Page/PersonPlace";
import ReactTooltip from "react-tooltip";

export default function InfowindowContent({ placeInfo, push, appController }) {
    return (
        <BrowserRouter>
            <div className="map-info">
                <div style={{ overflow: "auto" }}>
                    <div className="placebox">
                        <div className="ppbody">
                            <h3>
                                {processName(placeInfo.name)}<br />
                                <small className="map-place-brief-info">
                                    {replaceNumbers(placeInfo.info)}
                                </small>
                            </h3>
                            <div className="refbox">
                                <h4>{label("references")}</h4>
                                <ol className="sd">{
                                    placeInfo.index &&
                                    placeInfo.index.map((reference, index) => {
                                        return <li key={index}
                                            data-tip={reference.ref}
                                            data-for='info-place-person'
                                        >
                                            <span className="ppref" onClick={() => push("/" + reference.slug)}>{replaceNumbers(reference.text)}</span>
                                        </li>
                                    })}
                                </ol>
                                <ReactTooltip
                                    place="left"
                                    effect="solid"
                                    backgroundColor={"#666"}
                                    arrowColor={"#666"}
                                    html={true}
                                    id='info-place-person'
                                />
                            </div>
                            <div className="bodytext map-place-info">
                                <div className="ppimg map-place-image">
                                    <img src={`${assetUrl}/places/${placeInfo.slug}`} />
                                </div>
                                {renderPersonPlaceHTML(placeInfo.description, appController)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </BrowserRouter>
    )
}