import { useState, useEffect, useRef, useCallback } from "react"
import { Link, useHistory, useParams } from "react-router-dom"
import ReactTooltip from "react-tooltip"
import {
  StudyGroupUserCircle,
  getClassesFromUserObj,
  UnreadDMCount,
} from "src/views/_Common/Study/StudyGroupBar"
import "./StudyHall.css"
import {
  StudyGroupChatInput,
  StudyGroupChat,
  StudyGroupThread,
} from "./StudyChat.js"
import {
  timeAgoString,
  newPost,
  replies,
  label,
  testJSON,
  isMobile,
} from "src/models/Utils"
import DirectMessages from "./DirectMessages"
import StudyGroupProgress from "./StudyGroupProgress"
import StudyGroupAdmin from "./StudyGroupAdmin"
import { getFreshUsers } from "./StudyGroupBar"

import bookmarkicon from "src/views/User/svg/bookmark.svg"
import lastseen from "src/views/User/svg/lastseen.svg"
import crosshairs from "src/views/User/svg/crosshairs.svg"

import admin from "src/views/User/svg/admin.svg"
import adduser from "src/views/_Common/Study/svg/adduser.svg"
import discussion from "src/views/User/svg/discussion.svg"
import progress from "src/views/User/svg/progress.svg"
import loadingicon from "src/views/User/svg/loading.svg"
import dmicon from "src/views/User/svg/chat.svg"
import moment from "moment"
import { Button } from "reactstrap"
import { useAppController } from "src/contexts/AppControllerContext"
import { useMessenger } from "src/contexts/MessengerContext"

export function StudyHall() {
  const appController = useAppController()
  let isDrawerOpen = appController.states.studyGroup.isDrawerOpen
  const [opening, setOpening] = useState(true)
  const [activePanel, setPanel] = useState(
    typeof isDrawerOpen === "boolean"
      ? { key: "chat", val: null }
      : isDrawerOpen,
  )

  let studyGroup = appController.states.studyGroup.activeGroup

  // One-shot "opening" animation flag. Run once on mount with a cleared timer
  // so an unmount within 50ms (quick hall open/close) doesn't setState on an
  // unmounted component. (Was: no deps + no cleanup → leaked on every render.)
  useEffect(() => {
    const t = setTimeout(() => setOpening(false), 50)
    return () => clearTimeout(t)
  }, [])
  if (!studyGroup || studyGroup === -1) return null
  return (
    <div className={"StudyHall" + (opening ? " opening" : "")}>
      <div className={"StudyHallContents "}>
        <StudyGroupHeader
          studyGroup={studyGroup}
        />
        <div className="StudyGroupBody">
          <StudyGroupSideBar
            studyGroup={studyGroup}
            setPanel={setPanel}
            activePanel={activePanel}
          />
          <StudyGroupMainPanel
            activePanel={activePanel}
            setPanel={setPanel}
          />
        </div>
      </div>
    </div>
  )
}

function StudyGroupHeader({ studyGroup }) {
  return (
    <div className={"StudyGroupHeader"}>
      <div className={"GroupName"}>{studyGroup.name}</div>
      <InviteButton studyGroup={studyGroup} />
    </div>
  )
}

export function InviteButton({ studyGroup }) {
  if (!["open", "public", "private"].includes(studyGroup.customType))
    return null

  const showInviteLink = () => {
    var event = new CustomEvent("showInviteLink")
    event.studyGroup = studyGroup
    window.dispatchEvent(event)
  }

  return (
    <Button onClick={showInviteLink} className="invite">
      {" "}
      <img src={adduser} alt="" /> {label("invite")}
    </Button>
  )
}

