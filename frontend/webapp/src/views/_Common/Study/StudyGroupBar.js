import React, { useState, useEffect, useRef } from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { CallCircle } from "./StudyGroupCall";
import { toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"

import { error } from "src/models/alertMessageService";

import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Label, Button, Toast } from 'reactstrap';
// import { groups } from "src/models/dummyData/dummydata";

import { StudyHall } from "src/views/_Common/Study/StudyHall.js";
import { StudyGroupSelect } from "./StudyGroupSelect";
import "./StudyGroupBar.scss";
import { ActionBubble } from "./ActionBubble";
import crypto from "crypto-browserify";
import { breakCache, diffMap, label, md5, playSound } from "src/models/Utils";

import green from "src/views/User/svg/green.svg";
import yellow from "src/views/User/svg/yellow.svg";
import grey from "src/views/User/svg/blank.svg";
import blue from "src/views/User/svg/blue.svg";
import socket from "src/views/User/svg/socket.svg";
import count from "src/views/User/svg/count.svg";
import cake from "src/views/User/svg/cake.svg";
import parkingmeter from "src/views/User/svg/parkingmeter.svg";
import bookmarkicon from "src/views/User/svg/bookmark.svg";
import lastseen from "src/views/User/svg/lastseen.svg";
import crosshairs from "src/views/User/svg/crosshairs.svg";
import chat from "src/views/User/svg/chat.svg";
import messageicon from "src/views/User/svg/messageicon.svg";
import groupicon from "src/views/User/svg/group.svg";
import trophy from "src/views/User/svg/trophy.svg";
// const uuid4 = () => {
//     let d = new Date().getTime();
//     return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
//         const r = (d + Math.random() * 16) % 16 | 0;
//         d = Math.floor(d / 16);
//         return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
//     });
// };
import typing from "./svg/typing.svg";
import moment from "moment";
import momentDurationFormatSetup from "moment-duration-format";
import { Link } from "react-router-dom";
import { history } from "src/models/routeHistory";
import { Switch } from "react-router-dom/cjs/react-router-dom.min";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";
momentDurationFormatSetup(moment);

toast.configure({
  limit: 4,
});


const toaster = (appController, src, color, val) => {
  if (!appController.states.studyGroup.studyModeOn) return false;
  toast.clearWaitingQueue();
  toast.dismiss();
  toast.info(<div className={"toastBox " + color}>
    <img src={src} onError={breakCache} />
    <div>{val}</div>
  </div>, { position: toast.POSITION.BOTTOM_LEFT, autoClose: 6000 });
}


export function StudyGroupBar({ appController }) {

  useEffect(() => {
    if (appController.states.studyGroup.isDrawerOpen)
      document.querySelector("body").classList.add("noscroll");
    else {
      document.querySelector("body").classList.remove("noscroll");
    }
  }, [appController.states.studyGroup.isDrawerOpen]);

  let isDrawerOpenClass = appController.states.studyGroup.isDrawerOpen ? " drawerOpen" : "";

  return (
    <div
      tabIndex={1}
      className={"StudyGroupBar" + isDrawerOpenClass}
    >
      <div tabIndex={2}>
        <StudyGroupDrawer
          isOpen={appController.states.studyGroup.isDrawerOpen}
          appController={appController}
        />
      </div>
      <StudyGroupSelect appController={appController} />
      <StudyGroupStatus
        appController={appController}
        onClick={() => {
          appController.functions.openDrawer(
            !appController.states.studyGroup.isDrawerOpen
          );
        }}
      />
    </div>
  )
}


