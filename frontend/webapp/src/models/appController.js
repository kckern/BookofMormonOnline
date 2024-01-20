import { lang } from "moment";
import SendbirdController, { SendbirdAppId } from "./SendbirdController.js";
import { clickyUser, determineLanguage, tokenImage } from "./Utils.js";
import crypto from "crypto-browserify";
import { history } from "./routeHistory.js";
import { setPopDocTitle } from "src/views/_Common/PopUp.js";

const checkQuota =  () => {
  // Check if 'timestamp' exists in localStorage
  if (!localStorage.getItem('timestamp')) {
    // Assign 'timestamp' to current time, converted to seconds
    localStorage.setItem('timestamp', Math.floor(Date.now() / 1000).toString());
  }

  // Check if 'callCount' exists in localStorage
  if (!localStorage.getItem('callCount')) {
    // Initialize callCount to '0'
    localStorage.setItem('callCount', '0');
  }

  // Calculate time elapsed since 'timestamp'
  let timeElapsed = Math.floor(Date.now() / 1000) - parseInt(localStorage.getItem('timestamp'));

  // Now check if more than 10 seconds have passed since 'timestamp'
  if (timeElapsed >= 10) {
    // Reset 'timestamp' and 'callCount'
    localStorage.setItem('timestamp', Math.floor(Date.now() / 1000).toString());
    localStorage.setItem('callCount', '0');
  }

  // Check for quota exceeding 80%
  if ((parseInt(localStorage.getItem('callCount')) / 100) >= 0.8) {
    // Return false due to exceeded quota
    console.log('Supress call due to quota');
    return false;
  } else {
    // Increase 'callCount' by one
    localStorage.setItem('callCount', (parseInt(localStorage.getItem('callCount')) + 1).toString());

    // Return true (quota has not been exceeded)
    return true;
  }
}

export const appInit = () => {
  let studyMode = localStorage.getItem("studyModeOn") !== "false";
  const lang = determineLanguage();
  //Set Initial States

  let preferences = localStorage.getItem("preferences");
  if (preferences) preferences = JSON.parse(preferences);
  else
    preferences = {
      lang: lang,
      audio: false,
      canned_responses: true,
      autoplay: false,
      sound: true,
      art: true,
      commentary: {
        on: true,
        filter: {
          type: "blacklist",
          sources: [41,141,142,143,144,145]
        },
      },
      facsimiles: {
        on: true,
        filter: {
          type: "blacklist",
          versions: [],
        },
      },
    };

  var states = {
    slug: "/community",
    user: {
      user: null,
      token: null,
      progress: {
        completed: 0.1,
        started: 0,
      },
      social: {
        sbUserID: null,
        sbNickname: null,
        sbProfile: null,
        sbMeta: {},
      },
    },
    studyGroup: {
      studyModeOn: studyMode,
      isDrawerOpen: false,
      isGroupListOpen: false,
      activeGroup: null,
      activeGroupOperators: [],
      activeCall: null,
      activeCallers: [],
      mutedCallers: [],
      action: {},
      groupList: [],
      liveMessageQueue: {},
      unreadDMs: {},
      typers: {},
    },

    messages: {
      mostRecent: null,
    },

    parentMessage: {
      message: false,
    },

    preferences: preferences,
    toolTip: {},
    popUp: {
      open: false,
      loading: true,
      type: null,
      activeId: null,
      ids: [],
      top: 0,
      gotFirstComment: false,
    },
    notification: {
      isNotificationOpen: false,
    },
    editor: {
      isEditorOpen: false,
      value: "",
    },
  };

  //Create Initial Controller
  var initAppController = {
    states: states,
    activePageController: null,
    popUpData: [],
    preLoad: false,
    // functions: functions,
    functions: appDispatch(),
    // functions: AppFunctions1(),
    sendbird: null,
  };

  //Return the Row Controller
  return initAppController;
};

// function processUpdateMessage(appController, { message, channel, index }) {
//     if (message.channelUrl === appController.states.studyGroup.activeGroup.url) {

//         appController.states.studyGroup.studyMessages[index] = message;
//     }
//     return appController;
// }

export const appDispatch = () => {
  let dispatches = {};
  for (let fn in appFunctions) {
    dispatches[fn] = (val) => {
      global._appDispatch({ fn: fn, val: val });
    };
  }
  return dispatches;
};

