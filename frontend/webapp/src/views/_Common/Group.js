

import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useLegacyParams } from "src/models/routeParams";
import { isMobile } from "src/models/Utils";
import Home from "../Home/Community";
import MobileStudy from "./Study/Mobile/MobileStudy";
import { useAppController } from "src/contexts/AppControllerContext";
import { useMessenger } from "src/contexts/MessengerContext";


export default function Group({ isReady }) {

    const appController = useAppController();
    const messenger = useMessenger();
    const match = { params: useLegacyParams(), url: useLocation().pathname };
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
            messenger.loadPreviousMessages({
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



      if(isMobile()) return <MobileStudy/>
      return <Home/>


}