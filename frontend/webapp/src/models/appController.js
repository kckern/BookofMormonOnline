import { lang } from "moment";
import { isMessengerEnabled } from './featureFlags';
import { migratePreferences } from "./preferenceMigration";
import { clickyUser, determineLanguage, tokenImage } from "./Utils.js";
import crypto from "crypto-browserify";
import { history } from "./routeHistory.js";
import { setPopDocTitle } from "src/views/_Common/PopUp.js";

// Feature flag for using new Messenger system
// OFF = messaging disabled (no data migrated yet)
// ON = use new MessengerController
const USE_MESSENGER = isMessengerEnabled();

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
  // Study mode requires messenger to be enabled
  const messengerEnabled = isMessengerEnabled();
  let studyMode = messengerEnabled && localStorage.getItem("studyModeOn") !== "false";
  const lang = determineLanguage();
  //Set Initial States

  const osPrefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

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
			controversialCommentary:false,
      facsimiles: {
        on: true,
        filter: {
          type: "blacklist",
          versions: [],
        },
      },
    };
  preferences = migratePreferences(preferences, osPrefersDark);

  var states = {
    slug: "/home",
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
    imageActivationRequest: null,
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
      items: [],
      unreadCount: 0,
      loading: false,
    },
    editor: {
      isEditorOpen: false,
      value: "",
    },
  };

  //Create Initial Controller
  var initAppController = {
    states: states,
    activeLeafCursorController: null,
    popUpData: [],
    preLoad: false,
    // functions: functions,
    functions: appDispatch(),
    // functions: AppFunctions1(),
    messenger: null,
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
  // Override setSlug to accept an optional opts arg (e.g. { replace: true }).
  // Backward compatible: existing callers `setSlug(slug)` still work.
  dispatches.setSlug = (val, opts) => {
    global._appDispatch({ fn: "setSlug", val: val, replace: opts?.replace === true });
  };
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
    const useReplace = input.replace === true;
    input.val && (useReplace ? history?.replace(slug) : history?.push(slug));
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
  // Re-render notifier for the MessengerProvider bridge: the provider mutates
  // appController.messenger outside the reducer, so Main's Loader gate (which
  // reads the bridge during render) needs a dispatch to re-evaluate.
  messengerBridgeChanged: (appController) => appController,
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
    if (input.val?.ids?.length === 0) return appController;
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

  requestImageActivation: (appController, input) => {
    appController.states.imageActivationRequest = input.val;
    return appController;
  },

  //GLOBAL PRELOAD

  socialSignIn: (appController, input) => {
    let localToken = localStorage.getItem("token");
    appController.states.user = input.val.user;
    appController.states.user.social = input.val.social;
    appController.states.user.token = localToken;

    // Controller creation + getStudyGroups bootstrap now live in
    // MessengerProvider (src/contexts/MessengerContext.js), reacting to the
    // user.social state set above.
    return appController;
  },

  setPreLoadData: (appController, input) => {
    let localToken = localStorage.getItem("token");
    if (!input.val) return appController;
    if (input.val?.tokenSignIn?.[localToken]?.isSuccess) {
      appController.states.user = input.val.tokenSignIn[localToken].user;
      appController.states.user.token = localToken;
      let response = input.val.tokenSignIn[Object.keys(input.val.tokenSignIn).pop()];
      appController.states.user.social = response?.user?.social || response?.social;

      if (appController.states.user.social?.user_id) {
        // Controller creation + bootstrap moved to MessengerProvider.
        clickyUser({ userid: appController.states.user.user, username: appController.states.user.social?.nickname })
      }

      delete input.val.tokenSignIn;
    } else if (input.val?.tokenSignIn !== undefined) {
      // Only downgrade to guest when the full preload actually ran tokenSignIn
      // and it failed. The labels-only fast path carries no tokenSignIn and must
      // not touch user state (it races with the full path).
      appController.states.user = guestUser({ localToken });
    }
    if(!!input.val?.personList && !!input.val?.placeList && !!input.val?.matterList) appController.states.preloaded = true;
    let preload = input.val;
    // let fax = {};
    // for(let i in preload.fax) { fax[preload.fax[i].slug] = preload.fax[i]; preload.fax[i].weight = i; };
    // preload.fax = fax;
    if (typeof preload.fax === "object")
      preload.fax = Object.values(preload.fax);
    // Merge, don't replace: the labels-only fast path and the full network
    // preload race, and a replace lets whichever lands last wipe the other's
    // keys (e.g. labels clobbering personList/placeList, breaking person/place
    // tooltips). Merge so both contribute regardless of arrival order.
    appController.preLoad = { ...appController.preLoad, ...preload };
    // Also expose the merged preload globally (same pattern as global.dictionary
    // for labels). Components like the narration person/place tooltips capture
    // appController at mount and would otherwise read a stale preLoad that the
    // reducer's per-dispatch cloning leaves behind; global.preLoad is always current.
    global.preLoad = appController.preLoad;

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
    if (!group) return appController;
    let freshGroups = appController.states.studyGroup.groupList.map((old) =>
      old?.url === group?.url ? group : old
    );
    if (freshGroups.length > 0)
      appController.states.studyGroup.groupList = freshGroups;
    if (group.url === appController.states.studyGroup.activeGroup?.url)
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
      !appController.messenger.sb.currentUser?.metaData?.activeGroup ||
      !appController.states.studyGroup.activeGroup
    ) {
      let url =
        appController.states.studyGroup.activeGroup?.url ||
        appController.messenger.sb.currentUser?.metaData?.activeGroup ||
        localStorage.getItem("activeGroup");
      let groupToSet = list.filter((g) => g.url === url)[0];
      if (!groupToSet) groupToSet = list[0];
      // Apply the active-group selection in-place within THIS reducer pass.
      // The previous `appController.functions.setActiveStudyGroup(...)` re-
      // dispatched into Main's reducer; React re-invokes reducers during
      // render, so that nested dispatch fired a Main setState mid-render
      // ("Cannot update a component (Main) while rendering ..."). Calling the
      // sibling reducer directly mutates the same draft synchronously (no
      // nested dispatch) — its only React state update (setUnreadDMs) stays
      // async in a .then, so it lands after this pass.
      appFunctions.setActiveStudyGroup(appController, { val: groupToSet });
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
    var user = appController.messenger.sb.currentUser;
    if (!user) return appController;
    let oldGroup = appController.states.studyGroup.activeGroup;
    let newGroup = input.val;
    if (!newGroup) return appController;
    if (oldGroup && oldGroup.url === newGroup.url && oldGroup.members.length === newGroup.members.length) return appController;

    appController.states.studyGroup.activeGroup = newGroup;
    appController.states.studyGroup.action = {};
    localStorage.setItem("activeGroup", newGroup?.url);

    // Update User Meta
    appController.messenger?.updateUserState({
      channels: appController.states.studyGroup.groupList,
      activeGroup: appController.states.studyGroup.studyModeOn
        ? newGroup?.url
        : "",
    });

    appController.messenger.loadUnreadDMs().then((unreadCounts) => {
      appController.functions.setUnreadDMs(unreadCounts);
    });
    return appController;
  },
  setActiveGroupOperators: (appController, input) => {
    appController.states.studyGroup.activeGroupOperators = input.val;
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

    appController.messenger?.updateUserState({
      channels: appController.states.studyGroup.groupList,
      activeGroup: appController.states.studyGroup.studyModeOn ? appController.states.studyGroup.activeGroup.url : "",

    });

    return appController;
  },
  setActiveLeafCursorController: (appController, input) => {
    appController.activeLeafCursorController = input.val;
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
    if (message._sender?.userId === appController.messenger.sb.currentUser?.userId) actionNeeded = false;
    if (appController.states.studyGroup.isDrawerOpen) actionNeeded = false;
    if (!!appController.activeLeafCursorController?.states?.studyBuddies?.[message?._sender?.userId]) actionNeeded = false;
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
      updateTypingLocation: (username, val) => {
        appController.functions.setTypingLocations({ username, action: val });
      },
    };

    if (processors[key]) {
      appController.functions.updateListedStudyGroup({ group: channel });
      processors[key](username, val);
    }

    return appController;
  },
  openNotification: (appController, input) => {
    const open = input.val;
    appController.states.notification.isNotificationOpen = open;
    // Fetch the feed on open (no polling — refreshed on open + on socket push).
    if (open && appController.messenger?.loadNotifications) {
      appController.states.notification.loading = true;
      appController.messenger.loadNotifications().then((items) => {
        appController.functions.setNotifications(items);
      });
    }
    return appController;
  },
  setNotifications: (appController, input) => {
    const items = Array.isArray(input.val) ? input.val : [];
    appController.states.notification.items = items;
    appController.states.notification.unreadCount = items.filter((n) => !n.is_read).length;
    appController.states.notification.loading = false;
    return appController;
  },
  setNotificationUnreadCount: (appController, input) => {
    appController.states.notification.unreadCount = Number(input.val) || 0;
    return appController;
  },
  // Realtime in-place patch: prepend a pushed notification and bump the badge.
  addNotification: (appController, input) => {
    const notif = input.val;
    if (!notif || !notif.id) return appController;
    const items = appController.states.notification.items || [];
    if (items.some((n) => n.id === notif.id)) return appController; // dedupe
    appController.states.notification.items = [notif, ...items];
    appController.states.notification.unreadCount =
      (appController.states.notification.unreadCount || 0) + (notif.is_read ? 0 : 1);
    return appController;
  },
  // Mark a single notification read in place (badge -1).
  markNotificationRead: (appController, input) => {
    const id = input.val;
    const items = appController.states.notification.items || [];
    let changed = false;
    appController.states.notification.items = items.map((n) => {
      if (n.id === id && !n.is_read) { changed = true; return { ...n, is_read: true }; }
      return n;
    });
    if (changed) {
      appController.states.notification.unreadCount =
        Math.max(0, (appController.states.notification.unreadCount || 0) - 1);
      appController.messenger?.markNotificationRead?.(id);
    }
    return appController;
  },
  // Mark all read in place (badge 0).
  markAllNotificationsRead: (appController, input) => {
    const items = appController.states.notification.items || [];
    appController.states.notification.items = items.map((n) => ({ ...n, is_read: true }));
    appController.states.notification.unreadCount = 0;
    appController.messenger?.markAllNotificationsRead?.();
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
  processSignIn: (appController, input) => {
    let user = input.val.user;
    user.social = input.val.social || user.social;
    // Controller creation + bootstrap moved to MessengerProvider.

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
      studyModeOn: USE_MESSENGER,
      isDrawerOpen: false,
      isGroupListOpen: false,
      isMobileChat: false,
      activeGroup: null,
      action: {},
      groupList: [],
    };
    return appController;
  },

  updateUserProgress: (appController, input) => {
    // input.val can be undefined when userprogress comes back null/unkeyed for a
    // guest or unmatched token (callers read r.userprogress?.[token]); bail
    // rather than crash the reducer. Mirrors updateUserSummary's guard.
    if (!input.val) return appController;
    let inputData = input.val;
    if (!appController.states.user.progress) appController.states.user.progress = {};
    appController.states.user.progress.completed = inputData.completed;
    appController.states.user.progress.started = inputData.started;
    return appController;
  },
  updateUserSummary: (appController, input) => {
    if (!input.val) return appController;
    let inputData = input.val;
    if (!appController.states.user.progress) appController.states.user.progress = {};
    appController.states.user.progress.completed = inputData.completed;
    appController.states.user.progress.started = inputData.started;
    let preExistingSummary = null;
    try {
      preExistingSummary = JSON.parse(
        appController.messenger?.sb.currentUser.metaData.summary
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
      appController.messenger?.updateUserSummary({
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