export function getFreshUsers(appController) {

  const determineColor = userObject => userObject.inCall ? "blue" : userObject.isInGroup ? "green" : userObject.isOnSite ? "yellow" : "grey";
  let group = appController.states.studyGroup.activeGroup;
  if (!group) return null;
  let call = appController.states.studyGroup.activeCall;
  let callers = call?._participantCollection?._remoteParticipants?.map(p => p.user?.userId) || [];

  let users = group.members?.filter((m) => {
    const isSelf = m.userId === appController.states.user.social.user_id
    const isBot = !!m.metaData?.isBot
    if (isSelf || isBot) return false;
    return true;
  }) || [];

  let bots = group.members?.filter((m) => {
    const isSelf = m.userId === appController.states.user.social.user_id
    const isBot = !!m.metaData?.isBot
    if (isSelf || !isBot) return false;
    return true;
  }) || [];

  for (let i in users) {
    let userGroup = users[i].metaData.activeGroup;
    let thisGroup = group?.url;
    users[i].isInGroup = userGroup === thisGroup && users[i].connectionStatus === "online";
    users[i].inCall = callers.includes(users[i].userId) && userGroup === thisGroup && users[i].connectionStatus === "online";
    users[i].isOnSite = users[i].connectionStatus === "online" && userGroup !== ""; //TODO and study Mode On
    users[i].color = determineColor(users[i]);
  }
  if (!users && !bots && !users?.length && !bots?.length) return { users: [], bots: [] }
  const userlist = users.sort((a, b) => {


    let asummary = {};
    try { asummary = JSON.parse(a?.metaData?.summary) } catch (e) { }
    let bsummary = {};
    try { bsummary = JSON.parse(b?.metaData?.summary) } catch (e) { }

    let acompleted = asummary.completed || 0;
    let bcompleted = bsummary.completed || 0;

    let diff = bcompleted - acompleted;
    if (a.inCall && !b.inCall)
      return -1;
    if (b.inCall && !a.inCall)
      return 1;
    if (a.isInGroup && !b.isInGroup)
      return -1;
    if (b.isInGroup && !a.isInGroup)
      return 1;
    if (a.isOnSite && !b.isOnSite)
      return -1;
    if (b.isOnSite && !a.isOnSite)
      return 1;
    return diff;
  });

  return { users: userlist, bots };

}


function StudyGroupStatus({ appController }) {

  let playSounds = appController.states.preferences.sound;

  const [cameOnline] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/contacts-online`)
    sound.preload = "auto";
    return sound;
  });
  const [wentOffline] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/contacts-offline`)
    sound.preload = "auto";
    return sound;
  });
  const [enteredCall] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/caller-online`)
    sound.preload = "auto";
    return sound;
  });
  const [exitedCall] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/caller-offline`)
    sound.preload = "auto";
    return sound;
  });

  const getColorMap = users => {
    let map = {};
    for (let i in users) map[users[i].userId] = users[i].color;
    return map;
  }

  let { users, bots } = (getFreshUsers(appController) || { users: [], bots: [] });
  const [userColors, setUserColors] = useState(getColorMap(users));


  useEffect(() => {
    setUserColors((oldColors) => {
      let newColors = getColorMap(users);

      // Check if new colors and old colors are the same
      if (JSON.stringify(newColors) === JSON.stringify(oldColors)) {
        return oldColors;
      }

      const sounds = appController.states.preferences.sound;
      let diff = diffMap(oldColors, newColors);

      if (diff[appController.states.user.user]) return newColors;

      let diffCounts = Object.keys(diff).length;
      if (diffCounts !== 1) return newColors;

      let username = Object.keys(diff)[0];
      let mysocialId = appController.states.user.social.user_id;
      let user = appController.states.studyGroup.activeGroup?.memberMap[username] || {};
      let { oldVal: oldColor, newVal: newColor } = Object.values(diff)[0];
      const isMe = mysocialId === username;



      //debugger;

      if (!!appController.states.studyGroup.studyModeOn && !isMe) {

        let notificationHistory = JSON.parse(localStorage.getItem("notificationHistory")) || [];
        const time = moment().unix();

        if (newColor === "blue") {
          if (sounds) playSound(enteredCall)
          toaster(appController,user.profileUrl, newColor, label("x_joined_a_call", [user.nickname]));
        }
        if (["blue"].includes(oldColor) && ["green"].includes(newColor)) {
          if (sounds) playSound(exitedCall);
        }

        if (newColor === "green") {
          if (notificationHistory.find(x => x.userId === user.userId && x.type === "online")) return newColors; // prevent notification flood
          if (sounds) playSound(cameOnline)
          toaster(appController,user.profileUrl, newColor, label("x_came_online", [user.nickname]));  // prevent notification flood
          notificationHistory.push({ userId: user.userId, time, type: "online" });

        }

        if (["blue", "green"].includes(oldColor) && ["yellow", "grey"].includes(newColor)) {
          if (notificationHistory.find(x => x.userId === user.userId && x.type === "offline")) return newColors; // prevent notification flood
          if (sounds) playSound(wentOffline)
          toaster(appController,user.profileUrl, newColor, label(newColor === "yellow" ? "x_switched_groups" : "x_went_offline", [user.nickname]));
          notificationHistory.push({ userId: user.userId, time, type: "offline" });
        }

        const deadline = moment().subtract(5, "minutes").unix();
        notificationHistory = notificationHistory.filter(x => x.time > deadline);
        localStorage.setItem("notificationHistory", JSON.stringify(notificationHistory));

      }
      return newColors;
    })

  }, [users]);


  if (appController.states.studyGroup.activeGroup === -1) return null;
  if (!appController.states.studyGroup.activeGroup) return null;
  if (!appController.states.studyGroup.studyModeOn) return null;

  let liveMessageQueue = appController.states.studyGroup.liveMessageQueue || {};
  let activeLiveMessageId = Object.keys(liveMessageQueue).shift();
  let activeLiveMessageSender = liveMessageQueue[activeLiveMessageId]?._sender?.userId;

  let greenUsers = users?.filter(u => u.color === "green") || [];

  return (
    <div
      className={
        "userStatus" +
        (appController.states.studyGroup.isDrawerOpen ? " hidden" : "")
      }
    >

      <BotCircles bots={bots} appController={appController} />
      {greenUsers?.length >= 1 ? <><div className="divider"></div><CallCircle appController={appController} /></> : null}
      <audio id="call_audio" autoPlay={true} />
      {users?.slice(0, 11).map((user) => (
        <StudyGroupUser
          color={userColors[user?.userId]}
          key={user?.userId}
          userObject={user}
          appController={appController}
          liveMessage={user?.userId === activeLiveMessageSender ? liveMessageQueue[activeLiveMessageId] : null}
        />
      ))}
      <div className="divider"></div>

    </div>
  );
}