function StudyGroupSideBar({
  studyGroup,
  setPanel,
  activePanel,
}) {
  const appController = useAppController()
  const messenger = useMessenger()
	const [users,setUsers] = useState([]);
  const tooltip_id = "SideBar" + studyGroup.url

  const isActive = (val) => {
    if (activePanel?.key === val) return "active"
    return null
  }
  const group = appController.states.studyGroup.activeGroup
  let unread = group.unreadMessageCount
  const requests = testJSON(group.data)
    ? JSON.parse(group.data).requests?.length
    : 0

		useEffect(()=>{
			let mounted = true;
			const getLiveFreshUsers = async()=>{
				const activeGroupMembers = group.members;
				if(activeGroupMembers!==undefined && activeGroupMembers?.length !== 1){
				const mainUser = appController.states.user;
				const queryParams = {
					userIdsFilter:[...activeGroupMembers.filter(member=>member.userId !== mainUser.social.user_id).map(user=>user.userId)]
				}
				const query = messenger.sb.createApplicationUserListQuery(queryParams);

				const queryUsers = await query.next();

				let { users } = getFreshUsers(appController, queryUsers);

				// Guard against setState after unmount — the awaited query can
				// resolve after a quick hall open/close has torn the bar down.
				if (!mounted) return;
				setUsers(users);
				}
			}

			// Debounced: a reconnect emits one user_presence per channel — coalesce
			// the burst into a single roster fetch (still near-instant vs the old 60s poll).
			let presenceDebounce;
			const onPresenceChanged = () => {
				clearTimeout(presenceDebounce);
				presenceDebounce = setTimeout(getLiveFreshUsers, 1000);
			};
			window.addEventListener('memberPresenceChanged', onPresenceChanged);

			const initialFetch = setTimeout(getLiveFreshUsers,100);

			return ()=>{
				mounted = false;
				clearTimeout(initialFetch);
				clearTimeout(presenceDebounce);
				window.removeEventListener('memberPresenceChanged', onPresenceChanged);
			}
		},[group.members])

  return (
    <div className={"StudyGroupSideBar noselect"}>
      <ReactTooltip
        id={tooltip_id}
        effect="solid"
        place="left"
        className={"SideBarToolTip"}
        backgroundColor={"#666"}
        arrowColor={"#666"}
      />
      <ul>
        {appController.states.studyGroup.activeGroup.myRole === "operator" ? (
          <li
            className={isActive("admin")}
            onClick={() => setPanel({ key: "admin" })}
            data-tip={label("tooltip_admin")}
            data-for={tooltip_id}
          >
            <img className="icon" src={admin} alt="" />
            {requests ? <span className="requestCount">{requests}</span> : null}
            <div className="label">{label("admin")}</div>
          </li>
        ) : null}
        <li
          className={isActive("chat") + " discussion"}
          onClick={() => setPanel({ key: "chat" })}
          data-tip={label("tooltip_discussion")}
          data-for={tooltip_id}
        >
          <>
            <div
              className={"userCircle discussion"}
              style={{
                backgroundImage: `url(${appController.states.studyGroup.activeGroup.coverUrl}`,
              }}
            />
          </>
          <img className="icon" src={discussion} alt="" />
          <div className="label">{label("discussion")}</div>
          <UnreadDMCount count={unread} />
        </li>
        {/*
          Progress is enabled: StudyGroupProgress renders real per-member
          completion data (render-safe, no fake data — see StudyGroupProgress.js).
          Notebook stays out of the sidebar: its panel still renders hardcoded
          placeholder content (a fixed "1 Nephi 4:3" heading + fake badges), so
          shipping it would show fabricated data. Re-add a notebook <li> here once
          StudyGroupNotebook derives real per-note references from the backend.
        */}
        <li
          className={isActive("progress")}
          onClick={() => setPanel({ key: "progress" })}
          data-tip={label("tooltip_progress")}
          data-for={tooltip_id}
        >
          <img className="icon" src={progress} alt="" />
          <div className="label">{label("progress")}</div>
        </li>
        {users.map((u) => (
          <UserSideBarItem
            key={u.userId}
            u={u}
            tooltip_id={tooltip_id}
            setPanel={setPanel}
            activePanel={activePanel}
          />
        ))}
      </ul>
    </div>
  )
}

export function StudyGroupMainPanel({ activePanel, setPanel }) {
  const appController = useAppController()
  if (activePanel?.key === "admin")
    return <StudyGroupAdmin />
  if (activePanel?.key === "progress")
    return <StudyGroupProgress />
  if (activePanel?.key === "message")
    return (
      <DirectMessages userId={activePanel?.val} />
    )
  if (activePanel?.key === "chat") {
    return (
      <StudyGroupChatPanel
        channel={appController.states.studyGroup.activeGroup}
        setPanel={setPanel}
      />
    )
  }

  return <div>{JSON.stringify({ activePanel })}</div>
}

