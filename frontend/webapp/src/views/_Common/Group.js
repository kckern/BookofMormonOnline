

import React, { useEffect, useState } from "react";
import { useParams, useHistory, useRouteMatch, Link } from "react-router-dom";
import { isMobile } from "src/models/Utils";
import Home from "../Home/Home";
import MobileStudy from "./Study/Mobile/MobileStudy";


export default function Group({ appController, isReady }) {

    const match = useRouteMatch();
    const params = match.params;
    const base = match.url.split("/")[1];

    useEffect(() => {
        if (base === "group" && !isMobile()) {
    
          if (appController.states.studyGroup.activeGroup === null) return;
    
          if (appController.states.studyGroup.activeGroup.url !== params.channelId) {
            appController.states.studyGroup.groupList.forEach((group) => {
              group.url === params.channelId &&
                appController.functions.setActiveStudyGroup(group);
            });
          }
          appController.functions.openDrawer(
            !appController.states.studyGroup.isDrawerOpen
          );
          setTimeout(() => {
            appController.sendbird.loadPreviousMessages({
                group: appController.states.studyGroup.activeGroup,
                id: Number(params.messageId),
              }).then((data) => {
                const parentMessage = data.filter(
                  (message) => message.messageId === Number(params.messageId)
                );
                appController.functions.setParentMessage(...parentMessage);
              });
          }, 2000);
        }
        return () => {
          appController.functions.setParentMessage(false);
        };
      }, [
        appController.states.studyGroup.activeGroup,
        params.messageId,
        params.channelId,
      ]);



      if(isMobile()) return <MobileStudy appController={appController}/>
      return <Home appController={appController}/>


}