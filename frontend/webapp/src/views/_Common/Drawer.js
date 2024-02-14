
import Parser from "html-react-parser";
import { useEffect, useState } from 'react'
import Drawer from 'react-modern-drawer'
import 'react-modern-drawer/dist/index.css'
import BoMOnlineAPI, { assetUrl } from 'src/models/BoMOnlineAPI';
import "./Drawer.css"
import { Spinner } from './Loader';
import {
    snapSelectionToWord,
    replaceNumbers,
    processName,
    label,
    log,
    isMobile,
} from "src/models/Utils";
import { ProgressDetailsCircles } from "../User/ProgressBox";
import { displayDate, LegalNotice } from "./PopUp";
import { renderPersonPlaceHTML } from "../Page/PersonPlace";
import { Victory } from "../User/Victory";
import { GroupLeaderBoard } from "../Home/Home";
import { Button } from "reactstrap";
import { InviteButton } from "./Study/StudyHall";
import groupicon from "src/views/User/svg/group.svg";
import { StudyGroupThread } from "./Study/StudyChat";


export function MobileDrawer({ appController }) {


    const [localOpen, setLocalOpen] = useState(appController.states.popUp.open);

    const setSwipe = () => {
        let touchstartX = 0
        let touchendX = 0

        const slider = document.querySelector('.popupDrawer')

        function handleGesture() {
            const diff = touchendX - touchstartX;
            if (diff < 60) return null
            if (touchendX > touchstartX)
                setLocalOpen(false);
            setTimeout(appController.functions.closePopUp, 500);
            setTimeout(appController.functions.clearPopUp, 550);
        }

        slider.addEventListener('touchstart', e => {
            touchstartX = e.changedTouches[0].screenX
        })

        slider.addEventListener('touchend', e => {
            touchendX = e.changedTouches[0].screenX
            handleGesture()
        })
    }


    useEffect(() => {
        setLocalOpen(appController.states.popUp.open);
        setSwipe()
    }, [appController.states.popUp.open])
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)

    return (
        <Drawer
            className="popupDrawer"
            open={localOpen}
            size={vw * .85}
            direction="right"
            onClose={() => {
                setLocalOpen(false);
                setTimeout(appController.functions.clearPopUp, 550);
                setTimeout(appController.functions.closePopUp, 500);
            }}
        >
            <DrawerContent appController={appController} setLocalOpen={setLocalOpen} />
        </Drawer>
    )

}

function DrawerContent({ appController, setLocalOpen }) {
    const type = appController.states.popUp.type;
    const id = appController.states.popUp.activeId;
    if (type === "commentary")
        return <CommentaryDrawer appController={appController} />;
    if (type === "user/progress")
        return <ProgressDrawer appController={appController} setLocalOpen={setLocalOpen} />;
    if (type === "history")
        return <HistoryDrawer appController={appController} />;
    if (type === "places")
        return <Place appController={appController} setLocalOpen={setLocalOpen} />;
    if (type === "people")
        return <Person appController={appController} setLocalOpen={setLocalOpen} />;
    if (type === "victory")
        return <Victory appController={appController} context="drawer" />;
    if (type === "pFilter")
        return <PFilter appController={appController} context="drawer" />;
    if (/group\/[0-9a-f]{32}$/.test(type) && id ==="leaderboard")
        return <LeaderBoard appController={appController} context="drawer" />;
    if (/group\/[0-9a-f]{32}$/.test(type))
        return <MobileChatThread appController={appController} context="drawer" />;

    //return null;
    return <pre>{type}</pre>
}


function MobileChatThread({ appController }) {

    const setPanel = () => { };
    const [chatLinkedContent, setChatLinkedContent] = useState({});
    const [parentMessage, setThreadMessage] = useState(appController.popUpData);

    const group = appController.states.studyGroup.activeGroup;




    return <div className="DrawerStudyGroupThread">
        <StudyGroupThread
            appController={appController}
            setThreadMessage={setThreadMessage}
            linkedContent={{ chatLinkedContent, setChatLinkedContent }}
            parentMessage={parentMessage}
            channel={group}
            setPanel={setPanel}
        /></div>



}



function LeaderBoard({ appController }) {
    const group = appController.states.studyGroup.activeGroup;
    const count = group.members.length;
    const groupData = {
        members: group.members.map(m => {
            let progress = 0;
            try {
                progress = JSON.parse(m.metaData.summary)?.completed || 0;
            } catch (e) { }
            return {
                nickname: m.nickname,
                picture: m.plainProfileUrl,
                progress: progress
            }
        })
    }


    return <div className="LeaderBoardDrawer">

            <div className="LeaderBoardGroupName">
                <div>{group.name}</div>
                <img src={group.coverUrl} />
                
            </div>
        <div className="LeaderBoardDrawerHeader">
            <div className="memberCountH">
                <img src={groupicon} />
                {label(count === 1 ? "x_member" : "x_members", count)}
            </div>
            <InviteButton studyGroup={group} />
        </div>
        <GroupLeaderBoard groupData={groupData} />
    </div>
}

function PFilter({ appController }) {
    const data = appController.popUpData

    return data.filterBox;
}

function Person({ appController, setLocalOpen }) {

    const slug = appController.states.popUp.activeId;
    const [person, setPersonData] = useState(null);
    useEffect(() => {
        setTimeout(() => {
            BoMOnlineAPI(
                { person: slug }
            ).then((response) => {
                setPersonData(response.person[slug]);
            });
        }, [])
    }, 500);
    if (!person) return <Spinner />;

    return <div>
        <div className="pDrawerHeaderBox">
            <div>
                <h3>{processName(person.name)}</h3>
                <h4>{replaceNumbers(person.title)}</h4>
            </div>
            <img src={`${assetUrl}/people/${person.slug}`} />
        </div>

        <div className="description">{renderPersonPlaceHTML(person.description, appController)}</div>
    </div>

}

