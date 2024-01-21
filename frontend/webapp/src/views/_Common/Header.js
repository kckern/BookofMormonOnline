import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "models/BoMOnlineAPI";
import { isMobile, label, tokenImage } from "models/Utils.js";

import "./Header.css";
import { StudyGroupBar } from "./Study/StudyGroupBar.js";

import bell from "src/views/_Common/svg/bell.svg";
import none from "src/views/_Common/svg/none.svg";
import logo from "src/views/_Common/svg/logo.svg";
import green from "src/views/User/svg/green.svg";
import yellow from "src/views/User/svg/yellow.svg";

function Header({ appController, isReady }) {
  let dynamicContent = null;
  let homeLink = (
    <div className="headerTitle">
      {label("home_title")}
      <br />
      <small>{label("beta")}</small>
    </div>
  );
  if (isReady && appController.states?.user?.user) {
    dynamicContent = (
      <>
        <Notifications appController={appController} />
        <StudyGroupBar appController={appController} />
      </>
    );
    homeLink = <Link to="/home">{homeLink}</Link>;
  }

  if (isMobile() && appController) return <MobileHeader appController={appController} />

  return (
    <div
      id="header"
      className="heading-bar noselect"
      onClick={(e) => {
        if (e?.target?.offsetParent?.className.includes("heading-bar")) {
          appController.states.studyGroup.isDrawerOpen &&
            appController.functions.openDrawer(false);
          appController.states.notification.isNotificationOpen &&
            appController.functions.openNotification(false);
        }
      }}
    >
      <div className="header-logo-image">
        <img src={logo} alt="logo" />
      </div>
      <div className="header-nav-icon">
        <i className="fa fa-bars"></i>
      </div>
      {dynamicContent}
      {homeLink}
    </div>
  );
}

export default Header;


function MobileHeader({ appController }) {
  let tokenImg = tokenImage();
   let loadingImg = `${assetUrl}/interface/gif/circleload`;

  const [name, setName] = useState(label("loading_user"));
  const [img, setImg] = useState(loadingImg);

  const [completed, setCompleted] = useState(appController.states?.user.progress?.completed || 0);
  const [started, setStarted] = useState(appController.states?.user.progress?.started || 0);

  useEffect(() => {
    setCompleted(appController.states?.user.progress?.completed);
    setStarted(appController.states?.user.progress?.started)

  }, [appController.states?.user.progress?.completed, appController.states?.user.progress?.started]);

  let startedString = (completed > started) ? "" : 
  <span>
    <img src={yellow}/>
    {(started?.toFixed(1) || 0) + "% "}
  </span>

  useEffect(() => {
    if (appController.states?.user?.social && appController.states?.user?.user) {
      setName(appController.states?.user?.social.nickname);
      setImg(appController.states?.user?.social.profile_url);
    } else if (appController.states?.user?.user) {
      setName(label("loading_user"));
      setImg(loadingImg);
    } else {
      setName(label("guest"));
      setImg(tokenImg);
    }
  }, [
    appController.states?.user?.social?.nickname,
    appController.states?.user?.social?.profile_url,
    appController.states?.user?.user,
    label("loading_user")
  ]);


  return (
    <Link to={"/user"}>
    <div
      id="header"
      className="heading-bar mobile noselect"
    >
      <div className="logoheader">
        <img src={`${assetUrl}/interface/logo`} />
        <div>{label("home_title")}</div>
      </div>
      <div className="userheader">
        <div>
          <div className="progresslist">
            <div className="progress_text">
              <img src={green}/> {completed?.toFixed(1) || 0}% 
              {startedString}
            </div>
            <div className="progress">
              <div
                className={"progress-bar progress-bar-success"}
                role="progressbar"
                style={{
                  width: (completed > 0 && completed < 2 ? 2 : completed) + "%",
                }}
                aria-valuenow="15"
                aria-valuemin="0"
                aria-valuemax="100"
              ></div>
              <div
                className={"progress-bar progress-bar-warning"}
                role="progressbar"
                style={{
                  width: (started > 0 && started < 2 ? 2 : started) + "%",
                }}
                aria-valuenow="30"
                aria-valuemin="0"
                aria-valuemax="100"
              ></div>
            </div>
          </div>
          <div className="headername">{name}</div>
        </div>
        <img src={`${img}`} />
      </div>
    </div>
      </Link>

  )
}

function Notifications({ appController }) {
  const notificationOpen = appController.states.notification.isNotificationOpen;
  return (
    <>
      {notificationOpen ? <NotificationList /> : null}
      <div
        className="headerButton"
        onClick={() =>
          appController.functions.openNotification(!notificationOpen)
        }
      >
        <img src={bell} />
      </div>
    </>
  );
}

function NotificationList() {
  return (
    <div className="NotificationList">
      <h5>{label("notifications")}</h5>
      <ul>
        <li>
          <img src={none} />
          {label("no_notifications")}
        </li>
      </ul>
    </div>
  );
}
