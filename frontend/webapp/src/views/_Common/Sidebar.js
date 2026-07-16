import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { isMessengerEnabled } from '../../models/featureFlags';
import { Link, NavLink, useHistory, useRouteMatch } from "react-router-dom";
import { Nav, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import "./Sidebar.css";
import { breakCache, determineLanguage, label, tokenImage } from "src/models/Utils.js";
import { getSearchSlug } from "src/models/searchSlug";
import crypto from "crypto-browserify";
import UserAvatar from "src/components/UserAvatar";

import soundOn from "src/views/User/svg/sound-on.svg"
import soundOff from "src/views/User/svg/sound-off.svg"
import settings from "src/views/User/svg/settings.svg"
import ReactTooltip from "react-tooltip";
import home from "./svg/home.svg";
import community from "../Home/community.svg";
import study from "./svg/study.svg";
import read from "./svg/read.svg";
import contents from "./svg/contents.svg";
import book from "./svg/book.svg";
import timeline from "./svg/timeline.svg";
import people from "./svg/people.svg";
import relationships from "./svg/relationships.svg";
import loghistory from "./svg/loghistory.svg";
import places from "./svg/places.svg";
import maps from "./svg/maps.svg";
import fax from "./svg/facsimiles.svg";
import theology from "./svg/theology.svg";
import historyicon from "./svg/history.svg";
import analysis from "./svg/analysis.svg";
import about from "./svg/about.svg";
import theater from "./svg/theater.svg";
import contact from "./svg/contact.svg";
import audit from "./svg/audit.svg";
import { assetUrl } from "src/models/BoMOnlineAPI";

import en from "./svg/flags/en.svg";
import fr from "./svg/flags/fr.svg";
import de from "./svg/flags/de.svg";
import kr from "./svg/flags/kr.svg";
import vn from "./svg/flags/vn.svg";
import tgl from "./svg/flags/tgl.svg";
import es from "./svg/flags/es.svg";
import swe from "./svg/flags/swe.svg";
import ru from "./svg/flags/ru.svg";
import slv from "./svg/flags/slv.svg";
import tr from "./svg/flags/tr.svg";
import { menuConfig } from "./menuConfig";
import { isMobile } from "../../models/Utils";
import { useAppController } from "src/contexts/AppControllerContext";
import { useMessenger } from "src/contexts/MessengerContext";


// Icon mapping for menu items
const iconMap = {
  home,
  community,
  contents,
  study,
  read,
  특별반: book,
  theater,
  timeline,
  people,
  relationships,
  places,
  map: maps,
  fax,
  theology,
  history: historyicon,
  analysis,
  about,
  audit
};


export const MenuItem = ({ icon, labelKey, customTitle }) => {

  const m = isMobile();
  if(m) return <div style={{display: "flex", alignItems: "center", gap: "0.5rem"}}>
    <img src={icon} alt={labelKey} />
    <div><b>{customTitle || label(labelKey)}</b></div>
    </div>
  return (
    <span>
      <img src={icon} alt={labelKey} />
      {customTitle || label(labelKey)}
    </span>
  );
};

export function loadMenu(){

  const lang = determineLanguage();

  // Build menu list from configuration
  var list = menuConfig.map(item => {
    const icon = iconMap[item.slug];
    const jsx = <MenuItem 
      icon={icon} 
      labelKey={item.labelKey} 
      customTitle={item.customTitle} 
    />;
    
    return {
      slug: item.slug,
      jsx: jsx,
      lang: item.lang,
      langNot: item.langNot,
      dev: item.dev,
      beta: item.beta,
      requiresMessenger: item.requiresMessenger
    };
  });

  // Feature flag - messaging disabled until Phase 5 data migration
  const USE_MESSENGER = isMessengerEnabled();

  return list.filter(i=>{
    // Filter by messenger requirement
    if (i.requiresMessenger && !USE_MESSENGER) return false;
    return true;
  }).filter(i=>{
    const envIsDev = /localhost|^dev/.test(window.location.hostname);
    const itemIsDev = i.dev;
    const okayToShowBasedOnDev = itemIsDev ? envIsDev : true;
    return okayToShowBasedOnDev;
  }).filter(i => {
    const envLang = lang;
    const itemLangs = i.lang;
    const itemLangsNot = i.langNot;
    
    // Check whitelist (lang)
    const okayToShowBasedOnLang = itemLangs ? itemLangs.includes(envLang) : true;
    
    // Check blacklist (langNot)
    const okayToShowBasedOnLangNot = itemLangsNot ? !itemLangsNot.includes(envLang) : true;
    
    return okayToShowBasedOnLang && okayToShowBasedOnLangNot;
  });

}

function SearchBox({setActivePath}) {

  const appController = useAppController();
  const history = useHistory();

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      appController.activeLeafCursorController?.activeAudio?.pause();
      appController.functions.closePopUp();
      setActivePath("/search");
      let searchSlug = getSearchSlug(e.target.value);
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

const clamp = (lo, v, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Fits the menu into whatever vertical space the sidebar has, smoothly and
 * without ever clipping. All items live in a flex column (`flex:1 1 0`) so they
 * always share the height exactly — nothing overflows or overlaps regardless of
 * item count. This hook only picks the *presentation* for the resulting per-row
 * height (measured live via ResizeObserver) and writes CSS variables + a
 * `data-mode` the stylesheet reads:
 *
 *   • full — icon + label; font scales continuously with row height
 *   • grid — once labels no longer fit legibly, drop them and flow the icons
 *            into a 2–3 column grid, using the horizontal space so each icon
 *            stays a comfortable tap target instead of a crammed single-column
 *            sliver. Column count scales with how short the viewport is.
 *
 * Font/icon scaling is continuous (no breakpoints); only the single full→grid
 * switch is discrete, and every item stays visible and clickable throughout.
 */
function useSidebarFit(ref, itemCount) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const set = (k, v) => el.style.setProperty(k, v);
    const measure = () => {
      const h = el.clientHeight;
      if (!h) return;
      const search = el.querySelector(".searchbox");
      const searchH = search ? search.offsetHeight : 40;
      const avail = Math.max(1, h - searchH);
      const n = Math.max(1, itemCount);
      const rowH = avail / n; // height one labeled row would get, single column

      if (rowH >= 16) {
        // Labeled rows. 1.38rem ≈ 22px is the original max; font shrinks
        // continuously with the row height, keeping labels as long as they stay
        // legible (down to ~11px) before we give them up.
        el.dataset.mode = "full";
        set("--sb-font", clamp(11, rowH * 0.55, 22) + "px");
      } else {
        // Labels no longer fit — drop to an icon grid. Use the fewest columns
        // (2, then 3) that keep each cell a comfortable height.
        let cols = 2;
        if (avail / Math.ceil(n / 2) < 24) cols = 3;
        const rows = Math.ceil(n / cols);
        const cellH = avail / rows;
        el.dataset.mode = "grid";
        set("--sb-cols", cols);
        set("--sb-rows", rows);
        set("--sb-icon", clamp(14, cellH * 0.55, 30) + "px");
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, itemCount]);
}

function Sidebar(props) {
  const appController = useAppController();
  const match = useRouteMatch();

  const menu = loadMenu();
  const menuRef = useRef(null);
  useSidebarFit(menuRef, menu.length);

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
        appController.states?.studyGroup.isDrawerOpen &&
          appController.functions.openDrawer(false);
        appController.states?.notification.isNotificationOpen &&
          appController.functions.openNotification(false);
        appController.states?.studyGroup.isGroupListOpen &&
          appController.functions.openGroupList(false);
      }}
    >

      <div className="sidebar-wrapper">
        <UserInfo
          setActivePath={setActivePath}
          activePath={activePath}
        />
        <ul className="nav sidebar-menu" ref={menuRef}>
          <SearchBox setActivePath={setActivePath} />
          {menu.map((r,index) => {
            let isActive = activePath.match(new RegExp("^/" + r.slug));
            let activeClass = isActive ? "active" : "";
            let betaBadge = r.beta ? <span className="badge menu_beta">Beta</span> : null;
            return (
              <li className={r.slug + "_link  menuitem " + activeClass} key={r.slug} >
                <NavLink
                  to={"/" + r.slug}
                  activeClassName=""
                  onClick={() => {
                    appController.activeLeafCursorController?.activeAudio?.pause();
                    appController.functions.closePopUp();
                    setActivePath("/" + r.slug)}}
                >
                  <span className="sidebar-normal">{r.jsx} {betaBadge}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
        <LanguageSelect />
      </div>
    </div>
  );
}


function LanguageSelect() {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggle = () => setDropdownOpen(prevState => !prevState);

  const langs = {
    en: {
      url: "https://bookofmormon.online",
      label: "English",
      icon: en
    },
    es: {
      url: "https://libromormon.es",
      label: "Español",
      icon: es
    },
    fr: {
      url: "https://livredemormon.fr",
      label: "Français",
      icon: fr
    },
    de: {
      url: "https://buchmormon.de",
      label: "Deutsch",
      icon: de
    },
    swe:{
      url: "https://swe.bookofmormon.online",
      label: "Svenska",
      icon: swe
    },
    slv:{
      url: "https://mormonovaknjiga.si",
      label: "Slovenščina",
      icon: slv
    },
    ru:{
      url: "https://xn--80aahtjpadfibw.net",
      label: "Русский",
      icon: ru
    },
    ko: {
      url: "https://몰몬경.kr",
      label: "한국어",
      icon: kr
    },
    vn: {
      url: "https://sachmacmon.vn",
      label: "Tiếng Việt",
      icon: vn
    },
    tr: {
      url: "https://tr.bookofmormon.online",
      label: "Türkçe",
      icon: tr
    },
    tgl: {
      url: "https://tgl.bookofmormon.online",
      label: "Tagalog",
      icon: tgl
    },
  }

  const selectLanguage = (language) => {
    
    window.clicky?.goal("language");
    const currentPath = window.location.pathname;
    const selectedUrl = langs[language].url;
    window.location.href = selectedUrl + currentPath;
  };

  const currentLang = determineLanguage();

  if(!langs[currentLang]) return null;

  return (
    <div className="languageSelect">
      <Dropdown isOpen={dropdownOpen} toggle={toggle}>
        <DropdownToggle >
          <img src={langs[currentLang]?.icon} alt="" />
           {langs[currentLang].label}
            </DropdownToggle>
        <DropdownMenu container={'.sidebar-wrapper'} className="languageDropdown">
          <DropdownItem header>{label("lang_select")}</DropdownItem>
          {Object.keys(langs).map((lang, index) => {
            return (
              <DropdownItem 
                key={index} 
                onClick={() => selectLanguage(lang)}
                disabled={currentLang === lang}  // Add this line
              >
                <img src={langs[lang]?.icon} alt="" />
                {langs[lang].label}
              </DropdownItem>
            );
          })}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}

export default Sidebar;

function UserInfo({ setActivePath, activePath }) {

  const appController = useAppController();
  const messenger = useMessenger();
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


  const socialUser = appController.states?.user?.social && appController.states?.user?.user;
  const nonSocialUser = appController.states?.user?.user && !appController.states?.user?.social;
  const notLoggedIn = !socialUser && !nonSocialUser;
  useEffect(() => {
    if (socialUser) {
      setName(appController.states?.user?.social.nickname);
      setImg(appController.states?.user?.social.profile_url);
    } else if (nonSocialUser) {
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

  if (name === label("loading_user") && messenger.sb?.currentUser?.user_id) {
    setName(messenger.sb.currentUser.nickname);
    setImg(messenger.sb.currentUser.plainProfileUrl );
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
          
          appController.activeLeafCursorController?.activeAudio?.pause();
          appController.functions.closePopUp();

          setActivePath("/user");
          }}>
          <div className="nameContainer">
            {" "}
            <UserAvatar userId={appController.states?.user?.user} profileUrl={img} size={50} />
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
            <img onClick={toggleSound} role="button" tabIndex={0} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleSound();}}} data-tip={(appController.states?.preferences.audio ? label("audio_on") : label("audio_off"))} src={appController.states?.preferences.audio ? soundOn : soundOff} alt={(appController.states?.preferences.audio ? label("audio_on") : label("audio_off"))} />
            <Link to={"/user/preferences"} aria-label={label("user_prefs")}><img data-tip={label("user_prefs")} src={settings} alt={label("user_prefs")} /></Link>
            {!notLoggedIn && <NavLink to={"/user/history"} aria-label={label("user_history")}>
              <img data-tip={label("user_history")} src={loghistory} alt={label("user_history")} />
            </NavLink>}
          </div>
      </li>
    </Nav>
  );
}