function BotPlugin({ appController }) {

  const iAmOperator = appController.states.studyGroup.activeGroup?.myRole === "operator";
  const [isDroppedDown, setDroppedDown] = useState(false);
  const userId = "bot";
  const channel = appController.states.studyGroup.activeGroup?.url;
  const [addingBot, setAddingBot] = useState(false);
  const [bots, setBots] = useState([]);

  const [buttonPush] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/drop`)
    sound.preload = "auto";
    return sound;
  });
  
  const [cameOnline] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/contacts-online`)
    sound.preload = "auto";
    return sound;
  });
  
  const addBot = async (bot) => {
    const {id, name, picture} = bot;
    let token = appController.states.user.token;
    setAddingBot(true);
    //play wentOffline
    if (buttonPush) playSound(buttonPush);
    let r = await BoMOnlineAPI({ addBot: { token, channel, bot: id } });
    if (cameOnline) playSound(cameOnline);
    setAddingBot(false);
    toaster(appController, picture, "green", label("bot_added", [name]));
    const activeGroup = appController.states.studyGroup.activeGroup;
    const freshGroup = await activeGroup.refresh();
    appController.functions.setActiveStudyGroup(freshGroup);


  }

  useEffect(() => {

    const getBots = async () => {
      let r = await BoMOnlineAPI({ botlist: null , useCache:false});
      setBots(r?.botlist.sort(((a,b)=>{
        return a.enabled !== b.enabled ? a.enabled ? -1 : 1 : 0;
      })) || []);
    }
    getBots();

  }, []);

  if(!iAmOperator) return null;


  return  <React.Fragment key={userId}>
    <div className={"noselect divider"} key={userId}></div>
    <Dropdown isOpen={isDroppedDown}
      onMouseEnter={() => { if (!appController.states.studyGroup.isDrawerOpen) setDroppedDown(true) }}
      onMouseLeave={() => setDroppedDown(false)}
      toggle={() => { }}
      className="botPluginDropdown"
    >
      <DropdownToggle tag="div" className="DropdownToggleContainer" onClick={()=>{}} key={userId}>
        <div className="botPlugin">
        <img src={socket}/>
        </div>
      </DropdownToggle>
      <DropdownMenu className="dropdownMenu" key={userId}>
        <DropdownItem header>
          {label("plugin_bot")}
        </DropdownItem>
        <DropdownItem divider />
        <DropdownItem className="dropdownInfoBox disabled">
          <p>{label("bot_info")}</p>
        </DropdownItem>
        
        {bots.map(bot => {bot?.id ? <><DropdownItem divider/><DropdownItem className={`botItem ${bot?.enabled ? "enabled" : "disabled"}`}
        key={bot?.id} onClick={()=>{
          if(bot?.enabled) addBot(bot);
        }}>
          <div className={`botInfo`} key={bot?.id} >
            <img src={bot?.picture} />
            <div className="botInfoText">
              <h6 className="botName">{bot?.name}<Button>{addingBot? label("bot_plugging", [bot?.name]) : label("bot_select")}</Button></h6>
              <div className="botDescription">{bot?.description}</div>
            </div>
          </div>
        </DropdownItem></> : null})}
      </DropdownMenu>
    </Dropdown>
  </React.Fragment>

}


