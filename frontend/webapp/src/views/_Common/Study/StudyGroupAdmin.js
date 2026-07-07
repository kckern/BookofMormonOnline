import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from "reactstrap";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuTrigger,
} from "rctx-contextmenu";
import PictureWithOverlay from "../../User/PictureWithOverlay";

import "./StudyGroupAdmin.css";
import { breakCache, label, testJSON } from "src/models/Utils";

import flag from "./svg/flag.svg";
import info from "./svg/info.svg";
import group from "./svg/group.svg";
import members from "./svg/members.svg";
import newuser from "./svg/newuser.svg";
import membericon from "./svg/member.svg";

import admin from "src/views/User/svg/admin.svg";
import mute from "src/views/_Common/Study/svg/mute.svg";
import remove from "src/views/_Common/Study/svg/remove.svg";
import ban from "src/views/_Common/Study/svg/ban.svg";
import { generateGroupHash } from "./StudyGroupSelect";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { toast } from "react-toastify";

export default function StudyGroupAdmin({ appController }) {
  const [group, setGroup] = useState(
    appController.states.studyGroup.activeGroup,
  );
  const [groupImage, setGroupImage] = useState({
    img: appController.states.studyGroup.activeGroup.coverUrl,
    file: appController.states.studyGroup.activeGroup.coverUrl,
  });
  const [openModal, setOpenModal] = useState(false);

  // Live membership: membership_changed → refreshChannel → activeGroup is
  // replaced with a fresh object. Key on a roster signature (not the object)
  // so per-message channel refreshes don't retrigger; on a real roster change
  // re-sync the local group (BannedMembers re-fetches off it) and re-fetch
  // operators.
  const activeGroup = appController.states.studyGroup.activeGroup;
  const rosterKey = (activeGroup.members || [])
    .map((m) => `${m.userId}:${m.role}:${m.isMuted ? 1 : 0}`)
    .join("|");

  useEffect(() => {
    setGroup(activeGroup);
    if (activeGroup.myRole !== "operator") return;
    appController.sendbird
      ?.fetchGroupOperators(activeGroup)
      .then((operators) => {
        appController.functions.setActiveGroupOperators(operators);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterKey]);

  const saveProfileInfo = async (e) => {
    document.getElementById("group_name").disabled = true;
    document.getElementById("group_description").disabled = true;
    document.getElementById("group_members_can_invite").disabled = true;
    let button = e.target;
    button.innerText = label("saving");
    button.disabled = true;
    let group_name = document.getElementById("group_name").value;
    let group_description = document.getElementById("group_description").value;
    let members_can_invite = document.getElementById(
      "group_members_can_invite",
    ).checked;

    try {
      const groupChannel = await appController.sendbird.setGroupNameDescription(
        group,
        group_name,
        group_description,
        members_can_invite,
      );

      const updateParams = {};
      updateParams.coverImage = groupImage.file;

      const freshGroup = await groupChannel.updateChannel(updateParams);

      appController.functions.setActiveStudyGroup(freshGroup);
      setGroup(freshGroup);
    } catch (error) {
      console.log({ error });
    }

    document.getElementById("group_name").disabled = false;
    document.getElementById("group_description").disabled = false;
    document.getElementById("group_members_can_invite").disabled = false;
    button.disabled = false;
    button.innerText = label("saved");
    //setTimeout(()=>appController.functions.hotUpdateActiveCover(freshGroup.coverUrl),1000);
  };

  const removeMember = async (e, data) => {
    await appController.sendbird.removeMember(group, data.userId);
    let freshGroup = await group.refresh();
    appController.functions.setActiveStudyGroup(freshGroup);
    setGroup(freshGroup);
  };
  const banMember = async (e, data) => {
    await appController.sendbird.banMember(group, data.userId);
    let freshGroup = await group.refresh();
    appController.functions.setActiveStudyGroup(freshGroup);
    setGroup(freshGroup);
  };

  const makeAdmin = async (e, data) => {
    await appController.sendbird.makeAdmin(group, data.userId);
    let freshGroup = await group.refresh();
    appController.functions.setActiveStudyGroup(freshGroup);
    setGroup(freshGroup);
  };
  const removeAdmin = async (e, data) => {
    await appController.sendbird.removeAdmin(group, data.userId);
    let freshGroup = await group.refresh();
    appController.functions.setActiveStudyGroup(freshGroup);
    setGroup(freshGroup);
  };
  const muteMember = async (e, data) => {
    await appController.sendbird.muteMember(group, data.userId);
    let freshGroup = await group.refresh();
    appController.functions.setActiveStudyGroup(freshGroup);
    setGroup(freshGroup);
  };
  const unMuteMember = async (e, data) => {
    await appController.sendbird.unMuteMember(group, data.userId);
    let freshGroup = await group.refresh();
    appController.functions.setActiveStudyGroup(freshGroup);
    setGroup(freshGroup);
  };

  const sortFn = (a,b) => {
    const summaryA = JSON.parse(a?.metaData?.summary || "{}");
    const summaryB = JSON.parse(b?.metaData?.summary || "{}");
    const completedA = summaryA?.completed || 0;
    const completedB = summaryB?.completed || 0;
    if (completedA > completedB) return -1;
    if (completedA < completedB) return 1;
    return 0;
  };

  const handleLeftMouseClick = (e) => {
    let evt = new MouseEvent("contextmenu", {
      bubbles: true,
      clientX: e.clientX,
      clientY: e.clientY,
    });
    e.target.dispatchEvent(evt);
  };

  // Prefill the saved description. The backend now returns it both as a
  // top-level `description` and merged into `data` JSON; read whichever is set
  // so the edit form is populated on open (not the empty placeholder).
  let description = group.description || "";
  if (!description) {
    try {
      description = JSON.parse(group.data)?.description || "";
    } catch (e) {}
  }

  return (
    <div className={"StudyGroupChatPanel admin noselect"}>
      <Card>
        <CardHeader>
          <h5 className={"title"}>✏️ {label("edit_group_profile")}</h5>
        </CardHeader>
        <CardBody className={"group_profile"}>
          <div className={"groupImage"}>
            <PictureWithOverlay
              imgUrl={groupImage.img}
              setOpenModal={setOpenModal}
              openModal={openModal}
              appController={appController}
              isGroup={true}
              setProfileImage={setGroupImage}
            />
          </div>
          <div className={"groupInfo"}>
            <InputGroup>
              <InputGroupAddon addonType="prepend">
                <InputGroupText>
                  <img src={flag} />
                </InputGroupText>
              </InputGroupAddon>
              <Input
                id="group_name"
                placeholder={label("group_name")}
                defaultValue={group.name}
                disabled={false}
                type="text"
              />
            </InputGroup>
            <InputGroup>
              <InputGroupAddon addonType="prepend">
                <InputGroupText>
                  <img src={info} />
                </InputGroupText>
              </InputGroupAddon>
              <Input
                id="group_description"
                placeholder={label("group_description")}
                defaultValue={description}
                disabled={false}
                type="text"
              />
            </InputGroup>
            <label
              htmlFor="group_members_can_invite"
              style={{ display: "flex", alignItems: "center", gap: "0.5em", margin: "0.5em 0", cursor: "pointer" }}
            >
              <Input
                id="group_members_can_invite"
                type="checkbox"
                style={{ position: "static", margin: 0 }}
                defaultChecked={group.metadata?.membersCanInvite === true}
              />
              {label("members_can_invite_others")}
            </label>
            <div style={{ textAlign: "right" }}>
              <Button onClick={saveProfileInfo}>{label("save")}</Button>
            </div>
          </div>
        </CardBody>
        <RequestManagement appController={appController} />
        <CardHeader>
          <h5 className={"title"}>
            <img src={members} /> {label("manage_group_members")}
          </h5>
        </CardHeader>
        <CardBody>
          <div className="userAdminBoxes">
            {(activeGroup.members || [])
              .sort(sortFn)
              .map((member) => {
                let isAdmin = member.role === "operator";
                let isMuted = member.isMuted;
                let mutedIcon = isMuted ? <img src={mute} /> : "NOMUTE";
                let isBot = !!member?.metaData?.isBot;

                if(isBot) return null;

                let summary = {};
                try{
                  summary = JSON.parse(member?.metaData?.summary || "{}");
                }catch(e){}
                const {completed} = summary;

                return (
                  <Card className={"userAdminBox"} key={member.userId}>
                    <CardHeader>
                      <ContextMenuTrigger
                        id={`${member.userId}_contextmenu`}
                        holdToDisplay={0}
                      >
                        <h5 className={"title"}>
                          <span
                            className="actions"
                            onClick={handleLeftMouseClick}
                          >
                            ⋮
                          </span>
                          <img src={membericon} />
                          {member.nickname}
                          <span className="completed">{completed || 0}%</span>
                        </h5>
                      </ContextMenuTrigger>
                    </CardHeader>
                    <CardBody>
                      <img src={member.plainProfileUrl} onError={breakCache} />
                    </CardBody>
                    <CardFooter>
                      {isAdmin ? (
                        <div className="statusline">
                          <img src={admin} className="menuimg" />{" "}
                          <div>{label("administrator")}</div>{" "}
                        </div>
                      ) : null}
                      {isMuted ? (
                        <div className="statusline">
                          <img src={mute} className="menuimg"/> <div>{label("muted")}</div>
                        </div>
                      ) : null}
                    </CardFooter>

                    <ContextMenu id={`${member.userId}_contextmenu`}>
                      <ContextMenuItem
                        onClick={
                          isMuted
                            ? () => unMuteMember(null, { userId: member.userId })
                            : () => muteMember(null, { userId: member.userId })
                        }
                      >
                        <img src={mute}  className="menuimg"/>{" "}
                        {isMuted ? label("unmute") : label("mute")}
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => removeMember(null, { userId: member.userId })}
                      >
                        <img src={remove}  className="menuimg"/> {label("remove_from_group")}
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => banMember(null, { userId: member.userId })}
                      >
                        <img src={ban}  className="menuimg"/> {label("ban_from_group")}
                      </ContextMenuItem>
                      <ContextMenuItem divider />
                      <ContextMenuItem
                        onClick={isAdmin ? () => removeAdmin(null, { userId: member.userId }) : () => makeAdmin(null, { userId: member.userId })}
                      >
                        <img src={admin}  className="menuimg"/>{" "}
                        {isAdmin
                          ? label("remove_admin")
                          : label("make_group_admin")}
                      </ContextMenuItem>
                    </ContextMenu>
                  </Card>
                );
              })}
          </div>
        </CardBody>
        <BannedMembers
          appController={appController}
          group={group}
          setGroup={setGroup}
        />
      </Card>
    </div>
  );
}

