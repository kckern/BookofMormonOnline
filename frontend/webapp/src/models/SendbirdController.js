import SendbirdChat from "@sendbird/chat";
import {
  OpenChannelModule,
  OpenChannelHandler,
} from "@sendbird/chat/openChannel";
import {
  GroupChannelModule,
  GroupChannelHandler,
} from "@sendbird/chat/groupChannel";
import SendBirdCall from "sendbird-calls";
import { error } from "src/models/alertMessageService";
import { determineLanguage, refreshChannel, tokenImage } from "./Utils";
import crypto from "crypto-browserify";

export const md5 = (string) => {
  const isMD5 = string.match(/^[a-f0-9]{32}$/i);
  if (isMD5) return string;
  return crypto
    .createHash("md5")
    .update(string)
    .digest("hex");
};

const prodUrls = []; //["bookofmormon.online"];

export const SendbirdAppId = "386311F5-8923-4F4D-8BE1-C3E95C2AD963";
export const SendBirdChatParams = {
  appId: SendbirdAppId,
  modules: [new OpenChannelModule(), new GroupChannelModule()],
};

export const uuid4 = () => {
  let d = new Date().getTime();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export default class SendbirdController {
  constructor(appId, userId, token, appController) {
    userId = md5(userId);

    this.groupCallMap = {};
    this.sb = new SendbirdChat.init(SendBirdChatParams);
    this.userId = userId;
    this.token = token;
    SendBirdCall.init(appId);




    this.connect(userId, token);

    //console.log("SendbirdController", { appId, userId, token, appController });
    const groupChannelHandler = new GroupChannelHandler();
    const openChannelHandler = new OpenChannelHandler();
    const appHandlers = AppHandlers(appController);

    //--GROUP CHANNEL EVENTS--//
    groupChannelHandler.onMessageReceived = appHandlers.onMessageReceived;
    groupChannelHandler.onMessageUpdated = appHandlers.onMessageUpdated;
    groupChannelHandler.onMessageDeleted = appHandlers.onMessageDeleted;
    groupChannelHandler.onTypingStatusUpdated =
      appHandlers.onTypingStatusUpdated;
    groupChannelHandler.onReactionUpdated = appHandlers.onReactionUpdated;
    groupChannelHandler.onUserJoined = appHandlers.onUserJoined;
    groupChannelHandler.onUserLeft = appHandlers.onUserLeft;
    groupChannelHandler.onThreadInfoUpdated = appHandlers.onThreadInfoUpdated;

    let key = uuid4();
    this.sb.groupChannel.addGroupChannelHandler(key, groupChannelHandler);

    //--OPEN CHANNEL EVENTS--//
    openChannelHandler.onMessageReceived = appHandlers.onMessageReceived;
    openChannelHandler.onMessageUpdated = appHandlers.onMessageUpdated;
    openChannelHandler.onMessageDeleted = appHandlers.onMessageDeleted;
    openChannelHandler.onReactionUpdated = appHandlers.onReactionUpdated;
    openChannelHandler.onReactionUpdated = appHandlers.onReactionUpdated;
    openChannelHandler.onUserEntered = appHandlers.onUserEntered;
    openChannelHandler.onMetaDataUpdated = appHandlers.onMetaDataUpdated;
    openChannelHandler.onChannelChanged = appHandlers.onChannelChanged;
    openChannelHandler.onMetaCounterUpdated = appHandlers.onMetaCounterUpdated;

    key = uuid4();
    this.sb.openChannel.addOpenChannelHandler(key, openChannelHandler);
  }


  createNewGroup = async (group, userId) => {
    const params = {};
    params.name = group.name;
    params.channelUrl = group.url;
    if (group.groupImage.file) params.coverImage = group.groupImage.file;
    else if (group.groupImage.img) params.coverUrl = group.groupImage.img;
    params.operatorUserIds = [userId];
    params.data = JSON.stringify({ description: group.description });
    params.customType = group.type;
    params.isEphemeral = false;

    if (group.type !== "open") {
      params.isDistinct = false;
      params.isSuper = false;
    }

    console.log({ group, params });
    try {
      const groupChannel = await this.sb.groupChannel.createChannel(params);
      let lang = determineLanguage() || "en";
      return await this.createNewRoom().then((room) => {
        return groupChannel
          .updateMetaData({ roomId: room.id, lang: lang }, true)
          .then(() => {
            return { groupChannel, room };
          });
      });
    } catch (error) {
      console.log("Error", error);
      return error;
    }
  };

  getCurrentUser = () => {
    return this.sb.currentUser;
  };

  createNewRoom = async () => {
    return //todo: fix this
    const roomParams = {
      roomType: SendBirdCall.RoomType.LARGE_ROOM_FOR_AUDIO_ONLY,
    };
    return await SendBirdCall.createRoom(roomParams)
      .then((room) => room)
      .catch((e) => {
        console.log("createNewRoom.ERROR", e);
        return null;
      });
  };

  getStudyGroups = async () => {
    await this.sb.connect(this.userId, this.token);
    var listQuery = await this.sb.groupChannel.createMyGroupChannelListQuery({
      includeEmpty: true,
      memberStateFilter: "all",
      customTypesFilter: ["open", "public", "private", "solo"],
      order: "channel_name_alphabetical",
      limit: 30,
    });
    if (listQuery.hasNext) {
      return listQuery.next((groupChannels, error) => {
        if (error) return error;
        return groupChannels.map((ch) => {
          // COMMENT BY ME
          // ch.call = this.fetchRoomFromGroup(ch, "getStudyGroups");
          return ch;
        });
      });
    }
  };

  fetchRoom = async (roomId) => {
    return SendBirdCall.fetchRoomById(roomId)
      .then((room) => room)
      .catch((e) => null);
  };

  fetchRoomFromGroup = async (group, src) => {
    if (!group) return null;

    // Create a global cache if not already present
    if (!window.roomCache) window.roomCache = {};
    if (window.roomCache[group.url]) {
      return window.roomCache[group.url];
    }

    let metaData =
      typeof group.getCachedMetadata === "function"
        ? group.getCachedMetadata()
        : null;
    if (metaData?.roomId) {
      return this.fetchRoom(metaData.roomId).then(async (room) => {
        if (!room) return await this.resetRoom(group);
        this.groupCallMap[group.url] = room;
        window.roomCache[group.url] = room;
        return room;
      });
    }
    if (!group.getMetaData) return null;
    return group.getMetaData(["roomId"]).then((res) => {
      if (!res.roomId) return this.resetRoom(group);
      return this.fetchRoom(res.roomId).then(async (room) => {
        if (!room) return await this.resetRoom(group);
        this.groupCallMap[group.url] = room;
        window.roomCache[group.url] = room;
        return room;
      });
    });
  };

  fetchGroupOperators = async (groupChannel) => {
    if (!groupChannel) return [];
    var listQuery = groupChannel.createOperatorListQuery();
    var operators = await listQuery.next();
    let ids = operators.map((o) => o?.userId);
    return ids;
  };

  resetRoom = async (groupChannel) => {
    let room = await this.createNewRoom();
    if (room) groupChannel.updateMetaData({ roomId: room.roomId }, true);
    return room;
  };

  loadGroupMessages = async (group) => {
    const params = {};
    params.limit = 30;
    params.reverse = true;
    params.includeMetaArray = true; // Retrieve a list of messages along with their metaarrays.
    params.includeReactions = true; // Retrieve a list of messages along with their reactions.
    params.includeThreadInfo = true; // Retrieve a list of messages along with their reactions.
    params.includeReplies = true; // Retrieve a list of messages along with their reactions.
    const listQuery = group.createPreviousMessageListQuery(params);
    try {
      // Retrieving previous messages.
      return await listQuery.load();
    } catch (error) {
      console.log({ error });
      return false;
    }
  };

  loadPreviousMessages = async ({ group, id, prevResultSize }) => {
    if (!id) return new Promise((resolve) => resolve([]));
    const params = {};
    params.isInclusive = true;
    params.prevResultSize = prevResultSize || 30;
    params.reverse = true;
    params.includeParentMessageInfo = true;
    params.includeReplies = true;
    params.includeReactions = true;
    params.includeThreadInfo = true;
    try {
      return await group.getMessagesByMessageId(id, params);
    } catch (e) {
      console.log({ e });
      return [];
    }
  };

  loadThreadedMessages = async (parentMessage) => {
    const params = {};
    params.nextResultSize = 100;
    params.prevResultSize = 100;
    params.isInclusive = true;
    params.reverse = false;
    params.includeParentMessageInfo = true;
    params.includeReactions = true;
    try {
      // Retrieving previous messages.
      return await parentMessage.getThreadedMessagesByTimestamp(
        parentMessage.createdAt,
        params,
      );
    } catch (error) {
      console.log({ error });
      return false;
    }
  };

  loadUnreadDMs = async () => {
    await this.sb.connect(this.userId, this.token);
    const params = {};
    params.includeEmpty = true;
    params.memberStateFilter = "all";
    params.order = "latest_last_message";
    params.limit = 100;
    params.unreadChannelFilter = "unread_message";
    params.customTypesFilter = ["DM"];

    var listQuery = await this.sb.groupChannel.createMyGroupChannelListQuery(
      params,
    );

    if (listQuery.hasNext) {
      return listQuery.next((groupChannels, error) => {
        let myUserId = this.sb.currentUser?.userId;
        if (!myUserId) return {};
        if (error) {
          console.log("loadUnreadDMs", { error });
        }
        let items = groupChannels.map((c) => {
          return {
            url: c.url,
            user: c.members.filter((m) => m?.userId !== myUserId).shift()
              ?.userId,
            unread: c.unreadMessageCount,
          };
        });
        let unreadMap = {};
        for (let i in items) {
          if (!unreadMap[items[i].user])
            unreadMap[items[i].user] = {
              unread: items[i].unread,
              channel: items[i].url,
            };
        }
        return unreadMap;
      });
    }
  };

  updatePagePosition = async ({ channel, pageSlug, location, username }) => {
    return this.fireStudyGroupAction(
      {
        username: username,
        key: "updatePagePosition",
        val: { pageSlug, location },
      },
      channel,
    );
  };

  updateTypingLocation = async ({ channel, action, username }) => {
    return this.fireStudyGroupAction(
      {
        username: username,
        key: "updateTypingLocation",
        val: action,
      },
      channel,
    );
  };

  fireStudyGroupAction = (firedAction, channel) => {
    let data = { action: JSON.stringify(firedAction) };
    if (typeof channel?.updateMetaData !== "function") return false;
    return channel?.updateMetaData(data, true);
  };

  updateUserState = async ({ channels, activeGroup, activeCall, key }) => {
    await this.sb.connect(this.userId, this.token);
    if (!Array.isArray(channels)) return false;
    if (!key) key = "updateUserState";
    const SBController = this;
    var user = SBController.sb.currentUser;
    let valuesToUpdate = { activeGroup, activeCall };
    //console.log(JSON.stringify({ valuesToUpdate }));
    if (typeof valuesToUpdate.activeGroup !== "string")
      delete valuesToUpdate.activeGroup;
    if (typeof valuesToUpdate.activeCall !== "string")
      delete valuesToUpdate.activeCall;
    if (Object.values(valuesToUpdate).length === 0) return false;
    return user?.updateMetaData(valuesToUpdate, true, function(
      metadata,
      error,
    ) {
      if (error) return false;
      let promises = channels.map((channel) => {
        SBController.fireStudyGroupAction(
          {
            username: user?.userId,
            key: key,
            val: valuesToUpdate,
          },
          channel,
        );
      });
      return promises.pop();
    });
  };

  updateUserSummary = ({ channels, summaryData }) => {
    if (!summaryData) return false;
    const SBController = this;
    var user = SBController.sb.currentUser;
    let {
      completed,
      started,
      first,
      duration,
      count,
      slug,
      pagetitle,
      heading,
      latest,
      finished,
    } = summaryData;
    let updatedMetadata = {
      summary: JSON.stringify({
        completed,
        started,
        first,
        duration,
        count,
        finished,
      }),
      bookmark: JSON.stringify({ latest, slug, pagetitle, heading }),
    };
    return user?.updateMetaData(updatedMetadata, true, function(
      metadata,
      error,
    ) {
      if (error) {
        console.log({ error });
        debugger;
        return false;
      }
      let promises = channels.map((channel) =>
        SBController.fireStudyGroupAction(
          {
            username: user?.userId,
            key: "updateUserSummary",
            val: updatedMetadata,
          },
          channel,
        ),
      );
      return promises.pop();
    });
  };
  async connect(userId, token) {
    if (!userId || !token)
      return console.log("failed to connect:", { userId, token });
    await this.sb.connect(userId, token, (user, err) => {
      if (err) {
        error("Social " + err.message);
        return false;
      }
      if (user.profileUrl === "") {
        let tokenImg = tokenImage();
        return this.sb.updateCurrentUserInfo(user.nickname, tokenImg);
      }
      return true;
    });

    SendBirdCall.authenticate(
      { userId: userId, accessToken: token },
      (result, error) => {
        if (error) {
          // Handle authentication failure.
        } else {
          // The user has been successfully authenticated and is connected to Sendbird server.
        }
      },
    );
    // Establish websocket connection with Sendbird server.
    SendBirdCall.connectWebSocket()
      .then(function() {
        /* Succeeded to connect*/
      })
      .catch(function(error) {
        /* Failed to connect */
      });
  }

  disconnect(userId) {
    this.sb.disconnect(userId, (user, error) => {
      if (error) {
      }
    });
  }

  async inviteMembers(channel, userIds) {
    return await channel.inviteWithUserIds(userIds, (res, err) => {
      if (err) error(err.message);
      return res;
    });
  }

  // Accepting an invitation
  async acceptInvitation(channel) {
    return await channel.acceptInvitation((response, err) => {
      if (err) error(err.message);
      return response;
    });
  }

  // Declining an invitation
  async declineInvitation(channel) {
    return await channel.declineInvitation((response, err) => {
      if (err) error(err.message);
      return response;
    });
  }

  async removeMember(channel, userId) {
    return await channel.banUserWithUserId(userId, 0, "", (response, err) => {
      if (err) {
        error(err.message);
      }
      return response;
    });
  }

  async banMember(channel, userId) {
    return await channel.banUserWithUserId(
      userId,
      60 * 60 * 24 * 7,
      "",
      (response, err) => {
        if (err) {
          error(err.message);
        }
        return response;
      },
    );
  }

  async muteMember(channel, userId) {
    return await channel.muteUserWithUserId(userId, (response, err) => {
      if (err) error(err.message);
      return response;
    });
  }

  async unMuteMember(channel, userId) {
    return await channel.unmuteUserWithUserId(userId, (response, err) => {
      if (err) error(err.message);
      return response;
    });
  }

  async makeAdmin(channel, userId) {
    return await channel.addOperators([userId], (response, err) => {
      if (err) error(err.message);
      return response;
    });
  }
  async removeAdmin(channel, userId) {
    return await channel.removeOperators([userId], (response, err) => {
      if (err) error(err.message);
      return response;
    });
  }

  async setGroupNameDescription(channel, newName, newDesc) {
    let data = {};
    try {
      data = JSON.parse(channel.data);
    } catch (e) {}
    data.description = newDesc;
    let newData = JSON.stringify(data);
    return await channel.updateChannel({
      name: newName,
      coverUrl: channel.coverUrl,
      data: newData,
    });
  }
}

//EVENT HANDLERS
function AppHandlers(appController) {
  return {
    onMessageReceived: (channel, message) => {
      if (!message) return false;
      if (message.parentMessageId !== 0) {
        let event = new CustomEvent(
          "addMessageToThread" + message.parentMessageId,
        );
        event.message = message;
        window.dispatchEvent(event);
      } else {
        let event = new CustomEvent("addMessage");
        event.message = message;
        window.dispatchEvent(event);

        //  console.log({ customType:message.customType, channelUrl: message.channelUrl, activeURL: appController.states.studyGroup.activeGroup?.url})
        if (
          message.customType &&
          message.channelUrl ===
            appController.states.studyGroup.activeGroup?.url
        ) {
          let event = new CustomEvent("addMessageToPage-" + message.customType);
          event.message = message;
          window.dispatchEvent(event);
          appController.functions.markPopUpComments(true);
        }
      }
      var eventItem = new CustomEvent("fireMessage");
      eventItem.message = message;
      eventItem.channel = channel;
      window.dispatchEvent(eventItem);

      appController.sendbird
        .loadUnreadDMs()
        .then((unreadCounts) =>
          appController.functions.setUnreadDMs(unreadCounts),
        );
      refreshChannel(channel, appController);
    },
    onMessageUpdated: (channel, message) => {
      if (
        message.channelUrl !== appController.states.studyGroup.activeGroup?.url
      )
        return false;
      //Dispatch Event
      // update thread message if message have parentMessageId else add in main chat
      if (message.parentMessageId !== 0) {
        let event = new CustomEvent(
          "updateMessageInThread" + message.parentMessageId,
        );
        event.message = message;
        window.dispatchEvent(event);
      } else {
        let event = new CustomEvent("updateMessage");
        event.message = message;
        window.dispatchEvent(event);
        if (message.customType) {
          let event = new CustomEvent(
            "updateMessageToPage-" + message.customType,
          );
          event.message = message;
          window.dispatchEvent(event);
          // appController.functions.markPopUpComments(true);
        }
      }
    },
    onMessageDeleted: (channel, messageId) => {
      // if (channel.url !== appController.states.studyGroup.activeGroup?.url)
      //   return false;
      // const element = document.getElementById(messageId);
      // console.log("Element", element);
      // if (element) element.remove();
      // refreshChannel(channel, appController);
    },

    onTypingStatusUpdated: (channel) => {
      var typers = channel.getTypingUsers();
      if (!channel) return false;
      if (typers) {
        var event = new CustomEvent("typingStatusUpdated");
        event.channelUrl = channel.url;
        event.typers = typers;
        window.dispatchEvent(event);
      }
    },

    onReactionUpdated: (channel, reactionEvent) => {
      var event = new CustomEvent("reactTo" + reactionEvent.messageId);
      event.reactionEvent = reactionEvent;
      window.dispatchEvent(event);
    },
    onMetaCounterUpdated: (channel, metaCounter) => {
      return false;
    },
    onUserJoined: (channel, user) => {
      refreshChannel(channel, appController);
    },
    onUserLeft: (channel, user) => {
      if (user.state === null) return;
      refreshChannel(channel, appController);
    },
    onMetaDataUpdated: (channel, metaData) => {
      //use localstorage to prevent too frequent updates.  user channel.url as key
      const secondsToWait = 15;
      let now = new Date();
      let lastUpdate =
        localStorage.getItem(`lastUpdate-${channel.url}`) || null;
      if (lastUpdate) {
        let last = new Date(lastUpdate);
        let elapsed = (now - last) / 1000;
        if (elapsed < secondsToWait) return false;
      }
      localStorage.setItem(`lastUpdate-${channel.url}`, now);

      refreshChannel(channel, appController);
      if (metaData.action) {
        var event = new CustomEvent("fireStudyGroupAction");
        event.action = metaData.action;
        event.channelName = channel.name;
        event.channel = channel;
        window.dispatchEvent(event);
      }
    },
    onChannelChanged: (channel) => {
      return false;
    },
    onThreadInfoUpdated: async (channel, threadInfoUpdateEvent) => {
      const params = {
        messageId: threadInfoUpdateEvent.targetMessageId,
        channelType: channel.channelType,
        channelUrl: channel._url,
      };
      const parentMessage = await appController.sendbird.sb.message.getMessage(
        params,
      );
      parentMessage.applyThreadInfoUpdateEvent(threadInfoUpdateEvent);
    },
  };
}
