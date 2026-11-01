
import Parser from "html-react-parser";
import { useEffect, useRef, useState } from 'react'
import Drawer from 'react-modern-drawer'
import 'react-modern-drawer/dist/index.css'
import BoMOnlineAPI, { assetUrl } from 'src/models/BoMOnlineAPI';
import "./Drawer.css"
import { Spinner } from './Loader';
import { label } from "src/models/Utils";
import { ProgressDetailsCircles } from "../User/ProgressBox";
import { LegalNotice } from "./PopUp";

import { Victory } from "../User/Victory";
import { GroupLeaderBoard } from "../Home/Community";
import { InviteButton } from "./Study/StudyHall";
import groupIcon from "src/views/User/svg/group.svg";
import { StudyGroupThread } from "./Study/StudyChat";
import { getDetectedScripturesHtml, getHtmlScriptureLinkParserOptions, useIsMounted, useTimeouts } from "./ViewUtils";
import { ScripturePanelSingle } from "../Page/Narration";
import { useAppController } from "src/contexts/AppControllerContext";
import XrelSection from "./XrelSection";
import HistoryDrawer from "./HistoryDrawer";
import MatterBody from "./entity/MatterBody";
import PersonBody from "./entity/PersonBody";
import PlaceBody from "./entity/PlaceBody";
import { useNavigate } from "react-router-dom";
import useEntityData from "./entity/useEntityData";
import labelOr from "src/views/Home/tiles/_ds/labelOr";
import { parse } from "node-html-parser";
import { lookupReference } from "scripture-guide";
import { determineLanguage } from "src/models/Utils";
import { ATVHeader } from "./ATV";
import { extractApparatusUnits } from "./ATV/parseATV";
import { governingRefs } from "./ATV/governingRef";
import { lastScriptureRef } from "./ATV/lastScriptureRef";
import { ATVApparatus } from "./ATV/ATVApparatus";
import "./Commentary.css";


// Slide out first, then drop the popup state once the animation has finished.
function useDrawerClose(setLocalOpen) {
    const appController = useAppController();
    return () => {
        setLocalOpen(false);
        setTimeout(appController.functions.closePopUp, 500);
        setTimeout(appController.functions.clearPopUp, 550);
    };
}

export function MobileDrawer() {
    const appController = useAppController();
    const open = appController.states.popUp.open;
    const [localOpen, setLocalOpen] = useState(open);
    const close = useDrawerClose(setLocalOpen);

    useEffect(() => {
        setLocalOpen(open);
        // swipe right to dismiss; removed on cleanup so listeners don't stack
        const slider = document.querySelector('.popupDrawer');
        if (!slider) return undefined;
        let startX = 0;
        const onStart = (e) => { startX = e.changedTouches[0].screenX; };
        const onEnd = (e) => { if (e.changedTouches[0].screenX - startX >= 60) close(); };
        slider.addEventListener('touchstart', onStart);
        slider.addEventListener('touchend', onEnd);
        return () => {
            slider.removeEventListener('touchstart', onStart);
            slider.removeEventListener('touchend', onEnd);
        };
    }, [open]);
    // documentElement.clientWidth, not innerWidth: a page that overflows
    // sideways (the witness heatmap) widens innerWidth, and a drawer sized from
    // it ran off the right edge, clipping its text (blind audit witness-D1).
    const vw = document.documentElement.clientWidth || window.innerWidth || 0

    return (
        <Drawer
            className="popupDrawer d-flex flex-column"
            open={localOpen}
            size={vw * .85}
            direction="right"
            onClose={close}
        >
            <DrawerContent setLocalOpen={setLocalOpen} />
        </Drawer>
    )
}

// People / places / matters open as a drawer on phones: the way out (close)
// belongs at the top, where the thumb and the eye already are.
function DrawerEntityBar({ onClose }) {
    return (
        <div className="drawerEntityBar">
            <button type="button" className="drawerEntityClose" aria-label={labelOr("close", "Close")} onClick={onClose}>×</button>
        </div>
    );
}

