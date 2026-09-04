import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { useParams, useHistory, useRouteMatch, Link } from "react-router-dom";
import moment from "moment";
import ProgressBox from "../User/ProgressBox.js";
import SignIn from "../User/SignIn.js";
import "../User/SignIn.css";
import trophy from "../User/svg/trophy.svg";

import { loadHomeFeed } from "src/models/dummyData/study";
import { ImageInFeed } from "src/views/_Common/Study/StudyInFeed";
import { HomeFeed } from "./Feed.js";
import { useAppController } from "src/contexts/AppControllerContext";
import { useMessenger } from "src/contexts/MessengerContext";

import ReactTooltip from "react-tooltip";
import { tooltipTheme, isDarkTheme } from "src/utils/themeColors";
import "./StudyGroupFeed.css";
import "./Home.css";
import "./Home.m.css";
import "../User/ProgressBox.css";
import blue from "../User/svg/blue.svg";
import green from "../User/svg/green.svg";
import yellow from "../User/svg/yellow.svg";
import blank from "../User/svg/blank.svg";
import empty from "../User/svg/empty.svg";

import { label, breakCache } from "src/models/Utils";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import {
  TabContent,
  TabPane,
  Nav,
  NavItem,
  NavLink,
  Card,
  Button,
  CardTitle,
  CardText,
  Row,
  Col,
  CardHeader,
  CardBody,
} from "reactstrap";
import { toast } from "react-toastify";
import Loader, { Spinner } from "../_Common/Loader/index.js";
import { md5 } from "../../models/MessengerController.js";
import { timeAgoString } from "../../models/Utils.js";

// True when the matched URL is a community route, whether nested under the
// unified Home (/home/community/...) or the legacy top-level (/community/...).
export const isCommunityPath = (url) => /(^|\/)(community|feed)(\/|$)/.test(url || "");

// Self-hosted (inline data URI) placeholder for a group cover that fails to load
// at runtime — never point onError at an external image host (policy: no
// external image domains). Swaps once to avoid an error loop.
export const GROUP_IMG_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#3a3f4b"/><text x="50%" y="56%" text-anchor="middle" font-family="Georgia,serif" font-size="120" fill="#c9a24b">✦</text></svg>',
  );
export const groupImgFallback = (e) => {
  if (e?.target && e.target.src !== GROUP_IMG_FALLBACK) e.target.src = GROUP_IMG_FALLBACK;
};

export const communityHref = (channel, message) => {
  const beta = typeof window !== "undefined" && /^\/home\/feed(?:\/|$)/.test(window.location.pathname);
  return `${beta ? "/home/feed" : "/home/community"}${channel ? `/${channel}` : ""}${message ? `/${message}` : ""}`;
};

const privateStyle = (nickname) => {
  if (!/[█]/gu.test(nickname)) return {};
  nickname = nickname.replace(/[^A-z0-9]/g, "");

  let decHash = (md5(md5(nickname)) + "6").replace(/[^0123456789]/g, "");
  let first = parseInt(decHash.slice(0, 1));
  let last = parseInt(decHash.slice(-1));
  const deg = Math.round((first * 360) / 10 + last * 50);
  return {
    backgroundColor: `hsl(${deg}, 30%, 30%)`,
  };
  return {
    filter: `sepia(1) hue-rotate(${deg}deg)`,
  };
};

