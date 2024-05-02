import crypto from "crypto-browserify";
import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  FormGroup,
  Label,
  Card,
  CardBody,
  Button,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  ToastHeader,
} from "reactstrap";
import Switch from "react-bootstrap-switch";
import {
  breakCache,
  channelAtAGlance,
  isMobile,
  label,
  playSound,
  truncate,
} from "src/models/Utils";

import "./StudyGroupSelect.css";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import PictureWithOverlay from "../../User/PictureWithOverlay";
import group from "./svg/group.svg";
import dnd from "./svg/dnd.svg";
import { toast } from "react-toastify";
import usericon from "src/views/_Common/Study/svg/member.svg";
import callicon from "src/views/_Common/Study/svg/call.svg";
import groupicon from "src/views/User/svg/group.svg";
import call from "src/views/User/svg/call.svg";
import invite from "src/views/User/svg/invite.svg";
import exit from "src/views/User/svg/exit.svg";

import ffwd from "src/views/_Common/Study/svg/ffwd.svg";
import openIcon from "src/views/_Common/Study/svg/open.svg";
import soloIcon from "src/views/_Common/Study/svg/solo.svg";
import privateIcon from "src/views/_Common/Study/svg/private.svg";
import publicIcon from "src/views/_Common/Study/svg/public.svg";

import moment from "moment";
import { history } from "src/models/routeHistory";
moment.locale(label("moment_locale"), {
  relativeTime: {
    future: label("moment_future"),
    past: label("moment_past"),
    s: label("moment_s"),
    ss: label("moment_ss"),
    m: label("moment_m"),
    mm: label("moment_mm"),
    h: label("moment_h"),
    hh: label("moment_hh"),
    d: label("moment_d"),
    dd: label("moment_dd"),
    M: label("moment_M"),
    MM: label("moment_MM"),
    y: label("moment_y"),
    yy: label("moment_yy"),
  },
});

const typeIcons = {
  public: publicIcon,
  private: privateIcon,
  solo: soloIcon,
  open: openIcon,
};

export function StudyGroupSelect({ appController }) {
  const setGroups = () => {
    // COMMENT BY ME
    // console.log('StudyGroupSelect .....')
    // appController.sendbird.getStudyGroups().then((list) => {
    //   appController.functions.setStudyGroups(list);
    // });
  };

  useEffect(() => {
    if (!appController.states.studyGroup.activeGroup)
      setTimeout(setGroups, 2000);
  }, [
    appController.states.studyGroup.studyModeOn,
    appController.states.studyGroup.activeGroup,
    appController.states.studyGroup.groupList,
  ]);

  //LOADING SENDBIRD
  if (!appController.sendbird)
    return (
      <div
        onClick={setGroups}
        className={"StudyGroupSelect"}
        style={{ backgroundColor: "#666" }}
      >
        <img
          src={appController.states.studyGroup.studyModeOn ? group : dnd}
          className="generic"
        />
      </div>
    );

  //LOADING USER GROUPS
  if (!appController.states.studyGroup.activeGroup) {
    // COMMENT BY ME
    // console.log('LOADING USER GROUPS ..... StudyGroupSelect ....')
    // appController.sendbird
    //   .getStudyGroups()
    //   .then((list) => appController.functions.setStudyGroups(list));
    return (
      <>
        <div
          onClick={setGroups}
          className={"StudyGroupSelect"}
          style={{ backgroundColor: "#666" }}
        >
          <img
            src={appController.states.studyGroup.studyModeOn ? group : dnd}
            className="generic"
          />
        </div>
      </>
    );
  }
  //USER HAS NO GROUPS
  if (appController.states.studyGroup.activeGroup === -1) {
    return (
      <>
        {appController.states.studyGroup.isGroupListOpen ? (
          <StudyGroupList appController={appController} />
        ) : null}
        <div
          className={"StudyGroupSelect"}
          tabIndex={-1}
          onClick={() => {
            appController.functions.openGroupList(
              !appController.states.studyGroup.isGroupListOpen,
            );
          }}
        >
          <img
            src={appController.states.studyGroup.studyModeOn ? group : dnd}
            className="generic"
          />
        </div>
      </>
    );
  }
  if (
    appController.states.studyGroup.isGroupListOpen &&
    appController.states.studyGroup.isDrawerOpen
  )
    appController.functions.openDrawer(false);

  let imgurl = appController.states.studyGroup.activeGroup.coverUrl;
  if (!appController.states.studyGroup.studyModeOn) {
    imgurl = dnd;
  }

  let count = 0;
  for (let i in appController.states.studyGroup.groupList) {
    let group = appController.states.studyGroup.groupList[i];
    if (!group) continue;
    count = count + group.unreadMessageCount;
  }

  let counter =
    count > 0 && appController.states.studyGroup.studyModeOn ? (
      <div className="totalUnreadCount">{count}</div>
    ) : null;

  return (
    <>
      {appController.states.studyGroup.isGroupListOpen ? (
        <StudyGroupList appController={appController} />
      ) : null}
      <div
        className={"StudyGroupSelect"}
        tabIndex={-1}
        onClick={() => {
          appController.functions.openGroupList(
            !appController.states.studyGroup.isGroupListOpen,
          );
        }}
        style={{ backgroundImage: `url('${imgurl}')` }}
      >
        {counter}
      </div>
    </>
  );
}

