import { useState } from "react";
import { md5 } from "src/models/Utils";
import Loader from "../Loader";
import { StudyGroupChatPanel } from "./StudyHall";

export default function DirectMessages({ appController, userId }) {
  const myId = appController.states.user.social?.user_id;
  const theirId = userId;

  const [channel, setChannel] = useState(null);
  if (
    channel === null ||
    !channel?.members.find((member) => member.userId === theirId)
  ) {
    //https://sendbird.com/docs/chat/v3/javascript/guides/group-channel#2-create-a-channel

    var params = {};
    params.isDistinct = true;
    params.invitedUserIds = [myId, theirId];
    params.name = `DM between ${myId} and ${theirId}`;
    params.customType = "DM";
    params.channelUrl = md5(); // In a group channel, you can create a new channel by specifying its unique channel URL in a 'GroupChannelParams' object.
		console.log('params',params);
    try {
      appController.sendbird.sb.groupChannel
        .createChannel(params)
        .then((groupChannel) => {
          setChannel(groupChannel);
        });
    } catch (error) {
      console.log("createChannelWithUserIds.ERROR", { error });
    }
    return (
      <div className={"StudyGroupChatPanel "}>
        <Loader />
      </div>
    );
  }
  return (
    <StudyGroupChatPanel channel={channel} appController={appController} />
  );
}