function Community({ unlistedBeta = false }) {
  const match = useRouteMatch();
  const params = match.params;
  const isCommunity = isCommunityPath(match.url);

  let urlFeedGroup = isCommunity ? params.channelId : null;
  let urlFeedMessage = isCommunity ? params.messageId : null;

  const [activeGroup, setActiveGroup] = useState(urlFeedGroup);
  const [activeMessage, setActiveMessage] = useState(urlFeedMessage);

  useEffect(() => {
    let urlFeedGroup = isCommunity ? params.channelId : null;
    let urlFeedMessage = isCommunity ? params.messageId : null;
    setActiveGroup(urlFeedGroup);
    setActiveMessage(urlFeedMessage);
  }, [params]);

  useEffect(() => (document.title = label("community")), []);

  return false ? null : (
    <div className={`home container${unlistedBeta ? " home-feed" : ""}`}>
      <div className="leftPanelScroll noselect">
        <GroupBrowser activeGroup={activeGroup} setActiveGroup={setActiveGroup} />
      </div>
      <div className="rightPanelScroll">
        <HomeFeed
          activeGroup={activeGroup}
          messageId={activeMessage}
          setActiveGroup={setActiveGroup}
          setActiveMessage={setActiveMessage}
          unlistedBeta={unlistedBeta}
        />
      </div>
    </div>
  );
}

// The Community left panel does NOT scroll — it right-sizes its list lengths to
// the available height. Rather than reset-to-max and re-shrink (which flickered
// rows out during a window drag), it nudges ONE list up or down per animation
// frame toward a stable "just fits" band. Groups flex first (they have a
// 'see more'); the leaderboard is trimmed last and refills first, so its rows
// don't blink out on resize.
const FIT_MAX = { leaders: 10, groups: 12, finishers: 12 };
const FIT_MIN = { leaders: 3, groups: 1, finishers: 4 };
// Stable band: shrink when the panel overflows by >GROW_SLACK-ish; grow only
// when there's comfortably more than one row of slack. The band is wider than
// the tallest row so a grow/shrink lands inside it (no oscillation).
const OVERFLOW_PX = 4;
const GROW_SLACK_PX = 100;

function useFitCounts(cardRef, enabled = true) {
  const [caps, setCaps] = useState(FIT_MAX);
  const rafRef = useRef(0);

  const step = useCallback(() => {
    if (!enabled) return; // "see more" mode: don't compact — the panel scrolls
    const panel = cardRef.current?.parentElement; // the fixed-height .leftPanelScroll
    if (!panel) return;
    const over = panel.scrollHeight - panel.clientHeight;
    setCaps((c) => {
      if (over > OVERFLOW_PX) {
        if (c.groups > FIT_MIN.groups) return { ...c, groups: c.groups - 1 };
        if (c.finishers > FIT_MIN.finishers) return { ...c, finishers: c.finishers - 1 };
        if (c.leaders > FIT_MIN.leaders) return { ...c, leaders: c.leaders - 1 };
      } else if (over < -GROW_SLACK_PX) {
        if (c.leaders < FIT_MAX.leaders) return { ...c, leaders: c.leaders + 1 };
        if (c.finishers < FIT_MAX.finishers) return { ...c, finishers: c.finishers + 1 };
        if (c.groups < FIT_MAX.groups) return { ...c, groups: c.groups + 1 };
      }
      return c; // in-band → stable (same ref → no re-render)
    });
  }, [cardRef, enabled]);

  const schedule = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      step();
    });
  }, [step]);

  // Re-nudge after every render (coalesced), and whenever the panel resizes.
  useLayoutEffect(() => {
    schedule();
  });
  useLayoutEffect(() => {
    const panel = cardRef.current?.parentElement;
    if (!panel || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(schedule);
    ro.observe(panel);
    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cardRef, schedule]);

  return enabled ? caps : FIT_MAX;
}