function Place({ appController, setLocalOpen }) {

    const slug = appController.states.popUp.activeId;
    const [place, setPlaceData] = useState(null);
    useEffect(() => {
        setTimeout(() => {
            BoMOnlineAPI(
                { places: slug }
            ).then((response) => {
                setPlaceData(response.places[slug]);
            });
        }, [])
    }, 500);
    if (!place) return <Spinner />;
    return <div>
        <div className="pDrawerHeaderBox">
            <div>
                <h3>{processName(place.name)}</h3>
                <h4>{replaceNumbers(place.info)}</h4>
            </div>
            <img src={`${assetUrl}/places/${place.slug}`} />
        </div>

        <div className="description">{renderPersonPlaceHTML(place.description, appController)}</div>
    </div>

}

function HistoryDrawer({ appController }) {

    const slug = appController.states.popUp.activeId;
    const [doc, setHistoryData] = useState(null);
    useEffect(() => {
        setTimeout(() => {
            BoMOnlineAPI(
                { history: slug }
            ).then((response) => {
                setHistoryData(response.history[slug]);
            });
        }, [])
    }, 500);
    if (!doc) return <Spinner />;
    return <div className="historyDrawer">
        <h4>{doc.source} <span>• {displayDate(doc.date)}</span></h4>
        <h3>{doc.document}</h3>
        <div className="teaser">{Parser(doc.teaser)}</div>
        <div className="transcript">{Parser(doc.transcript)}</div>
        <div className='history_fax'>{[...Array(doc.pages).keys()].map(i => {
            return <img src={`${assetUrl}/history/fax/${doc.id}.${i + 1}`} />
        })}</div>
    </div>

}

function ProgressDrawer({ appController, setLocalOpen }) {


    const tokenToLoad = appController.states.user.token;
    const userToLoad = appController.states.user.user;
    const queryBy = (userToLoad || tokenToLoad);
    const slug = appController.states.popUp.activeId;
    const [progressPages, setDetails] = useState(null);

    useEffect(() => {
        setTimeout(() => {
            BoMOnlineAPI(
                { divisionProgressDetails: slug },
                {
                    token: tokenToLoad,
                    useCache: false
                }
            ).then((details) => {
                setDetails({
                    loading: false,
                    queryBy: queryBy,
                    slug: slug,
                    pages: details.divisionProgressDetails?.[slug].pages || [],
                    description: details.divisionProgressDetails?.[slug].description || [],
                });
            });
        }, [])
    }, 500);
    if (!progressPages) return <Spinner />
    return <div>
        <ProgressDetailsCircles progressPages={progressPages} callBack={() => {
            setLocalOpen(false);
            setTimeout(appController.functions.closePopUp, 500);
        }} />
        <hr />
        <img src={`${assetUrl}/home/${slug}-1`} />
        <p className="divdesc">{progressPages.description}</p>
    </div>

}

function CommentaryDrawer({ appController }) {
    const [commentaryData, setCommentaryData] = useState(appController.popUpData[appController.states.popUp.activeId]);
    const [activeId, setActiveId] = useState(appController.states.popUp.activeId);
    const [debug, setDebug] = useState("init");

    const [showLegal, setLegal] = useState(false);
    useEffect(() => setLegal(false), [appController.states.popUp.activeId])

    useEffect(() => {
        setDebug("usefEffect")
        setCommentaryData(null)
        setTimeout(() => {
            setDebug("timeout")
            BoMOnlineAPI({ commentary: appController.states.popUp.ids }).then(
                (response) => {
                    setDebug(JSON.stringify(response, null, 2));
                    const commentary = response.commentary || {};
                    appController.functions.setPopUp({
                        type: "commentary",
                        underSlug: localStorage.getItem("studybookmark") || "study",
                        ids: Object.keys(commentary),
                        popUpData: commentary,
                    });
                }
            );
        }, 500);
    }, [])

    useEffect(() => {
        if (!appController.states.popUp.activeId) setCommentaryData(null);
        setCommentaryData(appController.popUpData[appController.states.popUp.activeId])
    }, [appController.popUpData[appController.states.popUp.activeId]]);

    if (!commentaryData) return <><Spinner /></>

    let tabs = (appController.states.popUp.ids.length === 1) ? null :
        <div className="topTabs">{appController.states.popUp.ids.sort().map(id =>
            <img className={id === activeId ? "active" : ""}
                onClick={() => {
                    setActiveId(id);
                    setCommentaryData(appController.popUpData[id])
                }}
                src={`${assetUrl}/source/cover/${id.substr(5, 3)}`} />)}</div>

    return <>
        {tabs}
        <div className="source">
            <img src={
                assetUrl +
                "/source/cover/" +
                commentaryData.publication.source_id.padStart(3, 0)} />
            <div>
                <div>
                    <h5>{label("commentary_on_x", [commentaryData.reference])}</h5>
                    <b>{commentaryData.publication.source_title}</b>
                    {" "} • {commentaryData.publication.source_name}
                    {" "} • {commentaryData.publication.source_year},{" "}
                    {commentaryData.publication.source_publisher}

                </div>
            </div>
        </div>
        <h3>{commentaryData.title}</h3>
        <div id="bodytext">{Parser(commentaryData.text)}</div>
        {!showLegal ? <div className="setLegal" onClick={() => setLegal(true)} >⚖️ {label("legal_notice")}</div> : null}
        <LegalNotice appController={appController} commentaryData={commentaryData} showLegal={showLegal} />

    </>

}