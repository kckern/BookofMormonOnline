import React, { useEffect, useState } from "react";
import { isMessengerNavigationEnabled, HIDE_HOME_NAV } from '../../models/featureFlags';
import { Link } from "react-router-dom";
import { assetUrl } from "models/BoMOnlineAPI";
import { isMobile, label, tokenImage } from "models/Utils.js";
import UserAvatar from "src/components/UserAvatar";
import { useAppController } from "src/contexts/AppControllerContext";

import "./Header.css";
import { StudyGroupBar } from "./Study/StudyGroupBar.js";

import bell from "src/views/_Common/svg/bell.svg";
import none from "src/views/_Common/svg/none.svg";
import logo from "src/views/_Common/svg/logo.svg";
import logoDark from "src/views/_Common/svg/logo-dark.svg";
import green from "src/views/User/svg/green.svg";
import yellow from "src/views/User/svg/yellow.svg";

// Feature flag - messaging disabled until Phase 5 data migration
const USE_MESSENGER = isMessengerNavigationEnabled();

function Header({ isReady }) {
  const appController = useAppController();
  let dynamicContent = null;
  let homeLink = (
    <div className="headerTitle">
      {label("home_title")}
    </div>
  );
  if (isReady && appController.states?.user?.user) {
    dynamicContent = (
      <>
        <Notifications />
        {USE_MESSENGER && <StudyGroupBar />}
      </>
    );
    homeLink = (USE_MESSENGER && !HIDE_HOME_NAV) ? <Link to="/home">{homeLink}</Link> : homeLink;
  }

  if (isMobile() && appController) return <MobileHeader />

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
        <img src={appController?.states?.preferences?.darkMode ? logoDark : logo} alt="logo" />
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


function MobileHeader() {
  const appController = useAppController();
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
    <img src={yellow} alt="" />
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
    <Link to={"/home/user"}>
    <div
      id="header"
      className="heading-bar mobile noselect"
    >
      <div className="logoheader">
        <img src={`${assetUrl}/interface/logo`} alt="" />
        <div>{label("home_title")}</div>
      </div>
      <div className="userheader">
        <div>
          <div className="progresslist">
            <div className="progress_text">
              <img src={green} alt="" /> {completed?.toFixed(1) || 0}%
              {startedString}
            </div>
            <div className="progress">
              <div
                className={"progress-bar progress-bar-success"}
                role="progressbar"
                aria-label={label("completed") || "Completed"}
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
                aria-label={label("started") || "Started"}
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
        <UserAvatar userId={appController.states?.user?.user} profileUrl={img} size={40} />
      </div>
    </div>
      </Link>

  )
}

function Notifications() {
  const appController = useAppController();
  const notificationOpen = appController.states.notification.isNotificationOpen;
  const unreadCount = appController.states.notification.unreadCount || 0;
  const baseLabel = label("notifications") || "Notifications";
  const ariaLabel =
    unreadCount > 0
      ? `${baseLabel} (${unreadCount} ${label("unread") || "unread"})`
      : baseLabel;
  return (
    <>
      {notificationOpen ? (
        <NotificationList />
      ) : null}
      <button
        type="button"
        className="headerButton notificationBell"
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={notificationOpen}
        onClick={() =>
          appController.functions.openNotification(!notificationOpen)
        }
      >
        <img src={bell} alt="" />
        {unreadCount > 0 ? (
          <span className="notificationBadge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
    </>
  );
}

function NotificationList() {
  const appController = useAppController();
  const { items = [], loading } = appController.states.notification;
  const hasUnread = items.some((n) => !n.is_read);

  // Esc closes the dropdown (keyboard operability).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") appController.functions.openNotification(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [appController.functions]);

  // Navigate to the notification target, mark it read, and close the dropdown.
  const handleClick = (n) => {
    appController.functions.markNotificationRead(n.id);
    let slug = null;
    if (n.channel_url && n.message_id) {
      slug = `group/${n.channel_url}/${n.message_id}`;
    } else if (n.channel_url) {
      slug = `group/${n.channel_url}`;
    }
    if (slug) appController.functions.setSlug(slug);
    appController.functions.openNotification(false);
  };

  return (
    <div className="NotificationList" role="dialog" aria-label={label("notifications") || "Notifications"}>
      <div className="NotificationList-header">
        <h5>{label("notifications") || "Notifications"}</h5>
        {hasUnread ? (
          <button
            type="button"
            className="NotificationList-markAll"
            onClick={() => appController.functions.markAllNotificationsRead()}
          >
            {label("mark_all_read") || "Mark all read"}
          </button>
        ) : null}
      </div>
      <ul>
        {loading && items.length === 0 ? (
          <li className="NotificationList-empty">{label("loading") || "Loading…"}</li>
        ) : items.length === 0 ? (
          <li className="NotificationList-empty">
            <img src={none} alt="" />
            {label("no_notifications")}
          </li>
        ) : (
          items.map((n) => (
            <li key={n.id} className={n.is_read ? "read" : "unread"}>
              <button
                type="button"
                className="NotificationList-item"
                onClick={() => handleClick(n)}
              >
                {n.actor?.profile_url ? (
                  <UserAvatar
                    userId={n.actor.user_id}
                    profileUrl={n.actor.profile_url}
                    size={28}
                  />
                ) : (
                  <img src={bell} alt="" />
                )}
                <span className="NotificationList-text">{n.text}</span>
                {!n.is_read ? (
                  <span className="NotificationList-dot" aria-hidden="true" />
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