function GroupBrowser({ activeGroup, setActiveGroup }) {
  const appController = useAppController();
  const cardRef = useRef(null);
  const [groupListData, setData] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [finishers, setFinishers] = useState([]);
  const [queryFilter, setQueryFilter] = useState({
    token: appController.states.user.token,
  });
  const [seeMoreLabel, setSeeMoreLabel] = useState(label("see_more"));
  const isFiltered = !!queryFilter.grouping;

  useEffect(() => {
    // Guard against setState after unmount: GroupBrowser can be torn down (route
    // change to /study) before the homegroups/leaderboard request resolves.
    let cancelled = false;
    setData([]);
    BoMOnlineAPI(
      {
        homegroups: queryFilter,
        leaderboard: queryFilter,
      },
      { useCache: false },
    ).then((r) => {
      if (cancelled) return;
      setData(r.homegroups);
      setLeaders(r.leaderboard[0].currentProgress);
      setFinishers(r.leaderboard[0].recentFinishers || []);
      setSeeMoreLabel(label("see_more"));
    });
    return () => {
      cancelled = true;
    };
  }, [appController.states.user.user, queryFilter?.grouping]);

  let groupcount = groupListData
    ?.map((i) => i?.grouping)
    .filter((v, i, a) => a.indexOf(v) === i).length;

  const caps = useFitCounts(cardRef, !isFiltered);
  // "See more" (filtered) mode: show EVERY fetched group and let the panel scroll
  // (.leftPanelScroll is overflow-y:auto). The height-fit cap only compacts the
  // default view; applying it in filtered mode is what made "see more" do nothing.
  const shownGroups = isFiltered ? groupListData : groupListData.slice(0, caps.groups);

  return (
    <Card className="Community" innerRef={cardRef}>
      {isFiltered ? (
        <CardHeader>
          <h3>
            {label(queryFilter?.grouping)}
            <span
              onClick={() =>
                setQueryFilter({ token: appController.states.user.token })
              }
            >
              ×
            </span>
          </h3>
        </CardHeader>
      ) : null}
      <ReactTooltip
        id="button-tip"
        place="left"
        effect="solid"
        backgroundColor={tooltipTheme().backgroundColor}
        arrowColor={tooltipTheme().backgroundColor}
        textColor={tooltipTheme().textColor}
      />
      <ReactTooltip
        id="card-tip"
        place="right"
        effect="solid"
        className="card-tip"
        backgroundColor={isDarkTheme() ? "#444444" : "#EEEEEE"}
        arrowColor={isDarkTheme() ? "#444444" : "#666666"}
        html
      />
      <CardBody>
        {!groupListData.length || !leaders.length ? (
          <Spinner />
        ) : (
          <>
            <h3>{label("recent_finishers")}</h3>
            <RecentFinishers finishers={finishers.slice(0, caps.finishers)} />
            <h3>{label("leader_board")}</h3>
            <LeaderBoard leaders={leaders.slice(0, caps.leaders)} />
            {shownGroups.map((item, i) => {
              if (!item) return null;
              const grouping = item.grouping;
              const prev = shownGroups[i - 1] || null;
              const next = shownGroups[i + 1] || null;
              return (
                <React.Fragment key={i}>
                  {grouping !== prev?.grouping && groupcount > 1 ? (
                    <h3>{label(item.grouping)}</h3>
                  ) : null}
                  <GroupCard
                    groupData={item}
                    activeGroup={activeGroup}
                    setActiveGroup={setActiveGroup}
                  />
                  {grouping !== next?.grouping && !queryFilter.grouping ? (
                    <div
                      className="seeMore"
                      onClick={() => {
                        setSeeMoreLabel(label("loading"));
                        // Immutable update — mutating + returning the same object
                        // ref makes React bail out of the state change (the old
                        // `q.grouping = …; return q` only re-rendered by luck via
                        // the sibling setSeeMoreLabel).
                        setQueryFilter((q) => ({ ...q, grouping }));
                      }}
                    >
                      {seeMoreLabel}
                    </div>
                  ) : null}
                </React.Fragment>
              );
            })}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function RecentFinishers({ finishers }) {
  const titleFormatter = (phrase, data) => `<b>${phrase}: </b>${data}</br>`;
  const history = useHistory();
  return (
    <div className="leaderboard">
      <ReactTooltip id="leaderBoardItem-tip" place="bottom" effect="solid" />
      {finishers.slice(0, 5).map((m, i) => (
        <div
          className="leaderBoardItem"
          key={i}
          data-for="leaderBoardItem-tip"
          onClick={() => history.push(`/${m.bookmark}`)}
          data-tip={
            titleFormatter(label("last_seen").replace(/:\s*$/, ""), timeAgoString(m.lastseen)) +
            titleFormatter(label("last_studied"), m.laststudied)
          }
          data-html={true}
        >
          <div className="rank">{i + 1}</div>
          <div className="img-container">
            <img
              src={m.picture}
              alt={m.nickname}
              onError={breakCache}
              style={privateStyle(m.nickname)}
            />
            <span className="trophies">
              {m.finished?.map((i) => (
                <img src={trophy} key={i} alt="" />
              ))}
            </span>
          </div>
          <div className="namenum" style={{ marginTop: "1ex" }}>
            <div className="nickname">{m.nickname}</div>

            <div className="lastseen">
              <span>{label("last_studied")}</span>{" "}
              {(() => {
                const d = Math.max(...m.finished);
                const dateYYMMDD = moment
                  .unix(d)
                  .format(label("history_date_format_full"));
                return dateYYMMDD;
              })()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LeaderBoard({ leaders }) {
  /*

          user_id
          nickname
          picture
          progress
          finished
          lastseen
          laststudied
          bookmark*/
  const history = useHistory();
  const titleFormatter = (phrase, data) => `<b>${phrase}: </b>${data}</br>`;
  return (
    <div className="leaderboard">
      <ReactTooltip id="leaderBoardItem-tip" place="bottom" effect="solid" />
      {leaders.map((m, i) => (
        <div
          className="leaderBoardItem"
          key={i}
          onClick={() => history.push(`/${m.bookmark}`)}
          data-for="leaderBoardItem-tip"
          data-tip={
            titleFormatter(label("last_seen").replace(/:\s*$/, ""), timeAgoString(m.lastseen)) +
            titleFormatter(label("last_studied"), m.laststudied)
          }
          data-html={true}
        >
          <div className="rank">{i + 1}</div>
          <div className="img-container">
            <img
              style={privateStyle(m.nickname)}
              src={m.picture}
              alt={m.nickname}
              onError={breakCache}
            />
            <span className="trophies">
              {m.finished?.map((i) => (
                <img src={trophy} key={i} alt="" />
              ))}
            </span>
          </div>
          <div className="namenum">
            <div className="nickname">{m.nickname}</div>
            <div className="progress">
              <div className="progressbar" style={{ width: `${m.progress}%` }}>
                {" "}
              </div>
              <span>{m.progress}%</span>
            </div>

            {false && (
              <div className="lastseen">
                <span>{label("last_studied")}</span>{" "}
                {(() => {
                  const d = new Date(m.lastseen);
                  const daysAgo = Math.floor(
                    (new Date() - d * 1000) / (1000 * 60 * 60 * 24),
                  );
                  if (daysAgo <= 1) return label("today");
                  if (daysAgo <= 2) return label("yesterday");
                  return `${daysAgo} ${label("days_ago")}`;
                })()}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupCard({ groupData, activeGroup, setActiveGroup }) {
  groupData.members = (groupData.members || []).filter(
    (m) => m.nickname !== "StudyBuddy",
  ); //TODO get metadata variables

  const [visibleMembers] = useState(
    groupData.members.sort(() => (Math.random() > 0.5 ? 1 : -1)).slice(0, 4),
  );

  useEffect(() => {
    ReactTooltip.rebuild();
  });

  let activeClass =
    activeGroup === groupData.url ? "active" : activeGroup ? "inactive" : "";

  let cardTipHtml = groupToolTipHtml(groupData);

  return (
    <div
      className={`groupCard ${activeClass}`}
      data-tip={cardTipHtml}
      data-for={"card-tip"}
    >
      <Link to={communityHref(groupData.url)}>
        <div className="groupContent" onClick={() => ReactTooltip.hide()}>
          <div className="groupImage">
            <img src={groupData.picture} alt={groupData.name || ""} onError={groupImgFallback} />
          </div>
          <div className="groupText">
            <div className="groupTitle">{groupData.name}</div>
            {/* latest is absent for groups with no messages yet (the legacy
                response filter strips null keys entirely). */}
            {groupData.latest?.user ? (
              <div className="groupMessage">
                <div className="groupMessageAvatar">
                  <img src={groupData.latest.user.picture} onError={breakCache} alt={groupData.latest.user.nickname || ""} />
                </div>
                <div className="groupMessageContent">
                  {" "}
                  {groupData.latest.msg
                    ?.replace(/<[^>]*>/gi, "")
                    ?.replace(/^•$/, label("highlight_msg"))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="groupMembership">
            {groupData.members.length > 4 ? (
              <div className="groupMembershipCount">
                {groupData.members.length}
              </div>
            ) : null}
            <div className="groupMembers">
              {visibleMembers?.map((m, i) => (
                <div key={i}>
                  <img src={m.picture} onError={breakCache} alt={m.nickname || ""} />
                </div>
              ))}
            </div>
            <GroupCallToAction
              groupData={groupData}
            />
          </div>
        </div>
      </Link>
    </div>
  );
}

export function GroupCallToAction({ groupData, joinlabel }) {
  const appController = useAppController();
  const messenger = useMessenger();
  const myId = appController.states.user.user;
  const list = appController.states.studyGroup.groupList.map((c) => c.url);
  const amMember = list.includes(groupData.url);
  const [amRequester, setamRequester] = useState(
    groupData.requests?.includes(myId) || false,
  );
  const { privacy } = groupData;
  const actions = {
    private: {
      label: "study",
      tooltip: "open_studyhall",
    },
    public: {
      label: "request",
      tooltip: "request_admission",
    },
    open: {
      label: "join",
      tooltip: "join_instantly",
    },
  };
  const getLabelString = () =>
    amMember
      ? label(actions["private"]?.label)
      : amRequester
      ? label("applied")
      : joinlabel || label(actions[privacy]?.label) || "";
  const [button_label, setLabel] = useState(getLabelString());
  let button_tooltip = amMember
    ? label(actions["private"]?.tooltip)
    : amRequester
    ? label("application_recieved")
    : label(actions[privacy]?.tooltip) || "";

  useEffect(() => setLabel(getLabelString()), [
    appController.states.studyGroup.groupList,
  ]);

  if (!myId)
    return (
      <Link to={"/home/user/signin"}>
        <div
          className={"groupCTA"}
          data-tip={label("sign_in")}
          data-for={"button-tip"}
        >
          <Button>{label("sign_in")}</Button>
        </div>
      </Link>
    );

  // Signed-in outsiders may comment but may not join fixed-membership groups.
  if (groupData.membership_policy === "fixed" && !amMember) return null;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (amMember) {
      const group = appController.states.studyGroup.groupList.find(
        (g) => g.url === groupData.url,
      );
      appController.functions.setActiveStudyGroup(group);
      appController.functions.setStudyMode(true);
      appController.functions.openDrawer(true);
    } else if (privacy === "public") {
      // Request Membership
      if (amRequester) {
        setLabel(label("withdrawing"));
        withdrawRequest(groupData.url, appController.states.user.token).then(
          () => {
            setLabel(label("request"));
            setamRequester(false);
          },
        );
      } else {
        setLabel(label("applying"));
        setamRequester(true);
        requestToJoinGroup(groupData.url, appController.states.user.token).then(
          () => {
            setLabel(label("applied"));
          },
        );
      }
    } else if (privacy === "open") {
      // Auto-grant Membership
      setLabel(label("joining"));
      joinOpenGroup(groupData.url, appController.states.user.token).then(
        (success) => {
          if (success) setLabel(label("joined"));
        },
      );
    }
  };

  const joinOpenGroup = async (url, userToken) => {
    let results = await BoMOnlineAPI({
      joinOpenGroup: { url: url, userToken },
    });

    if (results?.joinOpenGroup?.isSuccess) {
      let channel_url = results.joinOpenGroup.channel;
      try {
        const groupChannel = await messenger.sb.groupChannel.getChannel(
          channel_url,
        );
        appController.functions.setActiveStudyGroup(groupChannel);
        appController.functions.setStudyMode(true);
        appController.functions.openDrawer(true);
        messenger
          .getStudyGroups()
          .then((list) => appController.functions.setStudyGroups(list));
        //TODO: Refresh Home
        return true;
      } catch (error) {
        // Handle error.
        console.log({ error });
        toast.warn(label("join_failed"));
        return false;
      }
    } else {
      //fail
      console.log({ results, url, userToken });
      toast.warn(label("join_failed"));
      return false;
    }
  };
  const requestToJoinGroup = async (url, userToken) => {
    let results = await BoMOnlineAPI({
      requestToJoinGroup: { url: url, userToken },
    });
    if (results?.requestToJoinGroup?.isSuccess) {
      toast.info(label("application_recieved"));
    } else {
      //fail
      console.log({ results, url, userToken });
      toast.warn(label("join_failed"));
    }
  };

  const withdrawRequest = async (url, userToken) => {
    let results = await BoMOnlineAPI({
      withdrawRequest: { url: url, userToken },
    });
    if (results?.withdrawRequest?.isSuccess) {
      toast.info(label("application_withdrawn"));
    } else {
      //fail
      console.log({ results, url, userToken });
      toast.warn(label("withdraw_failed"));
    }
  };
  return (
    <div
      className={amRequester ? "groupCTA applied" : "groupCTA"}
      data-tip={button_tooltip}
      data-for={"button-tip"}
    >
      <Button onClick={handleClick}>{button_label}</Button>
    </div>
  );
}

export function groupToolTipHtml(groupData) {
  groupData.members = (groupData.members || []).filter(
    (m) => m.nickname !== "StudyBuddy",
  ); //TODO get metadata variables

  const sortedMembers = groupData.members.sort(
    (a, b) => b.progress - a.progress,
  );

  return `<div class='cardTip'>
  <div>
    <div class='groupimg'>
      <img src=${groupData.picture} alt='' />
    </div>
    <div class='titledesc'>
      <h4>${groupData.name}</h4>
      <p>${groupData.description || ""}</p>
    </div>
  </div>
  <ul class="groupMembers">
    ${sortedMembers
      .map(
        (m, i) => ` <li key=${i}>
      <img src=${m.picture} alt='' />
      <div class='tip-progress'>
        <div>${m.progress}%</div>
      </div>
      <div class='toolTipNickname'>${m.nickname}</div>
    </li>`,
      )
      .join("")}</ul>
</div>`;
}

export function GroupLeaderBoard({ groupData }) {
  groupData.members = (groupData.members || []).filter(
    (m) => m.nickname !== "StudyBuddy",
  ); //TODO get metadata variables
  const sortedMembers = groupData.members.sort(
    (a, b) => b.progress - a.progress,
  );
  return (
    <div className="GroupLeaderBoard">
      {sortedMembers.map((m, i) => (
        <div key={i}>
          <div className="leaderBoardItem">
            <div className="rank">{i + 1}</div>
            <div className="img-container">
              <img
                style={privateStyle(m.nickname)}
                src={m.picture}
                alt={m.nickname}
                onError={breakCache}
              />
              <span className="trophies">
                {m.finished?.map((i) => (
                  <img src={trophy} key={i} alt="" />
                ))}
              </span>
            </div>
            <div className="namenum">
              <div className="nickname">{m.nickname}</div>
              {!m.isBot && <div className="progress">
                <div
                  className="progressbar"
                  style={{ width: `${m.progress}%` }}
                >
                  {" "}
                </div>
                <span>{m.progress}%</span>
              </div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Community;
