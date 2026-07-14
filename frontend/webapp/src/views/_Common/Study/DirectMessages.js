import { useState, useEffect, useRef } from "react";
import Loader from "../Loader";
import { StudyGroupChatPanel } from "./StudyHall";
import { useAppController } from "src/contexts/AppControllerContext";
import { useMessenger } from "src/contexts/MessengerContext";

export default function DirectMessages({ userId }) {
  const appController = useAppController();
  const messenger = useMessenger();
  const myId = appController.states.user.social?.user_id;
  const theirId = userId;

  const [channel, setChannel] = useState(null);
  // Guard against setState after unmount: rapid panel switching can unmount this
  // component while createChannel() is still resolving.
  const isMounted = useRef(true);

  // Resolve (find-or-create) the 1:1 DM channel for this member pair exactly
  // once per pair. Doing this in render (as before) re-fired createChannel on
  // every render until setChannel resolved, minting 3-4 orphan channels per
  // open. isDistinct + no forced channelUrl lets the backend reuse the existing
  // DM channel, so history persists across open/close/reopen.
  useEffect(() => {
    isMounted.current = true;
    // Already have the right channel for this pair — nothing to do.
    if (channel?.members?.find((member) => member.userId === theirId)) {
      return () => {
        isMounted.current = false;
      };
    }

    const params = {
      isDistinct: true,
      invitedUserIds: [myId, theirId],
      name: `DM between ${myId} and ${theirId}`,
      customType: "DM",
    };

    messenger.sb.groupChannel
      .createChannel(params)
      .then((groupChannel) => {
        if (!isMounted.current) return;
        setChannel(groupChannel);
      })
      .catch((error) => {
        console.error("DirectMessages.createChannel.ERROR", { error });
      });

    return () => {
      isMounted.current = false;
    };
    // Re-resolve only when the conversation partner changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theirId]);

  if (!channel?.members?.find((member) => member.userId === theirId)) {
    return (
      <div className={"StudyGroupChatPanel "}>
        <Loader />
      </div>
    );
  }
  return (
    <StudyGroupChatPanel channel={channel} />
  );
}
