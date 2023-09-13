
import { Alert, Button, Card, CardBody, CardFooter, CardHeader, Label } from "reactstrap"
import { label } from "src/models/Utils"
import Switch from "react-bootstrap-switch";
import { useEffect, useState } from "react";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import "./Preferences.css"

import audio from "src/views/_Common/svg/audio.svg"
import autoplay from "src/views/_Common/svg/autoplay.svg"
import commentary from "src/views/_Common/svg/commentary.svg"
import illustrations from "src/views/_Common/svg/illustrations.svg"
import preferences from "src/views/_Common/svg/preferences.svg"
import sound from "src/views/_Common/svg/sound.svg"
import facsimiles from "src/views/_Common/svg/fax.svg"


export default function User({ appController }) {

    useEffect(()=>document.title = label("preferences") + " | " + label("home_title"),[])

    const [publications, setPublications] = useState(null);
    const [loading, setLoading] = useState(false);
    if (!publications && !loading) {
        setLoading(true);
        BoMOnlineAPI({ publications: true }).then(result => {
            setPublications(result.publications);
        })
    }
    const toggleValue = (value) => {
        let prefs = appController.states.preferences;
        prefs[value] = !prefs[value];
        appController.functions.updatePrefs(prefs);
    }
    const toggleAudio = () => toggleValue("audio");
    const toggleAutoPlay = () => toggleValue("autoplay");
    const toggleSound = () => toggleValue("sound");
    const toggleArt = () => toggleValue("art");

    const toggleCommentary = () => {
        let prefs = appController.states.preferences;
        prefs.commentary.on = !prefs.commentary.on;
        appController.functions.updatePrefs(prefs);
    }
    const toggleFax = () => {
        let prefs = appController.states.preferences;
        prefs.facsimiles.on = !prefs.facsimiles.on;
        appController.functions.updatePrefs(prefs);
    }
    const toggleCommentarySource = (e, source_id) => {
        e.preventDefault();
        let prefs = appController.states.preferences;
        let sources = prefs.commentary.filter.sources;
        if (sources.includes(source_id)) {
            const index = sources.indexOf(source_id);
            if (index > -1) {
                sources.splice(index, 1);
            }
        }
        else {
            sources.push(source_id);
        }
        prefs.commentary.filter.sources = sources;
        appController.functions.updatePrefs(prefs);
    }

    const toggleFaxVersion = (e, version_slug) => {
        e.preventDefault();
        let prefs = appController.states.preferences;
        let versions = prefs.facsimiles.filter.versions;
        if (versions.includes(version_slug)) {
            const index = versions.indexOf(version_slug);
            if (index > -1) {
                versions.splice(index, 1);
            }
        }
        else {
            versions.push(version_slug);
        }
        prefs.facsimiles.filter.versions = versions;
        appController.functions.updatePrefs(prefs);
    }


    let pubs = publications?.map((publication,i) => <Label key={i} rating={publication.source_rating} onClick={(e) => toggleCommentarySource(e, parseInt(publication.source_id))}><Card className={"publicationCard"} >
        <CardHeader>
            <input
                type="checkbox"
                readOnly
                checked={!appController.states.preferences.commentary.filter.sources.includes(parseInt(publication.source_id))}
            />
            <div>
            <div className="source_title">{publication.source_title}</div>
            <div className="source_name">{publication.source_name}</div>
            <div className="source_publisher">© {publication.source_year || 2000}, {publication.source_publisher}</div>
            </div>
        </CardHeader>

        <CardBody className={"publicationCardBody"}>
            <img src={`${assetUrl}/source/cover/${publication.source_id.padStart(3, '0')}`} />

            <div>{publication.source_description}</div>
        </CardBody>
    </Card></Label>)

    let faxs = Object.values(appController.preLoad.fax).map((fax,i) => <Label key={i} onClick={(e) => toggleFaxVersion(e, fax.slug)}><Card className={"faxCard"} >
        <CardHeader className={"faxCardHead"}>
            <input
                type="checkbox"
                readOnly
                checked={!appController.states.preferences.facsimiles.filter.versions.includes(fax.slug)}
            />
            <b>{fax.title}</b>
        </CardHeader>

        <CardBody className={"faxCardBody"}>

            <img src={`${assetUrl}/fax/covers/${fax.slug}`} />
            <div>
                <i>{fax.info}</i>
            </div>
        </CardBody>
    </Card></Label>);

    return <>
        <Card className={"userPrefs"}>
            <CardHeader><h5 className="title"><img src={preferences} />{label("preferences")}</h5></CardHeader>
            <CardBody>
                <h5 className="title">
                    <Label className="audio_narration"><img src={audio} />
                        {label("audio_narration")}
                        <Switch
                            id="audioSwitch"
                            onText={label("on")}
                            offText={label("off")}
                            onChange={toggleAudio}
                            value={appController.states.preferences.audio}
                            onColor="default"
                            offColor="default"
                        />
                    </Label>
                </h5>
                <hr />
                <h5 className="title">
                    <Label className="auto_play"><img src={autoplay} />
                        {label("auto_play")}
                        <Switch
                            id="audioSwitch"
                            onText={label("on")}
                            offText={label("off")}
                            onChange={toggleAutoPlay}
                            value={appController.states.preferences.autoplay}
                            onColor="default"
                            offColor="default"
                        />
                    </Label>
                </h5>
                <hr />
                <h5 className="title">
                    <Label className="sound_effects"><img src={sound} />
                        {label("sound_effects")}
                        <Switch
                            onText={label("on")}
                            offText={label("off")}
                            onChange={toggleSound}
                            value={appController.states.preferences.sound}
                            onColor="default"
                            offColor="default"
                        />
                    </Label>
                </h5>

                <hr />
                <h5 className="title">
                    <Label className="illustrations"><img src={illustrations} />
                        {label("art")}
                        <Switch
                            onText={label("on")}
                            offText={label("off")}
                            onChange={toggleArt}
                            value={appController.states.preferences.art}
                            onColor="default"
                            offColor="default"
                        />
                    </Label>
                </h5>

                <hr />
                <h5 className="title">
                    <Label className="commentary_select"><img src={commentary} />
                        {label("commentary_singular")}
                        <Switch
                            onText={label("on")}
                            offText={label("off")}
                            onChange={toggleCommentary}
                            value={appController.states.preferences.commentary.on}
                            onColor="default"
                            offColor="default"
                        />
                    </Label>
                </h5>
                <Publications appController={appController} pubs={pubs} />
                 <hr />
                <h5 className="title">
                    <Label className="fax_select"><img src={facsimiles} />
                        {label("facsimiles")}
                        <Switch
                            onText={label("on")}
                            offText={label("off")}
                            onChange={toggleFax}
                            value={appController.states.preferences.facsimiles.on}
                            onColor="default"
                            offColor="default"
                        />
                    </Label>
                </h5>

                <div className={"faxCards"}>
                    {(appController.states.preferences.facsimiles.on ? faxs ? faxs : <div>{label("loading_facsimiles")}</div> : null)}
                </div>

            </CardBody>
        </Card></>

}


function Publications({appController,pubs}){


    const [showControversial, setShowControversial] = useState(false);

    if(!appController.states.preferences.commentary.on) return false;
    if(!pubs) return false;

    let gpubs = pubs.filter(p=>p.props.rating!=="R");
    let rpubs = pubs.filter(p=>p.props.rating==="R");

    let controversial = (rpubs && rpubs.length > 0) ? <>
    <Alert color="warning">{label("controversial_commentaries_warning")}</Alert>
    <div className={"publicationCards"}>{rpubs}</div></> : null;

    return   <><div className={"publicationCards"}>{gpubs}</div>

<h5 className="title">
                    <Label className="fax_select"><img src={commentary} />
                        {label("controversial_commentaries")}
                        <Switch
                            onText={label("Hide")}
                            offText={label("Show")}
                            onChange={()=>setShowControversial(!showControversial)}
                            value={showControversial}
                            onColor="default"
                            offColor="default"
                        />
                    </Label>
                </h5>
    
    {showControversial ? controversial : <>
    
    
    </> }

    
    </>


}