export function StudyGroupList({ appController }) {
  const [contentTag, setContentTag] = useState("list");

  const [studyModeOn] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/studymode-on`);
    sound.preload = "auto";
    return sound;
  });
  const [studyModeoff] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/studymode-off`);
    sound.preload = "auto";
    return sound;
  });

  const setStudyMode = (e) => {
    let sound = !appController.states.studyGroup.studyModeOn
      ? studyModeOn
      : studyModeoff;
    if (appController.states.preferences.sound) playSound(sound); //.play();
    appController.functions.setStudyMode(
      !appController.states.studyGroup.studyModeOn,
    );
  };

  let contents = (
    <>
      <div className="topButtons">
        <Label className="studymode">
          {label("study_mode")}:{" "}
          <Switch
            onChange={setStudyMode}
            onText="On"
            offText="Off"
            value={appController.states.studyGroup.studyModeOn}
            onColor="default"
            offColor="default"
          />
        </Label>

        <Button
          className="btn btn-primary newgroupbutton"
          onClick={(e) => {
            e.preventDefault();
            setContentTag("new");
          }}
        >
          ➕ {label("new_group")}
        </Button>
      </div>
      <StudyGroupListItems appController={appController} />
    </>
  );

  if (contentTag === "new")
    contents = <NewStudyGroup appController={appController} />;
  let nickname = appController.sendbird.sb.currentUser?.nickname || null;

  return (
    <div
      tabIndex="1"
      id="dropdown"
      className={
        "groupList noselect" +
        (appController.states.studyGroup.studyModeOn ? "" : " disabled")
      }
    >
      <span className="arrow">▲</span>
      <span
        className="close"
        onClick={() => appController.functions.openGroupList(false)}
      >
        ×
      </span>
      <h5>
        {nickname
          ? label("xs_study_groups", [nickname])
          : label("study_groups")}
      </h5>
      <div className="newGroupWrapper">{contents}</div>
    </div>
  );
}

function StudyGroupListItems({ appController }) {
  useEffect(() => {}, [appController.states.studyGroup.groupList.length]);
  if (appController.states.studyGroup.groupList.length === 0) {
    return <div className="noGroups">{label("create_or_join_groups")}</div>;
  }
  return (
    <ul>
      {appController.states.studyGroup.groupList.map((group) =>
        group?.url ? (
          <StudyGroupListItem
            key={group.url}
            group={group}
            appController={appController}
          />
        ) : null,
      )}
    </ul>
  );
}

