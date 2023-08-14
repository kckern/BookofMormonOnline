import { useEffect, useState } from "react";
import { StudyGroupList } from "../StudyGroupSelect";
import { StudyGroupChatPanel } from "../StudyHall";
import "./MobileStudy.css";
import back from "./back.svg";

import groupicon from "src/views/User/svg/group.svg";
import { history } from "src/models/routeHistory";
import { useParams, useHistory, useRouteMatch, Link } from "react-router-dom";
export default function MobileStudy({ appController }) {

    const match = useRouteMatch();
    const params = match.params;
    const base = match.url.split("/")[1];
    const [ranOnce, setRanOnce] = useState(false);


    useEffect(() => {
        const group = appController?.states?.studyGroup?.activeGroup;
        if(!group || ranOnce) return false;
        setRanOnce(true);
        if(params.channelId)  appController.functions.setMobileChat(true);

        if(params.leaderboard) 
        {
            return appController.functions.setPopUp({
                    type: `group/${group.url}`,
                    underSlug: `group/${group.url}`,
                    ids: ["leaderboard"],
                    popUpData: group,
                });
        }

        if(params.messageId) {
           
            


            const id = parseInt(params.messageId);
            const prevResultSize = 1;
            console.log({ group, id, prevResultSize })
            appController.sendbird.loadPreviousMessages( { group, id, prevResultSize }).then(r=>{
                appController.functions.setPopUp({
                    type: `group/${params.channelId}`,
                    ids: [`${params.messageId}`],
                    popUpData: r[0],
                    underSlug: `group/${params.channelId}`
                  });
            })


        } 
    },[appController?.states?.studyGroup?.activeGroup]);



    useEffect(() => {


        if (appController.states.studyGroup.isMobileChat) {

            history.push(`/group/${appController?.states?.studyGroup?.activeGroup.url}`)
            return false;
        }
        else
        {
            document.body.scrollTop = 0;
            window.scrollTo(0, 0);
        }
    }, [appController.states.studyGroup.isMobileChat])

    const setPanel = () => { }
    const contents = appController.states.studyGroup.isMobileChat ?
        <><MobileChatHeader appController={appController} />
            <StudyGroupChatPanel
                appController={appController}
                channel={appController.states.studyGroup.activeGroup}
                setPanel={setPanel}
            /></> : <StudyGroupList appController={appController} />

    if (!appController?.states?.studyGroup?.activeGroup) return null;
    return <div className="content mobilestudy">
        {contents}
    </div>
}


function MobileChatHeader({ appController }) {
    const group = appController.states.studyGroup.activeGroup;
    const count = group?.memberCount || 0;

    const openLeaderBoard = () => {
        appController.functions.setPopUp({
            type: `group/${group.url}`,
            underSlug: `group/${group.url}`,
            ids: ["leaderboard"],
            popUpData: group,
        });
    }


    return <div className="MobileChatHeader">
        <div className="MobileChatHeaderBack"
            onClick={() => {

                appController.functions.setMobileChat(false)
            }
            }
        ><img src={back} /></div>
        <div className="MobileChatHeaderTitle">
            <img src={appController.states.studyGroup.activeGroup.coverUrl} />
            <div>{appController.states.studyGroup.activeGroup.name}</div>
        </div>
        <div className="MobileChatHeaderMembers" onClick={openLeaderBoard} >
            <img src={groupicon} />
            {count}
        </div>
    </div>
}