function BotCircles({ bots, appController }) {

  bots = bots?.length ? bots : [];

  if (!bots.length) return <BotPlugin appController={appController} />;


  return bots.map((bot) => <StudyGroupUser key={bot.userId} userObject={bot} appController={appController} isBot={true} />)


}

export function getClassesFromUserObj(userObject, appController) {

  let activeGroupUrl = appController.states.studyGroup.activeGroup.url;
  let isTyping = appController.states.studyGroup?.[activeGroupUrl]?.includes(userObject.userId);
  let classes = ["userCircle", userObject.userId];
  if (userObject.inCall) classes.push("inCall");
  if (userObject.isInGroup) classes.push("inGroup");
  else if (userObject.isOnSite) classes.push("onSite");
  if (isTyping) classes.push("isTyping");
  return classes;
}

export function StudyGroupUserCircle({ userObject, appController, isBot }) {


  let classes = getClassesFromUserObj(userObject, appController);


  let typingIndicator = (classes.includes("isTyping")) ? <div className={"typing"}><img src={typing} /></div> : null;
  let summary = {}; try { summary = JSON.parse(userObject?.metaData?.summary) } catch (e) { }
  let trophyIcons = (summary.finished) ? <div className="trophyIcons"><img src={trophy} /></div> : null;

  //Determin Green Yellow Grey Blue


  let completedPerc = parseFloat(summary.completed) || 0;
  let badgeVal = (completedPerc) + "%"
  if (userObject.inCall) badgeVal = "📞  " + badgeVal;

  if (isBot) badgeVal = label("bot");
  if (isBot) classes.push("bot");


  let num = (md5(userObject.userId) + "4").match(/[3-9]/)[0];
  let inCallElements = (userObject.inCall) ? <>
    <div className={"userCircleOutline"} style={{ animation: `rotate ${num}s linear infinite` }}></div>
    <div className={"phoneCall"}></div></> : null;

  return <React.Fragment key={userObject.userId}><div
    key={userObject.userId}
    className={classes.join(" ")}
    style={{ backgroundImage: `url(${userObject.profileUrl})` }}
    onClick={() => !isBot && appController.functions.openDrawer({ key: "message", val: userObject.userId })}
  >
    {inCallElements}
    {typingIndicator}
    <div className={"progressBadge"}>{badgeVal}</div>
    {trophyIcons}
  </div>
    <UnreadDMCount appController={appController} userId={userObject.userId} />
  </React.Fragment >

}