function StudyGroupListItem({ group, appController }) {
  const [switchSound] = useState(() => {
    let sound = new Audio(`${assetUrl}/interface/audio/switch`);
    sound.preload = "auto";
    return sound;
  });
  let [groupNums, setGroupNums] = useState({
    unread: 0,
    members: 0,
    onsite: 0,
    ingroup: 0,
    incall: 0,
  });
  let [room, setRoom] = useState(group.room);

  const leave = async (s) => {
		try {
			await group.leave();
			appController.functions.setActiveStudyGroup(null);
			appController.sendbird?.getStudyGroups()
			.then((list) =>{ 
        const [group] = list || [];
        if(group) appController.functions.setActiveStudyGroup(group);
        appController.functions.setStudyGroups(list)
      });	
		} catch (error) {
			console.log('Error',error);
			return false;
		}
  };

  useEffect(() => {
    channelAtAGlance(group, room).then((groupNums) => setGroupNums(groupNums));
  }, []);

  //Keep Numbers Updated
  useEffect(() => {
    channelAtAGlance(group, room).then((groupNums) => setGroupNums(groupNums));
  }, [
    group.room?._participantCollection?._remoteParticipants?.length,
    group.room?._participantCollection?.localParticipant,
    JSON.stringify(group.members),
    group.unreadMessageCount,
    group.joinedMemberCount,
  ]);

  //ACTIVE GROUP PRESENCE
  let activeClass = "";
  let activeBadge = "";
  let groupOnClick = appController.functions.setActiveStudyGroup;
  if (
    appController.states.studyGroup.activeGroup.url === group.url &&
    appController.states.studyGroup.studyModeOn
  ) {
    activeClass = " active";
    activeBadge = <div className="presentHere"></div>;
    groupOnClick = () => {
      appController.functions.openGroupList(false);
      appController.functions.openDrawer(true);
      if (isMobile()) appController.functions.setMobileChat(true);
    };
  }

  //COUNTERS
  let groupListItemBadge =
    groupNums.unread === 0 ? null : (
      <div className="groupListItemBadge">{groupNums.unread}</div>
    );

  let joinedMemberCount =
    group.joinedMemberCount === 1
      ? label("member_singular", group.joinedMemberCount)
      : label("member_plural", group.joinedMemberCount);

  const [dropDown, setDropDown] = useState(false);

  const handleGoToLastMsg = () => {
    appController.functions.setActiveStudyGroup(group);
    appController.functions.openGroupList(false);
    let parentMessage = null;
    console.log("LastMessage", group);
    if (group.lastMessage.customType !== "comment") {
      let slug =
        group.lastMessage.customType +
        "/" +
        JSON.parse(group.lastMessage.data).links.text;
      history.push(`/${slug}`);
      parentMessage = group.lastMessage;
    } else {
      const urlSlug = `/group/${group.url}/${group.lastMessage?.messageId}`;
      history.push(urlSlug);
      parentMessage = group.lastMessage;
    }
    appController.functions.openDrawer(true);
    setTimeout(() => {
      appController.functions.setParentMessage(parentMessage);
    }, 2000);
  };

  let countItems = {
    onsite: (
      <span>
        {groupNums.onsite - 1} {label("online")}
      </span>
    ),
    ingroup: (
      <span>
        {groupNums.ingroup} {label("studying_now")}
      </span>
    ),
    incall: (
      <span>
        {groupNums.incall} {label("in_call")}
      </span>
    ),
  };

  if (!groupNums.incall) delete countItems.incall;
  if (!groupNums.onsite) delete countItems.onsite;
  if (groupNums.onsite === 1) delete countItems.onsite;
  if (!groupNums.ingroup) delete countItems.ingroup;

  if (groupNums.ingroup) delete countItems.onsite;
  if (groupNums.incall) delete countItems.ingroup;

  let lastMessage = group.lastMessage?._sender ? (
    <>
      <img
        onError={breakCache}
        src={group.lastMessage._sender.plainProfileUrl}
      />
      <span className="speaker">
        {truncate(group.lastMessage._sender.nickname, 5, 5, 20)}
      </span>
      :{" "}
      <span className="fromNow">
        {moment.unix(group.lastMessage.createdAt / 1000).fromNow()}
      </span>
      <span className="message">
        {group.lastMessage.message
          .replace(/<[^>]*>/gi, "")
          .replace(/^•$/, label("highlight_msg"))}
      </span>
    </>
  ) : null;

  let callBadge = groupNums?.incall ? (
    <div className="groupCallContainer">
      <div className="callerCount">
        <img src={callicon} />
        {groupNums?.incall}
      </div>
    </div>
  ) : null;

  const showInviteLink = () => {
    var event = new CustomEvent("showInviteLink");
    event.studyGroup = group;
    window.dispatchEvent(event);
  };

  //exclude self and bots
  let members = group.members.filter((m) => {
    const isSelf = m.userId === appController.states.user.social?.user_id;
    const isBot = !!m.metaData?.isBot;
    if (isSelf || isBot) return false;
    return true;
  });
  let url = group.url;

  const sortByLastStudied = (a, b) => {
    let a_data = { latest: 0 };
    try {
      a_data = JSON.parse(a?.metaData?.bookmark);
    } catch (e) {}
    let b_data = { latest: 0 };
    try {
      b_data = JSON.parse(b?.metaData?.bookmark);
    } catch (e) {}

    return -a_data.latest + b_data.latest;
  };
  let circles = members?.sort(sortByLastStudied).map((m) => {
    if (m.userId === appController.states.user.user) return null;
    let color = "grey";
    if (m.connectionStatus === "online") {
      if (m.metaData?.activeGroup !== "") color = "yellow";
      if (m.metaData?.activeGroup === url) color = "green";
    }
    return {
      color: color,
      components: (
        <div className={color}>
          <img onError={breakCache} src={m.profileUrl} />
          <div className="dot"></div>
        </div>
      ),
    };
  });

  let greenCount = circles.filter((a) => a?.color === "green").length;
  //if (circles.length === 0) return null;

  return (
    <li
      key={group.url}
      className={"groupListItem" + activeClass}
      onClick={() => {
        groupOnClick(group);
        if (appController.states.preferences.sound) playSound(switchSound); //.play();
      }}
    >
      <div className="groupListItemImgContainer">
        {activeBadge}
        <img
          className="groupListItemImg"
          alt={group.name}
          src={`${group.coverUrl}`}
        />
        {groupListItemBadge}
      </div>
      <div className="groupListItemContent">
        <div className="groupName">
          <img
            className="grouptype"
            src={typeIcons[group.customType.toLowerCase()]}
          />{" "}
          {group.name} {callBadge}
        </div>
        <div className="lastMessage">{lastMessage}</div>
        <GroupMemberCircles circles={circles} greenCount={greenCount} />
      </div>

      <Dropdown
        className="groupItem"
        direction="right"
        isOpen={dropDown}
        toggle={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDropDown(!dropDown);
        }}
      >
        <DropdownToggle tag="div" className="threedots">
          ⋮
        </DropdownToggle>
        <DropdownMenu>
          <DropdownItem
            onClick={() => {
              if (appController.states.preferences.sound)
                playSound(switchSound); //.play();
              appController.functions.setActiveStudyGroup(group);
              appController.functions.openGroupList(false);
              appController.functions.openDrawer(true);
            }}
          >
            <img src={groupicon} />
            <div>{label("open_study_hall")}</div>
          </DropdownItem>
          {lastMessage && (
            <DropdownItem onClick={() => handleGoToLastMsg()}>
              <img src={ffwd} />
              <div>{label("go_to_last_msg")}</div>
            </DropdownItem>
          )}
          {!!greenCount && (
            <DropdownItem
              onClick={() => appController.functions.startCall(group)}
            >
              <img src={call} />
              <div>
                {groupNums.incall ? label("join_call") : label("start_call")}
              </div>
            </DropdownItem>
          )}
          {["private", "public"].includes(group.customType) && (
            <DropdownItem onClick={showInviteLink}>
              <img src={invite} />
              <div>{label("get_invite_link")}</div>
            </DropdownItem>
          )}
          <DropdownItem onClick={leave}>
            <img src={exit} />
            <div>{label("leave_group")}</div>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </li>
  );
}