function BannedMembers({ appController, group, setGroup }) {
  const [bannedMembers, setBannedMembers] = useState([]);

  // Re-fetch whenever the group object changes (a ban/refresh produces a fresh
  // group object, so a freshly banned member appears here without a reload).
  useEffect(() => {
    appController.sendbird
      ?.fetchBannedMembers(group)
      .then((members) => setBannedMembers(members || []));
  }, [group]);

  const unbanMember = async (userId) => {
    const success = await appController.sendbird.unbanMember(group, userId);
    if (!success) return toast.warn(label("error"));
    setBannedMembers((prev) => prev.filter((m) => m.userId !== userId));
    let freshGroup = await group.refresh();
    appController.functions.setActiveStudyGroup(freshGroup);
    setGroup(freshGroup);
  };

  if (!bannedMembers.length) return null;
  return (
    <>
      <CardHeader>
        <h5 className={"title"}>
          <img src={ban} /> {label("banned_members")}
        </h5>
      </CardHeader>
      <CardBody>
        <div className="userAdminBoxes">
          {bannedMembers.map((member) => (
            <Card className={"userAdminBox"} key={member.userId}>
              <CardHeader>
                <h5 className={"title"}>
                  <img src={membericon} />
                  {member.nickname}
                </h5>
              </CardHeader>
              <CardBody>
                <img src={member.plainProfileUrl} onError={breakCache} />
              </CardBody>
              <CardFooter>
                <Button
                  color="success"
                  onClick={() => unbanMember(member.userId)}
                >
                  {label("unban")}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </CardBody>
    </>
  );
}

function RequestManagement({ appController }) {
  const token = appController.states.user.token;
  const group = appController.states.studyGroup.activeGroup;
  const data = testJSON(group.data) ? JSON.parse(group.data) : { requests: [] };
  const [hash, setHash] = useState(null);
  const [requesters, setRequesters] = useState([]);

  useEffect(() => {
    BoMOnlineAPI(
      { requestedUsers: { token, channel: group.url } },
      { useCache: false },
    ).then((res) => {
      setRequesters(res.requestedUsers);
    });
  }, []);
  if (!data.requests?.length) return null;
  return (
    <>
      <CardHeader>
        <h5 className={"title"}>
          <img src={newuser} />{" "}
          {label("x_memebership_requests", [data.requests.length])}
        </h5>
      </CardHeader>
      <CardBody className="membershipRequests">
        {requesters.map((userObj) => (
          <Requester
            key={userObj.user_id}
            userObj={userObj}
            appController={appController}
          />
        ))}
      </CardBody>
    </>
  );
}

function Requester({ appController, userObj }) {
  const [exits, setExists] = useState(true);
  const [waiting, setWaiting] = useState(false);

  if (!exits || !userObj) return null;
  let { nickname, user_id, picture } = userObj;

  const grantRequest = (grant) => {
    setWaiting(grant ? 1 : 2);
    let token = appController.states.user.token;
    let channel = appController.states.studyGroup.activeGroup.url;
    console.log({ token, channel, user_id, grant });
    BoMOnlineAPI(
      { processRequest: { token, channel, user_id, grant } },
      { useCache: false },
    ).then((success) => {
      if (!success) return toast.warn(label("error"));
      setExists(false);
    });
  };

  return (
    <Card>
      <CardHeader>
        <h5 className={"title"}>
          <img src={membericon} />
          {nickname}
        </h5>
      </CardHeader>

      <CardBody
        style={{
          display: "flex",
          width: "100%",
          justifycontent: "center",
        }}
      >
        <img src={picture} onError={breakCache} />
      </CardBody>
      <CardFooter>
        <Button color="success" onClick={() => grantRequest(true)}>
          {label(waiting === 1 ? "approving" : "approve")}
        </Button>
        <Button color="danger" onClick={() => grantRequest(false)}>
          {label(waiting === 2 ? "denying" : "deny")}
        </Button>
      </CardFooter>
    </Card>
  );
}
