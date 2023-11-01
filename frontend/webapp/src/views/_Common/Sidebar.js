import React, { useState, useEffect } from "react";
import { Link, NavLink, useHistory, useRouteMatch } from "react-router-dom";
import { Nav } from "reactstrap";
import "./Sidebar.css";
import { breakCache, determineLanguage, label, tokenImage } from "src/models/Utils.js";
import crypto from "crypto-browserify";

import soundOn from "src/views/User/svg/sound-on.svg"
import soundOff from "src/views/User/svg/sound-off.svg"
import settings from "src/views/User/svg/settings.svg"
import ReactTooltip from "react-tooltip";
import home from "./svg/home.svg";
import study from "./svg/study.svg";
import contents from "./svg/contents.svg";
import book from "./svg/book.svg";
import timeline from "./svg/timeline.svg";
import people from "./svg/people.svg";
import relationships from "./svg/relationships.svg";
import roadmap from "./svg/roadmap.svg";
import places from "./svg/places.svg";
import maps from "./svg/maps.svg";
import fax from "./svg/facsimiles.svg";
import historyicon from "./svg/history.svg";
import analysis from "./svg/analysis.svg";
import about from "./svg/about.svg";
import theater from "./svg/theater.svg";
import contact from "./svg/contact.svg";
import { assetUrl } from "src/models/BoMOnlineAPI";


export function loadMenu(){
  var list = [
    { slug: "home", title: <span><img src={home} /> {label("menu_home")}</span> },
    { slug: "contents", title: <span><img src={contents} /> {label("menu_contents")}</span> },
    { slug: "study", title: <span><img src={study} /> {label("menu_study")}</span> },
    { slug: "theater", title: <span><img src={theater} /> {label("menu_theater")}</span> },
    { slug: "timeline", title: <span><img src={timeline} /> {label("menu_timeline")}</span> },
    { slug: "people", title: <span><img src={people} /> {label("menu_people")}</span> },
    { slug: "relationships", title: <span><img src={relationships} /> {label("menu_network")}</span>, dev:true },
    { slug: "places", title: <span><img src={places} /> {label("menu_places")}</span> },
    { slug: "map", title: <span><img src={maps} /> {label("menu_map")}</span> },
    { slug: "fax", title: <span><img src={fax} /> {label("menu_fax")}</span> },
    { slug: "history", title: <span><img src={historyicon} /> {label("menu_history")}</span> },
    { slug: "analysis", title: <span><img src={analysis} /> {label("menu_analysis")}</span>, dev:true },
    { slug: "about", title: <span><img src={about} /> {label("menu_about")}</span> },
  ];

  if(determineLanguage()==="ko")
  {
    list.splice(3,0, { slug: "특별반", title: <span><img src={book} />특별반</span> });
  }
  return list.filter(i=>{
    const isDev = /localhost|^dev/.test(window.location.hostname);
    return !i.dev || isDev;
  });
}


function SearchBox({appController,setActivePath}) {

  const history = useHistory();

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      appController.activePageController?.states?.activeAudio?.pause();
      appController.functions.closePopUp(); 
      setActivePath("/search");
      let searchSlug = e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9:–—~-]+/gi, ".")
        .replace(/(^\.|\.$)/g, "");
      history.push("/search/" + searchSlug);
      e.preventDefault();
    }
  };

  return <li className={"searchbox"}>
    <input
      type="text" 
      placeholder={label("search")}
      onKeyDown={handleKeyDown}
     />
     </li>
}