export function GroupMemberCircles({ circles, greenCount }) {
  if (circles.length === 1) return null;
  return (
    <div className="groupMembersContainer">
      <div className="memberCount">
        <img src={usericon} />
        {greenCount ? greenCount + "/" : null}
        {circles.length + 1}
      </div>
      <div className="groupMembers">
        {circles.slice(0, 10).map((c) => c?.components)}
      </div>
    </div>
  );
}

export function generateGroupHash(group, callback) {
  if (!group) return null;
  BoMOnlineAPI({ setShortLink: group.url }, { type: "mutation" }).then((r) => {
    var data = { hash: r.setShortLink[group.url].hash };
    group.createMetaData(data).then((response)=>{
			callback(response);
		})
  });
}

const groupCoverUrl = (group_name) => {
    const encodedName = encodeURI(group_name);
    const colors = ["323b4d", "fbc658", "dddddd", "666666"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const newURL = `https://api.dicebear.com/7.x/initials/svg?seed=${encodedName}&rotate=340&fontFamily=Trebuchet%20MS&fontWeight=800&backgroundColor=${color}`;
    return newURL;
}

function NewStudyGroup({ appController }) {
  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState("");
  const [buttonLabel, setButtonLabel] = useState(
    label("create_new_study_group"),
  );
  const [groupImage, setGroupImage] = useState({
    img: groupCoverUrl(name),
    file: null,
  });
  const urlToObject = async () => {
    const response = await fetch(groupImage.file);
    // here image is url/location of image
    const blob = await response.blob();
    const file = new File([blob], "image.jpg", { type: blob.type });
    setGroupImage({ img: groupImage.img, file: file });
  };
  useEffect(() => {
    if (typeof groupImage.file === "string") {
      urlToObject();
    } else {
      return;
    }
  }, [groupImage.file]);
  const updateData = () => {
    let name = document.querySelector(".CreateGroupInput input[name=groupName]")
      .value;
    setName(name);
    setGroupImage({
      img: groupCoverUrl(name),
      file: groupImage.file,
    });
  };

  const submit = () => {
    let name = document.querySelector(".CreateGroupInput input[name=groupName]")
      .value;
    let description = document.querySelector(".CreateGroupInput textarea")
      .value;
    let type =
      document.querySelector("input[type=radio]:checked").value || "private";
    let url = crypto
      .createHash("md5")
      .update(crypto.randomBytes(20).toString("hex"))
      .digest("hex");
    let inputData = { name, description, type, url, groupImage };
    if (inputData.name === "") {
      toast.error(label("no_name"));

      return false;
    }
    setButtonLabel(label("creating_group"));
    appController.sendbird.createNewGroup(inputData, appController.states.user.social?.user_id)
    .then(({groupChannel:group}) => {
      generateGroupHash(group, () => {
      	setButtonLabel(label("status_done"));
        appController.functions.setActiveStudyGroup(group);
        appController.functions.openGroupList(false);
        appController.functions.openDrawer(true);
        appController.sendbird?.getStudyGroups()
        .then((list) => appController.functions.setStudyGroups(list));
      });
    });
  };

  useEffect(() => {
    document.querySelector("[value=open]")?.click();
  }, []);

  return (
    <>
      <Card className="CreateGroupInput">
        <CardBody>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              return false;
            }}
          >
            <FormGroup>
              <h5>{label("new_study_group_name")}</h5>
              <Input
                placeholder=""
                name="groupName"
                type="text"
                onChange={updateData}
              />
            </FormGroup>
            <FormGroup>
              <h5>
                {label("new_study_group_description")}{" "}
                <span className="optional">({label("optional")})</span>
              </h5>
              <Input
                className="groupdesc"
                placeholder={label("who_group_for")}
                name="discreption"
                type="textarea"
              />
            </FormGroup>
            <FormGroup>
              <h5>
                {label("new_study_group_icon")}{" "}
                <span className="optional">({label("optional")})</span>
              </h5>
              <PictureWithOverlay
                imgUrl={groupImage.img}
                setOpenModal={setOpenModal}
                openModal={openModal}
                appController={appController}
                isGroup={true}
                setProfileImage={setGroupImage}
              />
            </FormGroup>
            <FormGroup>
              <h5>{label("new_study_group_type")}</h5>
              <div className="groupPrivacy">
                <FormGroup className="mb-0">
                  <Label>
                    <Input type="radio" name="group-radio" value="solo" />
                    <img src={soloIcon} />
                    <span className="iconLabel">
                      {label("group_type_solo")}
                    </span>
                    <span>{label("group_type_solo_desc")}</span>
                  </Label>
                  <Label>
                    <Input type="radio" name="group-radio" value="private" />
                    <img src={privateIcon} />
                    <span className="iconLabel">
                      {label("group_type_private")}
                    </span>
                    <span>{label("group_type_private_desc")}</span>
                  </Label>
                  <Label>
                    <Input
                      type="radio"
                      name="group-radio"
                      value="public"
                      className="publicgroup"
                    />
                    <img src={publicIcon} />
                    <span className="iconLabel">
                      {label("group_type_public")}
                    </span>
                    <span>{label("group_type_public_desc")}</span>
                  </Label>
                  <Label>
                    <Input type="radio" name="group-radio" value="open" />
                    <img src={openIcon} />
                    <span className="iconLabel">
                      {label("group_type_open")}
                    </span>
                    <span>{label("group_type_open_desc")}</span>
                  </Label>
                </FormGroup>
              </div>
            </FormGroup>
          </Form>
        </CardBody>
      </Card>
      <Button className="create" onClick={submit}>
        {buttonLabel}
      </Button>
    </>
  );
}