export function StudyGroupUser({ userObject, appController, liveMessage, isBot }) {

  const [switchSound] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/switch`)
    sound.preload = "auto";
    return sound;
  });

  const activeChannel = appController.states?.studyGroup?.activeGroup?.url;



  const [buttonPush] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/drop`)
    sound.preload = "auto";
    return sound;
  });
  
  const [wentOffline] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/contacts-offline`)
    sound.preload = "auto";
    return sound;
  });
  
  
  const [isDroppedDown, setDroppedDown] = useState(false);
  const [speechBubbleOpen, setSpeechBubbleOpen] = useState(true);
  const [unplugging, setUnplugging] = useState(false);

  if (!userObject) return null;

  const handleClick = (e) => {
    setDroppedDown(!isDroppedDown);
  };
  const findOtherGroup = (url) => {
    if (!url) return null;
    for (let i in appController.states.studyGroup.groupList) {
      let group = appController.states.studyGroup.groupList[i];
      if (group?.url === url) return group;
    }
    return null;
  }


  let classes = getClassesFromUserObj(userObject, appController);


  let summary = {}; try { summary = JSON.parse(userObject?.metaData?.summary) } catch (e) { }
  let bookmark = {}; try { bookmark = JSON.parse(userObject?.metaData?.bookmark) } catch (e) { }
  let otherGroup = (classes.includes("onSite")) ? findOtherGroup(userObject?.metaData?.activeGroup) : null;
  let linkToItems = null;
  let statusCircle = grey;
  if (classes.includes("onSite")) statusCircle = yellow;
  if (classes.includes("inGroup")) statusCircle = green;
  if (classes.includes("inCall")) statusCircle = blue;


  if (bookmark.slug) linkToItems = (classes.includes("inGroup") || classes.includes("onSite")) ?
    <DropdownItem className="statBox" onClick={() => history.push(bookmark.slug)}>
      <Link to={"/" + bookmark.slug} >
        <div className="statRow">
          <img src={crosshairs} />
          <div>{label("currently_studying")}:</div>
          <div></div>
        </div>
        <div className="statRow link">
          <div>{bookmark.slug ? <span>{bookmark.pagetitle}—{bookmark.heading}</span> : null}</div>
        </div></Link>
    </DropdownItem> :
    <DropdownItem className="statBox" onClick={() => history.push(bookmark.slug)}>
      <Link to={"/" + bookmark.slug} >
        <div className="statRow">
          <img src={bookmarkicon} />
          <div>{label("last_studied")}:</div>
          <div>{bookmark.latest ? moment.unix(bookmark.latest).fromNow() : null}</div>
        </div>
        <div className="statRow link">
          <div>{bookmark.slug ? <><span>{bookmark.pagetitle}{"—"}</span><span className="heading">{bookmark.heading}</span></> : null}</div>
        </div></Link>
    </DropdownItem>;

  let goToGroup = (otherGroup) ? <><DropdownItem divider />
    <DropdownItem className="statBox"

      onClick={() => { appController.functions.setActiveStudyGroup(otherGroup); if (appController.states.preferences.sound) switchSound.play() }} >

      <div className="statRow">
        <img src={otherGroup.coverUrl} />
        <div>{label("current_group")}:</div>
        <div></div>
      </div>
      <div className="statRow group link">

        <div><span>{otherGroup.name}</span></div>
      </div>

    </DropdownItem></> : null;


  let trophyCase = (summary.finished) ? <>
    <DropdownItem divider />
    <DropdownItem disabled className="statBox">
      {summary.finished.map(t =>
        <div className="statRow" key={t}>
          <img src={trophy} />
          <div>{label("completed_on_x", [moment.unix(t).format(label("history_date_format_full"))])}</div>
          <div></div>
        </div>)}
    </DropdownItem></> : null;



  const unplugBot = async (botObject) => {
    const {nickname, profileUrl, userId} = botObject;
    setUnplugging(true);
    let token = appController.states.user.token;
    if(buttonPush) playSound(buttonPush);
    await BoMOnlineAPI({ removeBot: { token, channel: activeChannel, bot: userId } });
    if(wentOffline) playSound(wentOffline);
    toaster(appController,profileUrl, "yellow", label("bot_unplugged", [nickname]));
  }


  let completedPerc = parseFloat(summary.completed) || 0;
  let started = parseFloat(summary.started) || 0;


  let dropDownContent =
    <DropdownMenu >
      <DropdownItem header>
        <img src={statusCircle} />
        {userObject.nickname}
        <div className="progresslist">
          <div className="progress">
            <div
              className={"progress-bar progress-bar-success"}
              role="progressbar"
              style={{
                width: (completedPerc > 0 && completedPerc < 2 ? 2 : completedPerc) + "%",
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
          <div className="progress_text_item">
            <div>{completedPerc?.toFixed(1)}% {label("completed")}</div>
            <div>{started ? started?.toFixed(1) + "% " + label("started") : null}</div>
          </div>

        </div>
      </DropdownItem>
      {trophyCase}
      <DropdownItem divider />
      <DropdownItem disabled className="statBox">
        <div className="statRow">
          <img src={cake} />
          <div>{label("date_started")}</div>
          <div>{summary.first ? moment.unix(summary.first).format(label("history_date_format_full")) : null}</div>
        </div>
        <div className="statRow">
          <img src={parkingmeter} />
          <div>{label("study_time")}</div>
          <div>{summary.duration ? moment.duration(summary.duration, "seconds").format(label("duration_format")) : null}</div>
        </div>
        <div className="statRow">
          <img src={count} />
          <div>{label("study_sessions")}</div>
          <div>{summary.count}</div>
        </div>
      </DropdownItem>
      {goToGroup}
      <DropdownItem divider />
      {linkToItems}
      <DropdownItem divider />
      <DropdownItem onClick={() => appController.functions.openDrawer(true)}>
        <div className="statRow">
          <img src={groupicon} />
          <div>{label("open_study_hall")}</div>
          <div> </div>
        </div></DropdownItem>
      <DropdownItem divider />
      <DropdownItem onClick={() => appController.functions.openDrawer({ key: "message", val: userObject.userId })}>
        <div className="statRow">
          <img src={chat} />
          <div>{label("direct_messages")}</div>
          <div><UnreadDMCount userId={userObject.userId} appController={appController} /></div>
        </div></DropdownItem>
    </DropdownMenu>;

  const iAmOperator = appController.states.studyGroup.activeGroup.myRole==="operator";
  if(isBot) dropDownContent = <DropdownMenu>
    <DropdownItem header className="botHeader">
      <img src={green} />
      <div className="botNickname">{userObject.nickname}</div>
      {iAmOperator && <Button disabled={unplugging} color="danger" onClick={()=>unplugBot(userObject)}>{unplugging ? label("bot_unplugging") : label("bot_unplug")}</Button>}
    </DropdownItem>
    <DropdownItem divider />
    <LiveMessageStudy liveMessage={userObject?.metaData?.welcome || label("bot_intro_x", userObject.nickname)} bookmark={bookmark} appController={appController} />

    {bookmark.slug && bookmark.channel=== activeChannel? <><DropdownItem divider />
      <DropdownItem >
        <Link to={"/" + bookmark.slug} >
          <div className="statRow">
            <img src={crosshairs} />
            <div>{label("recently_commented")}</div>
            <div></div>
          </div>
          <div className="statRow link">
            <div>{bookmark.slug ? <span>{bookmark.pagetitle}—{bookmark.heading}</span> : null}</div>
          </div></Link>
      </DropdownItem></>: null}

  </DropdownMenu>;


  if (liveMessage && !appController.states.studyGroup.isDrawerOpen) {

    let messageData = {}; try { messageData = JSON.parse(liveMessage.data) } catch (e) { };
    messageData.messageId = liveMessage.messageId;
    messageData.customType = liveMessage.customType;
    if (liveMessage.parentMessageId) messageData.parentMessageId = liveMessage.parentMessageId;

    if (messageData?.links?.text) bookmark.slug = messageData.customType + "/" + messageData?.links?.text;



    dropDownContent = isBot ? null :<DropdownMenu className="liveMessage">
      <DropdownItem header >
        <img src={statusCircle} />
        {userObject.nickname}
        <img src={messageicon} className="chatIcon" />
      </DropdownItem>

      {liveMessage.channel.customType === "DM" ? <LiveMessageDM liveMessage={liveMessage} userObject={userObject} appController={appController} /> :
        <LiveMessageStudy liveMessage={liveMessage} bookmark={bookmark} appController={appController} />
      }


      <DropdownItem divider />
      <DropdownItem >
        <Link to={"/" + bookmark.slug} >
          <div className="statRow">
            <img src={crosshairs} />
            <div>{label("currently_studying")}:</div>
            <div></div>
          </div>
          <div className="statRow link">
            <div>{bookmark.slug ? <span>{bookmark.pagetitle}—{bookmark.heading}</span> : null}</div>
          </div></Link>
      </DropdownItem>
    </DropdownMenu>;
  }
  const userId = userObject.userId;


  return (
    <React.Fragment key={userId}>
      <div className={"noselect divider " + ((userObject.inCall) ? "inCall" : "")} key={userId}></div>
      <Dropdown isOpen={isDroppedDown || !!liveMessage}
        onMouseEnter={() => { if (!appController.states.studyGroup.isDrawerOpen) setDroppedDown(true) }}
        onMouseLeave={() => setDroppedDown(false)}
        toggle={() => { }}
      >
        <DropdownToggle tag="div" className="DropdownToggleContainer" onClick={handleClick} key={userId}>
          <StudyGroupUserCircle isBot={isBot} userObject={userObject} appController={appController} summary={summary} key={userId} />
        </DropdownToggle>
        {dropDownContent}
      </Dropdown>
    </React.Fragment>
  );
}


function LiveMessageDM({ liveMessage, userObject, appController }) {

  const handleClick = (e) => {
    e.stopPropagation();
    appController.functions.clearMessageFromQueue(liveMessage.messageId)
    appController.functions.openDrawer({ key: "message", val: userObject.userId });
  }

  const [soundEffect] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/message-inbound`)
    sound.preload = "auto";
    return sound;
  });
  useEffect(() => playSound(soundEffect), [])

  return <DropdownItem onClick={handleClick}>
    <div className="messageBox">
      <div className="DMLabel">{label("direct_message")}:</div>
      <div>{liveMessage.message}</div>
    </div>
  </DropdownItem>
}
function LiveMessageStudy({ liveMessage, clickHandler, bookmark, appController }) {


  if(typeof liveMessage === "string") liveMessage = {message: liveMessage};

  const [soundEffect] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/chat-inbound`)
    sound.preload = "auto";
    return sound;
  });
  useEffect(() => liveMessage.messageId && playSound(soundEffect), [])


  const handleClick = (e) => {
    if (liveMessage.customType !== "comment") return false;
    e.stopPropagation();
    appController.functions.clearMessageFromQueue(liveMessage.messageId)
    appController.functions.openDrawer(true);
  }

  if(bookmark.slug) return <DropdownItem >
    <Link to={(bookmark.slug) ? "/" + bookmark.slug : null} onClick={handleClick} >
      <div className="messageBox">
        <div>{liveMessage.message}</div>
      </div>
    </Link>
  </DropdownItem>
  else return <DropdownItem >
    <div className="messageBox">
      <div>{liveMessage.message}</div>
    </div>
  </DropdownItem>

}

export function UnreadDMCount({ userId, appController, count }) {
  if (count === 0) return null;
  if (count) return <span className="unreadDMCount">{count}</span>
  let data = appController.states.studyGroup.unreadDMs?.[userId];
  if (!data) return null;
  return <span className="unreadDMCount">{data.unread}</span>
}

function StudyGroupDrawer({ isOpen, appController }) {


  useEffect(() => {
    appController.functions?.clearMessageFromQueue();
    appController.sendbird?.loadUnreadDMs().then(unreadCounts => appController.functions.setUnreadDMs(unreadCounts));
  }, [isOpen])


  if (appController.states.studyGroup.activeGroup === -1) return null;
  if (!appController.states.studyGroup.activeGroup) return null;
  if (!appController.states.studyGroup.studyModeOn) return null;

  let contents = null;

  if (isOpen) contents = <StudyHall appController={appController} />;
  return (
    <div
      className={"StudyGroupDrawer" + (isOpen ? " open" : " closed")}
    // onMouseDown={(e) => console.log("DrawerEvent=", e)}
    >
      <h1
        onClick={() =>
          appController.functions.openDrawer(
            !appController.states.studyGroup.isDrawerOpen
          )
        }
      >
        {label("study_hall")}
        <span className="close">×</span>
      </h1>
      {contents}
    </div>
  );
}




