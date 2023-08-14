import { useState } from "react";
import { md5 } from "src/models/Utils";
import Loader from "../Loader";
import { StudyGroupChatPanel } from "./StudyHall";

export default function DirectMessages({ appController, userId }) {
  const myId = appController.states.user.social?.user_id;
  const theirId = userId;

  const [channel, setChannel] = useState(null);
  if (channel === null || !channel?.memberMap[theirId]) {
    //https://sendbird.com/docs/chat/v3/javascript/guides/group-channel#2-create-a-channel

    var params = new appController.sendbird.sb.GroupChannelParams();
    params.isDistinct = true;
    params.addUserIds([myId, theirId]);
    params.name = `DM between ${myId} and ${theirId}`;
    params.customType = "DM";
    params.channelUrl = md5(); // In a group channel, you can create a new channel by specifying its unique channel URL in a 'GroupChannelParams' object.

    appController.sendbird.sb.GroupChannel.createChannel(
      params,
      function (groupChannel, error) {
        if (error) {
          console.log("createChannelWithUserIds.ERROR", { error });
        }
        setChannel(groupChannel);
      }
    );
    return <div className={"StudyGroupChatPanel "}><Loader/></div>;
  }
  return (
    <StudyGroupChatPanel channel={channel} appController={appController} />
  );
}