function MatterDrawer() {
    const id = useAppController().states.popUp.activeId;
    const { data, status } = useEntityData("matters", id);
    if (status === "loading") return <Spinner />;
    if (!data) return <div className="subject p-4">{labelOr("not_found", "Not found")}</div>;
    return (
        <div className="subject overflow-auto p-4">
            <MatterBody data={data} headingLevel={3} />
        </div>
    );
}

function DrawerContent({ setLocalOpen }) {
    const appController = useAppController();
    const type = appController.states.popUp.type;
    const id = appController.states.popUp.activeId;
    const close = useDrawerClose(setLocalOpen);
    if (type === "commentary")
        return <CommentaryDrawer onClose={close} />;
    if (type === "user/progress")
        return <ProgressDrawer setLocalOpen={setLocalOpen} />;
    if (type === "history")
        return (
            <HistoryDrawer
                slug={id}
                onClose={close}
            />
        );
    if (type === "places")
        return <><DrawerEntityBar onClose={close} /><Place key={id} /></>;
    if (type === "people")
        return <><DrawerEntityBar onClose={close} /><Person key={id} /></>;
    if (type === "matters")
        return <><DrawerEntityBar onClose={close} /><MatterDrawer key={id} /></>;
    if (type === "group")
        return <GroupDrawer key={id} />;
    if (type === "victory")
        return <Victory context="drawer" />;
    if (type === "pFilter")
        return <PFilter context="drawer" />;
    if (/group\/[0-9a-f]{32}$/.test(type) && id ==="leaderboard")
        return <LeaderBoard context="drawer" />;
    if (/group\/[0-9a-f]{32}$/.test(type))
        return <MobileChatThread context="drawer" />;

    return null;
}


function MobileChatThread() {
    const appController = useAppController();
    const setPanel = () => { };
    const [chatLinkedContent, setChatLinkedContent] = useState({});
    const [parentMessage, setThreadMessage] = useState(appController.popUpData);
    const group = appController.states.studyGroup.activeGroup;

    return <div className="DrawerStudyGroupThread">
        <StudyGroupThread
            setThreadMessage={setThreadMessage}
            linkedContent={{ chatLinkedContent, setChatLinkedContent }}
            parentMessage={parentMessage}
            channel={group}
            setPanel={setPanel}
        /></div>
}



function LeaderBoard() {
    const appController = useAppController();
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
                <img src={groupIcon} />
                {label(count === 1 ? "x_member" : "x_members", count)}
            </div>
            <InviteButton studyGroup={group} />
        </div>
        <GroupLeaderBoard groupData={groupData} />
    </div>
}

function PFilter() {
    const appController = useAppController();
    const data = appController.popUpData
    return data.filterBox;
}

function Person() {
    const appController = useAppController();
    const slug = appController.states.popUp.activeId;
    const { data: person, status } = useEntityData("people", slug);
    const [activeScriptureReference, setActiveScriptureReference] = useState(null);

    if (status === "loading") return <Spinner />;
    if (!person) return <div className="subject p-4">{labelOr("not_found", "Not found")}</div>;

    return (
        <>
            <div className="subject overflow-auto p-4">
                <PersonBody
                    data={person}
                    setPopUpRef={setActiveScriptureReference}
                    onEntityClick={(id) =>
                        appController.functions.setPopUp({ type: "people", ids: [id], underSlug: "people" })
                    }
                />
            </div>
            <ScripturePanelSingle
                scriptureData={{ ref: activeScriptureReference }}
                closeButton={true}
                onClose={() => setActiveScriptureReference(null)}
            />
        </>
    );
}