export function StudyGroupChatPanel({ channel, setPanel }) {
  const appController = useAppController()
  const messenger = useMessenger()
  const params = useParams()
  const [chatLinkedContent, setChatLinkedContent] = useState({})
  const [loader, setLoader] = useState(false)
  const [parentMessage, setThreadMessage] = useState(false)
  const history = useHistory()

  useEffect(() => {
    if (channel.lastMessage?.parentMessageId && !params.messageId) {
      messenger
        .loadPreviousMessages({
          group: channel,
          id: channel.lastMessage?.parentMessageId,
          prevResultSize: 1,
        })
        .then((messages) => {
          setThreadMessage(messages.shift())
        })
    }
    window.clicky?.goal("study")
  }, [])

  useEffect(() => {
    if (!appController.states.parentMessage.message) {
      return
    }
    appController.states.parentMessage.message &&
      setThreadMessage(appController.states.parentMessage.message)
    return () => {
      appController.functions.setParentMessage(false)
      history.push("/home")
    }
  }, [appController.states.parentMessage.message])

  return (
    <div
      className={`StudyGroupChatPanel  ${
        appController.states.editor.isEditorOpen ? "maxi" : "mini"
      }`}
    >
      <div className={parentMessage ? "nexttothread" : "withoutthread"}>
        {loader && (
          <div className="PrevMessageLoader">
            <img src={loadingicon} alt="" /> {label("loading_previous_messages")}
          </div>
        )}

        {!loader && channel.customType === "DM" && (
          <div className={"dmTitle"}>
            <img src={dmicon} alt="" />{" "}
            {label("dms_with_x", [
              channel.members
                .filter(
                  (u) =>
                    u.userId !== messenger.sb?.currentUser?.userId,
                )
                .map((u) => u.nickname)
                .join(", "),
            ])}
          </div>
        )}
        <StudyGroupChat
          setThreadMessage={setThreadMessage}
          linkedContent={{ chatLinkedContent, setChatLinkedContent }}
          setPrevLoader={setLoader}
          parentMessage={parentMessage}
          channel={channel}
          setPanel={setPanel}
        />
        <StudyGroupChatInput channel={channel} />
      </div>
      {parentMessage && !isMobile() ? (
        <StudyGroupThread
          setThreadMessage={setThreadMessage}
          linkedContent={{ chatLinkedContent, setChatLinkedContent }}
          parentMessage={parentMessage}
          channel={channel}
          setPanel={setPanel}
        />
      ) : null}
    </div>
  )
}

function UserSideBarItem({
  u,
  tooltip_id,
  setPanel,
  activePanel,
}) {
  const appController = useAppController()
  let lastSeen = timeAgoString(0)
  let classes = ["userSideBarItem"]
  if (u.connectionStatus !== "online") classes.push("offline")
  if (activePanel?.key === "message" && activePanel?.val === u.userId)
    classes.push("active")

  if (appController.states.user.social?.user_id === u.userId) return null

  let summary = {}
  try {
    summary = JSON.parse(u?.metaData?.summary)
  } catch (e) {}
  let bookmark = {}
  try {
    bookmark = JSON.parse(u?.metaData?.bookmark)
  } catch (e) {}

  let userCircleClasses = getClassesFromUserObj(u, appController)
  let linkToItems = null
  if (bookmark.slug)
    linkToItems =
      userCircleClasses.includes("inGroup") ||
      userCircleClasses.includes("onSite") ? (
        <Link to={"/" + bookmark.slug}>
          <div className="statRow">
            <img src={crosshairs} alt="" />
            <div>{label("currently_studying")}</div>
          </div>
          <div className="statRow link">
            <div>
              {bookmark.slug ? (
                <span>
                  {bookmark.heading}—{bookmark.pagetitle}
                </span>
              ) : null}
            </div>
          </div>
        </Link>
      ) : (
        <Link to={"/" + bookmark.slug}>
          <div className="statRow">
            <img src={bookmarkicon} alt="" />
            <div>{label("last_studied")}</div>
            <div className="fromNow">
              {bookmark.latest ? moment.unix(bookmark.latest).fromNow() : null}
            </div>
          </div>
          <div className="statRow link">
            <div>
              {bookmark.slug ? (
                <>
                  <span className="heading">
                    {bookmark.heading}—{bookmark.pagetitle}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </Link>
      )
  const isBot = !!u?.metaData?.isBot
  if (isBot) return null
  return (
    <li
      onClick={() => setPanel({ key: "message", val: u.userId })}
      className={classes.join(" ")}
      data-tip={label("message_x", [u.nickname])}
      data-for={tooltip_id}
    >
      <StudyGroupUserCircle userObject={u} />
      <div className="userInfo">
        <div className={"nickname"}>{u.nickname}</div>
        <div className={"userLink"}>{linkToItems}</div>
      </div>
    </li>
  )
}
