import React, { useState, useEffect, useRef } from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { CallCircle } from "./StudyGroupCall";
import { toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"

import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
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
momentDurationFormatSetup(moment);

toast.configure({
  limit: 4,
});

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

  const mySocialId  = appController.states.user.social.user_id;
  const determineColor = userObject => userObject.inCall ? "blue" : userObject.isInGroup ? "green" : userObject.isOnSite ? "yellow" : "grey";
  let group = appController.states.studyGroup.activeGroup;
  if (!group) return null;
  let call = appController.states.studyGroup.activeCall;
  let callers = call?._participantCollection?._remoteParticipants?.map(p => p.user?.userId) || [];
  let users =  group.members?.filter((m) => {
    const isSelf = m.userId === appController.states.user.social.user_id 
    const isBot = !!m.metaData?.isBot
    if(isSelf || isBot) return false;
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
  if (!users) return [];
  return users.sort((a, b) => {


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

  let users = getFreshUsers(appController);
  const [userColors, setUserColors] = useState(getColorMap(users));

  const toaster = (src, color, val) => {
    if (!appController.states.studyGroup.studyModeOn) return false;
    toast.clearWaitingQueue();
    toast.dismiss();
    toast.info(<div className={"toastBox " + color}>
      <img src={src}  onError={breakCache}/>
      <div>{val}</div>
    </div>, { position: toast.POSITION.BOTTOM_LEFT, autoClose: 6000 });
  }

  useEffect(() => {

    setUserColors(oldColors => {

      let newColors = getColorMap(users);
      const sounds = appController.states.preferences.sound;
      let diff = diffMap(oldColors, newColors);
      if (diff[appController.states.user.user]) return newColors;
      let diffCounts = Object.keys(diff).length;
      if (diffCounts !== 1) return newColors;

      let username = Object.keys(diff)[0];
      let mysocialId = appController.states.user.social.user_id;
      let user = appController.states.studyGroup.activeGroup?.memberMap[username] || {};
      let { oldVal: oldColor, newVal: newColor } = Object.values(diff)[0];
      const isMe = mysocialId ===  username;

      

      //debugger;

      if (!!appController.states.studyGroup.studyModeOn && !isMe) {

        let notificationHistory = JSON.parse(localStorage.getItem("notificationHistory")) || [];
        const time = moment().unix();

        if (newColor === "blue") {
          if (sounds) playSound(enteredCall)
          toaster(user.profileUrl, newColor, label("x_joined_a_call", [user.nickname]));
        }
        if (["blue"].includes(oldColor) && ["green"].includes(newColor)) {
          if (sounds) playSound(exitedCall);
        }

        if (newColor === "green") {
          if (notificationHistory.find(x => x.userId === user.userId && x.type === "online")) return newColors; // prevent notification flood
          if (sounds) playSound(cameOnline)
          toaster(user.profileUrl , newColor, label("x_came_online", [user.nickname]));  // prevent notification flood
          notificationHistory.push({ userId: user.userId, time, type: "online" });
          
        }

        if (["blue", "green"].includes(oldColor) && ["yellow", "grey"].includes(newColor)) {
          if (notificationHistory.find(x => x.userId === user.userId && x.type === "offline")) return newColors; // prevent notification flood
          if (sounds) playSound(wentOffline)
          toaster(user.profileUrl, newColor, label(newColor === "yellow" ? "x_switched_groups" : "x_went_offline", [user.nickname]));
          notificationHistory.push({ userId: user.userId, time , type: "offline"});
        }

        const deadline = moment().subtract(5, "minutes").unix();
        notificationHistory = notificationHistory.filter(x => x.time > deadline);
        localStorage.setItem("notificationHistory", JSON.stringify(notificationHistory));

      }
      return newColors;
    })

  }, [users]);

  if (users?.length === 1) { return null; }

  if (appController.states.studyGroup.activeGroup === -1) return null;
  if (!appController.states.studyGroup.activeGroup) return null;
  if (!appController.states.studyGroup.studyModeOn) return null;

  let liveMessageQueue = appController.states.studyGroup.liveMessageQueue || {};
  let activeLiveMessageId = Object.keys(liveMessageQueue).shift();
  let activeLiveMessageSender = liveMessageQueue[activeLiveMessageId]?._sender?.userId;

  return (
    <div
      className={
        "userStatus" +
        (appController.states.studyGroup.isDrawerOpen ? " hidden" : "")
      }
    >

      <div class="divider"></div>
      {users?.length >=1 ? <CallCircle appController={appController} /> : null}
      <audio id="call_audio" autoPlay={"true"} />
      {users?.slice(0,11).map((user) => (
        <>
          <StudyGroupUser
            key={user?.userId}
            color={userColors[user?.userId]}
            userObject={user}
            appController={appController}
            liveMessage={user?.userId === activeLiveMessageSender ? liveMessageQueue[activeLiveMessageId] : null}
          />
        </>
      ))}
      <div class="divider"></div>

    </div>
  );
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

export function StudyGroupUserCircle({ userObject, appController }) {

  let classes = getClassesFromUserObj(userObject, appController);


  let typingIndicator = (classes.includes("isTyping")) ? <div className={"typing"}><img src={typing} /></div> : null;
  let summary = {}; try { summary = JSON.parse(userObject?.metaData?.summary) } catch (e) { }
  let trophyIcons = (summary.finished) ? <div className="trophyIcons"><img src={trophy} /></div> : null;

  //Determin Green Yellow Grey Blue


  let completedPerc = parseFloat(summary.completed) || 0;
  let badgeVal = (completedPerc) + "%"
  if (userObject.inCall) badgeVal = "📞  " + badgeVal;


  let num = (md5(userObject.userId) + "4").match(/[3-9]/)[0];
  let inCallElements = (userObject.inCall) ? <>
    <div className={"userCircleOutline"} style={{ animation: `rotate ${num}s linear infinite` }}></div>
    <div className={"phoneCall"}></div></> : null;

  return <><div
    className={classes.join(" ")}
    style={{ backgroundImage: `url(${userObject.profileUrl})` }}
    onClick={() => appController.functions.openDrawer({ key: "message", val: userObject.userId })}
  >
    {inCallElements}
    {typingIndicator}
    <div className={"progressBadge"}>{badgeVal}</div>
    {trophyIcons}
  </div>
    <UnreadDMCount appController={appController} userId={userObject.userId} />
  </>

}


export function StudyGroupUser({ userObject, appController, liveMessage }) {

  const [switchSound] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/switch`)
    sound.preload = "auto";
    return sound;
  });

  const [isDroppedDown, setDroppedDown] = useState(false);
  const [speechBubbleOpen, setSpeechBubbleOpen] = useState(true);

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

  if (userObject?.userId === appController.states.user.user) return null;

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
        <div className="statRow">
          <img src={trophy} />
          <div>{label("completed_on_x", [moment.unix(t).format(label("history_date_format_full"))])}</div>
          <div></div>
        </div>)}
    </DropdownItem></> : null;



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




  if (liveMessage && !appController.states.studyGroup.isDrawerOpen) {

    let messageData = {}; try { messageData = JSON.parse(liveMessage.data) } catch (e) { };
    messageData.messageId = liveMessage.messageId;
    messageData.customType = liveMessage.customType;
    if (liveMessage.parentMessageId) messageData.parentMessageId = liveMessage.parentMessageId;

    if (messageData?.links?.text) bookmark.slug = messageData.customType + "/" + messageData?.links?.text;



    dropDownContent = <DropdownMenu className="liveMessage">
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


  return (
    <>
      <div className={"noselect divider " + ((userObject.inCall) ? "inCall" : "")}></div>
      <Dropdown isOpen={isDroppedDown || !!liveMessage}
        onMouseEnter={() => { if (!appController.states.studyGroup.isDrawerOpen) setDroppedDown(true) }}
        onMouseLeave={() => setDroppedDown(false)}
        toggle={() => { }}
      >
        <DropdownToggle tag="div" className="DropdownToggleContainer" onClick={handleClick} >
          <StudyGroupUserCircle userObject={userObject} appController={appController} summary={summary} />
        </DropdownToggle>
        {dropDownContent}
      </Dropdown>
    </>
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

  const [soundEffect] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/chat-inbound`)
    sound.preload = "auto";
    return sound;
  });
  useEffect(() => playSound(soundEffect), [])


  const handleClick = (e) => {
    if (liveMessage.customType !== "comment") return false;
    e.stopPropagation();
    appController.functions.clearMessageFromQueue(liveMessage.messageId)
    appController.functions.openDrawer(true);
  }

  return <DropdownItem >
    <Link to={(bookmark.slug) ? "/" + bookmark.slug : null} onClick={handleClick} >
      <div className="messageBox">
        <div>{liveMessage.message}</div>
      </div>
    </Link>
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