function Place() {
    const appController = useAppController();
    const navigate = useNavigate();
    const slug = appController.states.popUp.activeId;
    const { data: place, status } = useEntityData("places", slug);
    const [activeScriptureReference, setActiveScriptureReference] = useState(null);

    if (status === "loading") return <Spinner />;
    if (!place) return <div className="subject p-4">{labelOr("not_found", "Not found")}</div>;

    // same hand-off as the desktop popup: close, tell the map, then route there
    const onSelectMapType = (e, map, placeSlug) => {
        e.preventDefault();
        appController.functions.closePopUp();
        const event = new CustomEvent("handleMapChange");
        event.map = map;
        event.place = placeSlug;
        window.dispatchEvent(event);
        navigate(`/map/${map}/place/${placeSlug}`);
    };

    return (
        <>
            <div className="subject overflow-auto p-4">
                <PlaceBody
                    data={place}
                    setPopUpRef={setActiveScriptureReference}
                    onMapClick={onSelectMapType}
                />
            </div>
            <ScripturePanelSingle
                scriptureData={{ ref: activeScriptureReference }}
                closeButton={true}
                onClose={() => setActiveScriptureReference(null)}
            />
        </>
    );
}

function GroupDrawer() {
    const appController = useAppController();
    const slug = appController.states.popUp.activeId;
    const [group, setGroupData] = useState(null);

    useEffect(() => {
        setTimeout(() => {
            BoMOnlineAPI(
                { group: slug }
            ).then((response) => {
                setGroupData(response.group?.[slug]);
            });
        }, 500);
    }, []);

    if (!group) return <Spinner />;

    return (
        <div className="subject overflow-auto p-4">
            <div className="pDrawerHeaderBox">
                <div>
                    <h3>{group.name}</h3>
                </div>
            </div>
            <XrelSection xrels={group.xrels} showEmpty />
        </div>
    );
}