export function appControllerReducer(appController, input) {
  if (typeof appFunctions[input.fn] === "function") {
    appController = appFunctions[input.fn](appController, input);
    return { ...appController };
  }
  return { ...appController };
}

export const appFunctions = {
  setSlug: (appController, input) => {
    let slug = input.val;
    if (!slug) return appController;
    if (!/^\//.test(slug)) slug = `/${slug}`;
    if (appController.states.slug === slug) return appController;
    appController.states.slug = slug;
    input.val && history?.push(slug);
    return appController;
  },
  setUser: (appController, input) => {
    appController.states.panelImageIds = input.val;
    return appController;
  },
  setStudyGroup: (appController, input) => {
    appController.states.popUp = input.val;
    return appController;
  },
  updateSettings: (appController, input) => {
    appController.pageData = input.val;
    return appController;
  },
  updatePrefs: (appController, input) => {
    appController.states.preferences = input.val;
    localStorage.setItem(
      "preferences",
      JSON.stringify(appController.states.preferences)
    );
    return appController;
  },

  //POPUP FUNCTIONS
  setPopUp: (appController, input) => {
    if (input.val.ids.length === 0) return appController;
    if (!appController.states.popUp.open)
      appController.states.popUp.underSlug = input.val.underSlug || appController.states.slug?.replace(
        /^\//,
        ""
      ) || "";
    appController.states.popUp.open = true;
    appController.states.popUp.type = input.val?.type;
    appController.states.popUp.ids = input.val?.ids;
    appController.states.popUp.gotFirstComment = false;
    //TODO: DETERMINE FIRST LOAD
    appController.states.popUp.activeId = input.val?.ids?.[0];
    appController.states.popUp.top = window.scrollY + window.innerHeight / (100 / (input.val.vhtop || 20));
    appController.popUpData = input.val?.popUpData;
    appController.states.popUp.loading =
      !appController.popUpData ||
      !appController.popUpData[appController.states.popUp.activeId];
    
    if (appController.states.popUp.activeId)
      appController.functions.setSlug(
        appController.states.popUp.type +
        "/" +
        appController.states.popUp.activeId
      );
    setPopDocTitle(appController.popUpData?.[appController.states.popUp.activeId],appController.states.popUp.type);
    return appController;
  },
  setActivePopUpId: (appController, input) => {
    appController.states.popUp.activeId = input.val.id;
    appController.states.popUp.gotFirstComment = false;
    appController.functions.setSlug(
      appController.states.popUp.type + "/" + input.val.id
    );
    setPopDocTitle(appController.popUpData?.[input.val.id],appController.states.popUp.type);
    return appController;
  },
  closePopUp: (appController, input) => {
    appController.states.popUp.open = false;
    appController.states.popUp.loading = false;
    appController.states.popUp.type = null;
    appController.states.popUp.ids = [];
    appController.states.popUp.activeId = 1;
    appController.functions.setSlug(appController.states.popUp.underSlug);

    //id = "theater-audio-player"
    const theaterPlayer = document.getElementById("theater-audio-player");
    if(theaterPlayer) {
      if(theaterPlayer.paused && theaterPlayer.currentTime) theaterPlayer.play();
    }

    return appController;
  },

  clearPopUp: (appController) => {
    appController.popUpData = [];
    appController.states.popUp.activeId = null;
    return appController;
  },

  //GLOBAL PRELOAD

  socialSignIn: (appController, input) => {
    let localToken = localStorage.getItem("token");
    appController.states.user = input.val.user;
    appController.states.user.social = input.val.social;
    appController.states.user.token = localToken;

    if (appController.states.user.social?.user_id) {
      appController.sendbird = new SendbirdController(
        SendbirdAppId,
        appController.states.user.social?.user_id,
        appController.states.user.social.access_token,
        appController
      );

      appController.sendbird?.getStudyGroups()
        .then((list) => appController.functions.setStudyGroups(list));
    }
    return appController;
  },

  setPreLoadData: (appController, input) => {
    let localToken = localStorage.getItem("token");
    if (!input.val) return appController;
    if (input.val?.tokenSignIn?.[localToken].isSuccess) {
      appController.states.user = input.val.tokenSignIn[localToken].user;
      appController.states.user.token = localToken;
      let response = input.val.tokenSignIn[Object.keys(input.val.tokenSignIn).pop()];
      appController.states.user.social = response?.user?.social || response?.social;

      if (appController.states.user.social?.user_id) {
        appController.sendbird = new SendbirdController(
          SendbirdAppId,
          appController.states.user.social?.user_id,
          appController.states.user.social.access_token,
          appController
        );

        clickyUser({ userid: appController.states.user.user, username: appController.states.user.social?.nickname })

        appController.sendbird?.getStudyGroups()
          .then((list) => appController.functions.setStudyGroups(list));
      }

      delete input.val.tokenSignIn;
    } else {
      appController.states.user = guestUser({ localToken });
    }

    let preload = input.val;
    // let fax = {};
    // for(let i in preload.fax) { fax[preload.fax[i].slug] = preload.fax[i]; preload.fax[i].weight = i; };
    // preload.fax = fax;
    if (typeof preload.fax === "object")
      preload.fax = Object.values(preload.fax);
    appController.preLoad = preload;

    if (!localStorage.getItem("preferences")) {
      let pubs = input.val.publications || [];
      if (!Array.isArray(pubs)) pubs = [];
      let rids = pubs?.filter(p => p?.source_rating === "R").map(i => parseInt(i.source_id)) || [];
      rids = [...new Set([...rids,41,141,142,143,144,145])];
      let prefs = appController.states.preferences;
      prefs.commentary.filter.sources = rids;
      appController.functions.updatePrefs(prefs);
    }

    return appController;
  },

  updateListedStudyGroup: (appController, input) => {
    let group = input.val.group;
    let room = input.val.room;
    if (!group) return appController;
    if (room) {
      group.room = room;
      if (group.url === appController.states.studyGroup.activeGroup.url) {
        appController.states.studyGroup.activeCall = room;
      }
    }
    let freshGroups = appController.states.studyGroup.groupList.map((old) =>
      old?.url === group?.url ? group : old
    );
    if (freshGroups.length > 0)
      appController.states.studyGroup.groupList = freshGroups;
    if (group.url === appController.states.studyGroup.activeGroup.url)
      appController.states.studyGroup.activeGroup = group;
    return appController;
  },

  setStudyGroups: (appController, input) => {
    let list = input.val || [];

    if (list.length < 1) {
      appController.states.studyGroup.activeGroup = -1;
      appController.states.studyGroup.groupList = [];
      return appController;
    }

    if (
      !appController.sendbird.sb.currentUser?.metaData?.activeGroup ||
      !appController.states.studyGroup.activeGroup
    ) {
      let url =
        appController.states.studyGroup.activeGroup?.url ||
        appController.sendbird.sb.currentUser?.metaData?.activeGroup ||
        localStorage.getItem("activeGroup");
      let groupToSet = list.filter((g) => g.url === url)[0];
      if (!groupToSet) groupToSet = list[0];
      appController.functions.setActiveStudyGroup(groupToSet);
    }

    if (list.length > 0) appController.states.studyGroup.groupList = list;
    return appController;
  },

  setUnreadDMs: (appController, input) => {
    let channels = input.val;
    appController.states.studyGroup.unreadDMs = channels;
    return appController;
  },
  setUserSocial: (appController, input) => {
    appController.states.user.social = input.val;
    if (!appController.states.user.social.profile_url)
      appController.states.user.social.profile_url = tokenImage()
    return appController;
  },
  setUserSocialProfileImage: (appController, input) => {
    appController.states.user.social.profile_url = input.val;
    return appController;
  },
  setActiveStudyGroup: (appController, input) => {
    var user = appController.sendbird.sb.currentUser;
    if (!user) return appController;
    let oldGroup = appController.states.studyGroup.activeGroup;
    let newGroup = input.val;
    if (!newGroup) return appController;
    if (oldGroup && oldGroup.url === newGroup.url && oldGroup.members.length === newGroup.members.length) return appController;

    appController.states.studyGroup.activeGroup = newGroup;
    appController.states.studyGroup.action = {};
    localStorage.setItem("activeGroup", newGroup?.url);

    //CALL
    appController.sendbird?.fetchRoomFromGroup(
      appController.states.studyGroup.activeGroup,
      "setActiveStudyGroup"
    )
      .then((room) => appController.functions.setActiveCall(room));
    if (appController.states.studyGroup.activeCall?.localParticipant)
      appController.states.studyGroup.activeCall.exit();
    // Update User Meta
    appController.sendbird?.updateUserState({
      channels: appController.states.studyGroup.groupList,
      activeCall: "",
      activeGroup: appController.states.studyGroup.studyModeOn
        ? newGroup?.url
        : "",
    });

    appController.sendbird.loadUnreadDMs().then((unreadCounts) => {
      appController.functions.setUnreadDMs(unreadCounts);
    });
    return appController;
  },
  setActiveGroupOperators: (appController, input) => {
    appController.states.studyGroup.activeGroupOperators = input.val;
    return appController;
  },
  setActiveCall: (appController, input) => {
    let call = input.val;
    appController.states.studyGroup.activeCall = call;
    return appController;
  },
  openDrawer: (appController, input) => {
    appController.states.studyGroup.isDrawerOpen = input.val;
    return appController;
  },
  openGroupList: (appController, input) => {
    appController.states.studyGroup.isGroupListOpen = input.val;
    return appController;
  },
  setMobileChat: (appController, input) => {
    appController.states.studyGroup.isMobileChat = input.val;
    return appController;
  },
  setStudyMode: (appController, input) => {
    appController.states.studyGroup.studyModeOn = input.val;
    localStorage.setItem(
      "studyModeOn",
      appController.states.studyGroup.studyModeOn
    );
		
    if(appController.states.studyGroup.groupList.length === 0) return appController;
		
    appController.functions.setActiveStudyGroup(appController.states.studyGroup.activeGroup)

    appController.sendbird?.updateUserState({
      channels: appController.states.studyGroup.groupList,
      activeCall: "",
      activeGroup: appController.states.studyGroup.studyModeOn ? appController.states.studyGroup.activeGroup.url : ""
    });

    return appController;
  },
  setActivePageController: (appController, input) => {
    appController.activePageController = input.val;
    return appController;
  },
  markPopUpComments: (appController, input) => {
    if (!appController.states.popUp.open) return appController;
    appController.states.popUp.gotFirstComment = input.val;
    return appController;
  },
  setTypers: (appController, input) => {
    appController.states.studyGroup.typers[input.val.channelUrl] =
      input.val.ids;
    return appController;
  },
  editProfile: (appController, input) => {
    appController.states.user.name = input.val.name;
    appController.states.user.social.nickname = input.val.name;
    appController.states.user.email = input.val.email;
    appController.states.user.zip = input.val.zip;
    return appController;
  },
  setTypingLocations: (appController, input) => {
    let { username, action } = input.val;
    let { fn, locationHash } = action;
    if (!appController.states.studyGroup.activeGroup.typingLocations)
      appController.states.studyGroup.activeGroup.typingLocations = {};

    let userLocation =
      appController.states.studyGroup.activeGroup.typingLocations[username];
    if (fn === "add") {
      appController.states.studyGroup.activeGroup.typingLocations[username] =
        locationHash;
    } else if (fn === "remove" && userLocation === locationHash) {
      appController.states.studyGroup.activeGroup.typingLocations[
        username
      ] = false;
    }
    return appController;
  },

  firedMessage: (appController, input) => {
    let message = input.val?.message;
    let channel = input.val?.channel;

    let actionNeeded = false;
    //MAIN CONDITIONS
    if (channel.customType === "DM") actionNeeded = true;
    if (message.channelUrl === appController.states.studyGroup.activeGroup?.url) actionNeeded = true;

    //OVERRIDES
    if (message._sender?.userId === appController.sendbird.sb.currentUser?.userId) actionNeeded = false;
    if (appController.states.studyGroup.isDrawerOpen) actionNeeded = false;
    if (!!appController.activePageController?.states?.studyBuddies?.[message?._sender?.userId]) actionNeeded = false;
    if (!actionNeeded) return appController;

    message.channel = channel;
    appController.states.studyGroup.liveMessageQueue[message.messageId] =
      message;
    setTimeout(
      () => appController.functions.clearMessageFromQueue(message.messageId),
      8000
    );

    return appController;
  },

  clearMessageFromQueue: (appController, input) => {
    let id = input.val;
    if (!id) appController.states.studyGroup.liveMessageQueue = {};
    else delete appController.states.studyGroup.liveMessageQueue[id];
    return appController;
  },


  processStudyGroupEvent: (appController, input) => {

    //check quota
    if(!checkQuota()) return appController;


    let action = {};
    try {
      action = JSON.parse(input.val.action);
    } catch (err) {
      return false;
    }
    let { username, key, val } = action;
    if (username === appController.states.user.user) return appController;
    let channel = input.val.channel;

    let processors = {
      updateUserSummary: (username, val) => { },
      updateUserState: (username, val) => { },
      goOffline: (username, val) => { },
      enterStudyGroup: (username, val) => { },
      exitStudyGroup: (username, val) => { },
      enterCall: (username, val) => { },
      exitCall: (username, val) => { },
      updateTypingLocation: (username, val) => {
        appController.functions.setTypingLocations({ username, action: val });
      },
    };

    if (processors[key]) {
      if (["enterCall", "exitCall", "updateUserState"].includes(key))
        appController.sendbird?.fetchRoomFromGroup(channel).then((room) =>
          appController.functions.updateListedStudyGroup({
            group: channel,
            room,
          })
        );
      else appController.functions.updateListedStudyGroup({ group: channel });
      processors[key](username, val);
    }

    return appController;
  },
  openNotification: (appController, input) => {
    appController.states.notification.isNotificationOpen = input.val;
    return appController;
  },
  setParentMessage: (appController, input) => {
    if (!appController.states) return appController;
    appController.states.parentMessage.message = input.val;
    return appController;
  },
  openEditor: (appController, input) => {
    appController.states.editor.isEditorOpen = input.val.isOpen;
    appController.states.editor.value = input.val.value;
    return appController;
  },
  startCall: (appController, input) => {
    let group = input.val;
    let room = group.room;
    appController.functions.setActiveStudyGroup(group);
    appController.sendbird?.fetchRoomFromGroup(group, "startCall")
      .then((room) => {
        room.autostart = true;
        appController.functions.setActiveCall(room);
      });
  },
  processSignIn: (appController, input) => {
    let user = input.val.user;
    user.social = input.val.social || user.social;
    if (user.social?.user_id)
      appController.sendbird = new SendbirdController(
        SendbirdAppId,
        user.social?.user_id,
        user.social?.access_token,
        appController
      );

    appController.sendbird?.getStudyGroups()
      .then((list) => appController.functions.setStudyGroups(list));

    appController.states.user.user = user.user.user;
    appController.states.user.progress = user.progress || {};
    appController.states.user.social = user.social;
    clickyUser({ userid: user.user.user, username: user.social?.nickname });


    return appController;
  },
  processSignOut: (appController, input) => {
    appController.states.user.user = null;
    appController.states.user.social = null;
    appController.states.user.email = null;
    localStorage.setItem(
      "token",
      crypto
        .createHash("md5")
        .update(crypto.randomBytes(20).toString("hex"))
        .digest("hex")
    );
    appController.states.user.progress = appController.states.user.progress || {};
    appController.states.user.token = localStorage.getItem("token");
    appController.states.user.progress.completed = 0;
    appController.states.user.progress.started = 0;
    appController.states.studyGroup = {
      studyModeOn: true,
      isDrawerOpen: false,
      isGroupListOpen: false,
      isMobileChat: false,
      activeGroup: null,
      activeCall: null,
      action: {},
      groupList: [],
    };
    appController.sendbird.sb.disconnect();
    return appController;
  },

  updateUserProgress: (appController, input) => {
    let inputData = input.val;
    appController.states.user.progress.completed = inputData.completed;
    appController.states.user.progress.started = inputData.started;
    return appController;
  },
  updateUserSummary: (appController, input) => {
    if (!input.val) return appController;
    let inputData = input.val;
    appController.states.user.progress.completed = inputData.completed;
    appController.states.user.progress.started = inputData.started;
    let preExistingSummary = null;
    try {
      preExistingSummary = JSON.parse(
        appController.sendbird?.sb.currentUser.metaData.summary
      );
    } catch (e) { }
    let summaryData = inputData.summary || preExistingSummary || {};
    let keys = ["completed", "started", "slug", "pagetitle", "heading"];
    for (let i in keys) {
      let key = keys[i];
      if (inputData[key]) summaryData[key] = inputData[key];
    }
    summaryData.latest = Math.round(Date.now() / 1000);
    if (Object.keys(summaryData).length > 0)
      appController.sendbird?.updateUserSummary({
        channels: appController.states.studyGroup.groupList,
        summaryData: summaryData,
      });

    return appController;
  },
};



function guestUser({ localToken }) {
  return {
    user: null,
    token: localToken,
    progress: {
      completed: 0,
      started: 0,
    },
    social: null,
  };
}
