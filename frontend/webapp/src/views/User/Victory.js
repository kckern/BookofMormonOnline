import React, { useState, useEffect, useCallback } from "react";
import { label, playSound, useWindowSize } from "src/models/Utils";
import Confetti from 'react-confetti'
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import ReactRevealText from 'react-reveal-text'
import moment from "moment";
import momentDurationFormatSetup from "moment-duration-format";
import {
    Button,
    Card,
    CardHeader,
    CardBody,
    CardFooter,
    Col,
    Row,
    NavItem,
    NavLink,
    Nav,
    TabContent,
    TabPane,
} from "reactstrap";

import "./Victory.css"
momentDurationFormatSetup(moment);
export function Victory({ appController, context }) {
    const { width, height } = useWindowSize();

    const [show, setShow] = useState(true);
    const [text, setText] = useState(label("victory_completed"));
    const [summary, setSummary] = useState(null);
    const [confetti, setConfetti] = useState(null);
    const [lines, setLines] = useState([]);
    let token = appController.states.user.token;


    const [victory] = useState(
        new Audio(`${assetUrl}/interface/audio/victory`)
    );
    useEffect(() => {
        if (appController.states.preferences.sound) playSound(victory)//.play();
        window.clicky?.goal("finish");

        if (!summary) BoMOnlineAPI(
            {
                userprogress: token,
            },
            { useCache: false }
        ).then((r) => {
            let summary = r.userprogress?.[token]?.summary || {};
            setSummary(summary);
            setLines([
                label("victory_completed"),
                label("victory_started_x", summary.first ? moment.unix(summary.first).format(label("history_date_format_full")) : null),
                label("victory_duration_x", summary.duration ? moment.duration(summary.duration, "seconds").format(label("duration_format")) : null),
                label("victory_sessions_x", (summary.count + "" || 1)),
            ]);
            setConfetti(<Confetti
                width={width}
                height={height}
                initialVelocityY={10}
                initialVelocityX={10}
                numberOfPieces={1000}
                gravity={0.05}
                recycle={true}
            />)
        });

    }, []);


    const cycleText = () => {

        let transition = 1600;
        let time = 0;
        let linetime = 5000;
        if (!lines.length) return null;
        for (let i in lines) {
            const line = lines[i];
            setTimeout(() => setText(line), time);
            setTimeout(() => setShow(true), time + 200);
            if (i === line.length - 1) break;
            time += transition;
            time += linetime;
            setTimeout(() => setShow(false), time);
            time += transition * 2;
        }
        setTimeout(cycleText, time);
    }

    useEffect(cycleText, [lines]);
    if (context === "drawer") return <div className="victorydrawer">
        {confetti}
        <h5 className="title">
            {label("victory_congrats")}
            <span
                className="close"
                onClick={() => { appController.functions.closePopUp(); victory.pause() }}
            >×</span>
        </h5>
        <div className="profile">
            <img src={appController.states.user.social?.profile_url} />
        </div>
        <div className="revealtext" >
            <ReactRevealText show={show} >{text}</ReactRevealText>
        </div>
        <div className="trophy">
            <img src={`${assetUrl}/interface/gif/trophy`} />
        </div>
    </div>

    else return (
        <>
            {confetti}
            <Card id={"popUp"} className={"victory"}>
                <CardHeader>
                    <h5 className="title">
                        {label("victory_congrats")}
                        <span
                            className="close"
                            onClick={() => { appController.functions.closePopUp(); victory.pause() }}
                        >×</span>
                    </h5>
                </CardHeader>
                <CardBody className="victorybody">
                    <div className="profile">
                        <img src={appController.states.user.social?.profile_url} />
                    </div>
                    <div className="revealtext" >
                        <ReactRevealText show={show} >{text}</ReactRevealText>
                    </div>

                </CardBody>
                <CardBody>
                    <div className="trophy">
                        <img src={`${assetUrl}/interface/gif/trophy`} />
                    </div>
                </CardBody>
            </Card>
        </>
    );

}