function ProgressDrawer({ setLocalOpen }) {
    const appController = useAppController();
    const tokenToLoad = appController.states.user.token;
    const userToLoad = appController.states.user.user;
    const queryBy = (userToLoad || tokenToLoad);
    const slug = appController.states.popUp.activeId;
    const [progressPages, setDetails] = useState(null);

    useEffect(() => {
        let cancelled = false;
        BoMOnlineAPI(
            { divisionProgressDetails: slug },
            { token: tokenToLoad, useCache: false }
        ).then((details) => {
            if (cancelled) return;
            setDetails({
                loading: false,
                queryBy: queryBy,
                slug: slug,
                pages: details.divisionProgressDetails?.[slug].pages || [],
                description: details.divisionProgressDetails?.[slug].description || [],
            });
        });
        return () => { cancelled = true; };
    }, [slug]);

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

/**
 * The sheet's own way out (R6 commentary-D3): the 85vw drawer left only a 59px
 * backdrop sliver or browser Back. A pinned head row with the same × as the
 * desktop commentary modal; the body scrolls under it.
 */
function CommentaryDrawerHead({ onClose }) {
    if (!onClose) return null;
    return <div className="commentaryDrawerHead">
        <span className="commentaryDrawerEyebrow">{labelOr("commentary", "Commentary")}</span>
        <button type="button" className="commentaryDrawerClose" aria-label={labelOr("close", "Close")} onClick={onClose}>×</button>
    </div>;
}

export function CommentaryDrawer({ onClose }) {
    const appController = useAppController();
    const isMounted = useIsMounted();
    const timeouts = useTimeouts();
    const [commentaryData, setCommentaryData] = useState(appController.popUpData[appController.states.popUp.activeId]);
    const [activeId, setActiveId] = useState(appController.states.popUp.activeId);
    const [activeScriptureReference, setActiveScriptureReference] = useState(null);
    const [showLegal, setLegal] = useState(false);
    const [failed, setFailed] = useState(false);
    const scripturePanelRef = useRef(null);

    useEffect(() => setLegal(false), [appController.states.popUp.activeId])

    useEffect(() => {
        setCommentaryData(null)
        timeouts.set('mount', () => {
            BoMOnlineAPI({ commentary: appController.states.popUp.ids }).then(
                (response) => {
                    if (!isMounted()) return;
                    const commentary = response?.commentary || {};
                    // nothing came back: say so instead of an endless spinner
                    if (!Object.keys(commentary).length) return setFailed(true);
                    appController.functions.setPopUp({
                        type: "commentary",
                        underSlug: localStorage.getItem("studybookmark") || "study",
                        ids: Object.keys(commentary),
                        popUpData: commentary,
                    });
                }
            ).catch(() => isMounted() && setFailed(true));
        }, 500);
    }, [])

    useEffect(() => {
        setCommentaryData(appController.popUpData[appController.states.popUp.activeId])
    }, [appController.popUpData[appController.states.popUp.activeId]]);

    if (!commentaryData && failed)
        return <><CommentaryDrawerHead onClose={onClose} /><div className="subject p-4">
            <p>{labelOr("commentary_unavailable", "This commentary couldn’t be loaded.")}</p>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={appController.functions.closePopUp}>
                {labelOr("close", "Close")}
            </button>
        </div></>
    if (!commentaryData) return <><CommentaryDrawerHead onClose={onClose} /><Spinner /></>

    let tabs = (appController.states.popUp.ids.length === 1) ? null :
        <div className="topTabs">
            {appController.states.popUp.ids.sort().map((id, index) => {
                return <img
                    key={id + index}
                    className={id === activeId ? "active" : ""}
                    onClick={() => {
                        setActiveId(id);
                        setCommentaryData(appController.popUpData[id])
                    }}
                    src={`${assetUrl}/source/cover/${id.substr(5, 3)}`}
                    alt={appController.popUpData[id]?.publication?.source_title}
                />
            })}
        </div>

	const parserOptions = getHtmlScriptureLinkParserOptions((reference) => {
        setActiveScriptureReference(reference);
    });
	// Textual-variants (ATV) commentaries: the same pipeline as the desktop popup
	// (Commentary.js) — the <div class="source"> apparatus header renders through
	// ATVHeader and prose-body units through ATVApparatus, so raw sigla never leak
	// (blind r8 commentary-D5).
	const rawText = commentaryData.text || "";
	const atvHTML = parse(rawText).querySelector(".source")?.outerHTML.trim() || "";
	const { html: tokenized, units: atvUnits, contexts: atvContexts } =
		extractApparatusUnits(atvHTML ? rawText.replace(atvHTML, "").trim() : rawText);
	const atvRefs = atvUnits.length
		? governingRefs(atvContexts, (ctx) => lastScriptureRef(ctx, determineLanguage()))
		: [];
	const html = getDetectedScripturesHtml(tokenized);
	const bodyOptions = {
		...parserOptions,
		replace: (node) => {
			if (node && node.name === "atv-unit") {
				const i = Number(node.attribs && node.attribs["data-atv-i"]);
				const ref = atvRefs[i];
				const verseId = ref ? (lookupReference(ref)?.verse_ids?.[0] ?? null) : null;
				return <ATVApparatus readings={atvUnits[i]} variant="inline" verseId={verseId} reference={ref || commentaryData.reference} />;
			}
			return parserOptions.replace ? parserOptions.replace(node) : undefined;
		},
	};
    return <>
        <CommentaryDrawerHead onClose={onClose} />
        <div className="subject p-4 overflow-auto">
            {tabs}
            <div className="commentaryDrawerSource">
                <img
                    src={
                        assetUrl +
                        "/source/cover/" +
                        commentaryData.publication.source_id.padStart(3, 0)
                    }
                    alt={commentaryData.publication?.source_title}
                />
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

            <div className="container">
                <div className="row align-items-start">
                    <div id="bodytext">
                        <ATVHeader atvHTML={atvHTML} reference={commentaryData.reference} />
                        {Parser(html, bodyOptions)}
                    </div>
                </div>
                <div className="row align-items-start">
                    {!showLegal ? <div className="setLegal" onClick={() => setLegal(true)} >⚖️ {label("legal_notice")}</div> : null}
                    <LegalNotice commentaryData={commentaryData} showLegal={showLegal} />
                </div>
            </div>
        </div>

        <div ref={scripturePanelRef}>
            <ScripturePanelSingle
                scriptureData={{ref:activeScriptureReference}}
                closeButton={true}
                onClose={()=>{
                    setActiveScriptureReference(null);
                }}
            />
        </div>
    </>

}