function Sidebar(props) {
  const match = useRouteMatch();

  const menu = loadMenu();

  const determinePath = () => {
    let slugs = menu.map((m) => m.slug);
    let slugRoot = window.location.pathname.split("/")[1];
    if (["message", "", "invite"].includes(slugRoot)) return "/home";
    if (["search"].includes(slugRoot)) return "/search";
    if (["user"].includes(slugRoot)) return "/user";
    if (["%ED%8A%B9%EB%B3%84%EB%B0%98","studyedition"].includes(slugRoot)) return "/특별반";
    if (slugs.indexOf(slugRoot) >= 0) return window.location.pathname;
    return "/study";
  }

  const [activePath, setActivePath] = useState(determinePath);

  useEffect(() => {
    setActivePath(determinePath);
  }, [window.location.pathname, match.params])


  let URLsearchTerm = window.location.pathname.split("/").reverse()[0];
  if (window.location.pathname === activePath) URLsearchTerm = null;
  return (
    <div
      className="sidebar noselect"
      data-color={props.bgColor}
      data-active-color={props.activeColor}
      onClick={(e) => {
        props.appController.states?.studyGroup.isDrawerOpen &&
          props.appController.functions.openDrawer(false);
        props.appController.states?.notification.isNotificationOpen &&
          props.appController.functions.openNotification(false);
        props.appController.states?.studyGroup.isGroupListOpen &&
          props.appController.functions.openGroupList(false);
      }}
    >

      <div className="sidebar-wrapper">
        <UserInfo
          appController={props.appController}
          setActivePath={setActivePath}
          activePath={activePath}
        />
        <Nav className="sidebar-menu">
          <SearchBox appController={props.appController} setActivePath={setActivePath} />
          {menu.map((r,index) => {
            let isActive = activePath.match(new RegExp("^/" + r.slug));
            let activeClass = isActive ? "active" : "";
            return (
              <li className={r.slug + "_link  menuitem " + activeClass} key={r.slug} >
                <NavLink
                  to={"/" + r.slug}
                  activeClassName=""
                  onClick={() => {
                    props.appController.activePageController?.states?.activeAudio?.pause();
                    props.appController.functions.closePopUp(); 
                    setActivePath("/" + r.slug)}}
                >
                  <span className="sidebar-normal">{r.title}</span>
                </NavLink>
              </li>
            );
          })}
        </Nav>
      </div>
    </div>
  );
}

export default Sidebar;

function UserInfo({ appController, setActivePath, activePath }) {

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

  let startedString = (completed > started) ? "" : (" • " + (started?.toFixed(1) || 0) + "% " + label("started"))


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

  if (name === label("loading_user") && appController.sendbird?.sb.currentUser?.user_id) {
    setName(appController.sendbird.sb.currentUser.nickname);
    setImg(appController.sendbird.sb.currentUser.plainProfileUrl );
  }

  const toggleSound = (e) => {
    e.stopPropagation();
    e.preventDefault();
    let prefs = appController.states?.preferences;
    prefs.audio = !prefs.audio;
    appController.functions.updatePrefs(prefs);
    ReactTooltip.hide();
  }

  let isActive = activePath.match(new RegExp("^/user"));
  let activeClass = isActive ? "active" : "";

  return (
    <Nav className="userNav">
      <li className={activeClass}>
        <NavLink to={"/user"} onClick={() => {
          
          appController.activePageController?.states?.activeAudio?.pause();
          appController.functions.closePopUp();

          setActivePath("/user");
          }}>
          <div className="nameContainer">
            {" "}
            <img alt={name} src={img } onError={breakCache} />
            <div className={"name"}>{name}</div>
          </div>
          <div className="progresslist">
            <div className="progress_text">
              {completed?.toFixed(1) || 0}% {label("completed")}
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
        </NavLink>
          <div className="settings">

            <ReactTooltip
              effect="solid"
              place="top"
              className="react-component-tooltip"
              backgroundColor="#666"
              //textColor="#000"
              border={true}
              opacity="0.5"
              id="text-only-tooltip"
            />
            <img onClick={toggleSound} data-tip={(appController.states?.preferences.audio ? label("audio_on") : label("audio_off"))} src={appController.states?.preferences.audio ? soundOn : soundOff} />
            <Link to={"/user/preferences"}><img data-tip={label("user_prefs")} src={settings} /></Link>
          </div>
      </li>
    </Nav>
  );
}
