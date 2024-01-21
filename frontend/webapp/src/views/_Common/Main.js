import React, { Suspense, useEffect, useReducer, useState } from "react";
import { Switch, Route } from "react-router-dom";
import { toast } from 'react-toastify';
import Cookies from 'js-cookie';

// COMPONENTS
import Header from "./Header";
import Sidebar from "./Sidebar";
import routes from "src/models/Routes";
import links from "./sideBarLinks";
import { determineLanguage, label, makeLabelDictionary } from "src/models/Utils";
import PopUp from "./PopUp";
import BoMOnlineAPI,{ApiBaseUrl} from "src/models/BoMOnlineAPI";
// STYLE
import "./Main.css";
import "./ToolTip.css";
import "src/views/_Common/ScripturePanel.css";
import Loader from "src/views/_Common/Loader";
import { appControllerReducer, appInit } from "src/models/appController";
import nowifi from "./svg/no-wifi.svg";
//
import "./BottomNav.css";
import { BottomMenu } from "./BottomNav";
import { getCache, getSingleCache, getSingleCacheFromKey, setCache } from "../../models/Cache";




function Main(props) {
  
  // This is the main App Controller
  const [apiFailure, setApiFailed] = useState(false);
  const [lang] = useState(determineLanguage())
  const [appController, appDispatch] = useReducer(
    appControllerReducer,
    (() => appInit())()
  );
  // SET "appDispatch" GOLABAL TO GET IT ON "appController" FILE IN "appDispatch" FUNCTION
  global._appDispatch = appDispatch;


  const fireStudyGroupAction = (e) => appController.functions.processStudyGroupEvent(e);
  const firedMessage = (e) => appController.functions.firedMessage(e);
  const setTypers = (e) => appController.functions.setTypers({channelUrl:e.channelUrl,ids:e.typers.map(t => t.userId)});

  const  handleAway =  (e) =>  navigator.sendBeacon(ApiBaseUrl, JSON.stringify({ 'query': `{closetab(token:"${appController.states.user.token}")}` }));

  const  handleVisibilityChange =  (e) => {
    toast.clearWaitingQueue();
    let activeGroupUrl = appController.states.studyGroup.activeGroup?.url;
    if (document.visibilityState === 'visible') {
      appController.sendbird?.updateUserState({ channels: appController.states.studyGroup.groupList,  activeGroup: activeGroupUrl, activeCall: "" });
    } else {
      appController.sendbird?.updateUserState({ channels: appController.states.studyGroup.groupList,  activeGroup: "", activeCall: "" });
    }
  }


  useEffect(() => {

    window.removeEventListener("fireStudyGroupAction", fireStudyGroupAction, false);
    window.addEventListener("fireStudyGroupAction", fireStudyGroupAction, false);

    window.removeEventListener("fireMessage", firedMessage, false);
    window.addEventListener("fireMessage", firedMessage, false);


    window.removeEventListener("typingStatusUpdated", setTypers, false);
    window.addEventListener("typingStatusUpdated", setTypers, false);


    window.removeEventListener("visibilitychange", handleVisibilityChange, false);
    window.addEventListener("visibilitychange", handleVisibilityChange, false);

     window.removeEventListener("beforeunload", handleAway, false);
     window.addEventListener("beforeunload", handleAway, false);
     //window.removeEventListener("unload", handleAway, false);
     //window.addEventListener("unload", handleAway, false);

  }, []);


  useEffect(() => {
    if (!appController) return setApiFailed({ appController });
    let localToken = localStorage.getItem("token") || Cookies.get("u") ;


    getSingleCacheFromKey("label.dictionary").then((labels) => {
      let r = { labels };
      r = makeLabelDictionary(r);
      appController.functions.setPreLoadData(r);

  });

    BoMOnlineAPI(
      {
        personList: null,
        placeList: null,
        divisionShell: null,
        fax: null,
        labels: null,
        tokenSignIn: localToken,
        publications: true
      },
      {
        useCache: ["personList", "placeList","publications", "divisionShell", "fax"], //,"labels"
      }
    ).then((r) => {
      if (!r || !r.tokenSignIn || !r.tokenSignIn[localToken])
        return setApiFailed({ r });
      r = makeLabelDictionary(r);
      r.fromAPI = true;
      appController.functions.setPreLoadData(r);
      document.title = label("home_title");

      const gmapskey = r?.labels?.gmaps || null;
      //add google maps script with api
      if (gmapskey) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${gmapskey}`;
        script.async = true;
        document.body.appendChild(script);
      }


    });
  }, [appController.functions]);


  let debug = null;
  // if (window.location.host !== "staging.bookofmormon.online") debug = <pre>APP CONTROLLER: {JSON.stringify(appController.states, null, 2)}</pre>;

  let main = (
    <div className="main-panel" id="main-panel">
      {/* /SHOW LOADER IN CASE DATA ARE FETCHING */}
      {!appController.preLoad || appController.sendbird === null ? (
        <Loader />
      ) : (
        <>
          <PopUp appController={appController} />
          <Suspense fallback={<Loader />}>
            <Switch>
              {routes.map((x, i) => (
                <Route
                  key={i}
                  exact={x.exact}
                  path={x.path}
                  render={(props) => (
                    <x.component {...props} appController={appController} />
                  )}
                />
              ))}
            </Switch>
          </Suspense>
            <BottomMenu appController={appController}/>
        </>
      )}
    </div>
  );
  //if (window.location.host !== "beta.bookofmormon.online")  main = null;

  if (apiFailure)
    return (
      <div className="body">
        <div className="fail">
          <img src={nowifi} />
          {label("network_failure")}
        </div>
      </div>
    );

  return (
    <div className={"body"+(lang ? " "+lang: "")}>
      {debug}
      <Header {...props} appController={appController} isReady={true} />
      {/* <Navbar user={user} showSideNav={showSideNav} manageLayout={manageLayout} toggleSideNav={toggleSideNav} /> */}
      <Sidebar
        {...props}
        appController={appController}
        routes={links}
        bgColor={"1a1d20"}
        activeColor={"red"}
      />
      <div
        className="main-panel"
        id="main-panel"
        onClick={(e) => {
          appController.states.studyGroup.isDrawerOpen &&
            appController.functions.openDrawer(false);
          appController.states.notification.isNotificationOpen &&
            appController.functions.openNotification(false);
          appController.states.studyGroup.isGroupListOpen &&
            appController.functions.openGroupList(false);
        }}
      >
        {/* /SHOW LOADER IN CASE DATA ARE FETCHING */}
        {!appController.preLoad ||
          (appController.states.user.user && appController.sendbird === null) ? (
          <Loader />
        ) : (
          <>
            <PopUp appController={appController} />
            <Suspense fallback={<Loader />}>
              <Switch>
                {routes.map((x, i) => (
                  <Route key={i}  keyProp={i} exact={x.exact} path={x.path}>
                    <x.component appController={appController} />
                  </Route>
                ))}
              </Switch>
            </Suspense>
            <BottomMenu appController={appController}/>
          </>
        )}
      </div>
    </div>
  );
}

export default Main;
