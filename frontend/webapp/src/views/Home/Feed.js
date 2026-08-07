import React, { useState, useEffect, useRef } from "react";
import { useParams, useHistory, Link, useRouteMatch } from "react-router-dom";
import crypto from "crypto-browserify";
import ProgressBox from "../User/ProgressBox.js";
import { Card, CardHeader, CardBody, CardFooter, Button } from "reactstrap";


import { loadHomeFeed } from "src/models/dummyData/study";
import {
  FaxInFeed,
  ImageInFeed,
  SectionInFeed,
  TextInFeed,
  CommentaryInFeed,
} from "src/views/_Common/Study/StudyInFeed";

import "./StudyGroupFeed.css";
import "./Home.css";
import "./Home.m.css";

import faceload from "src/views/_Common/svg/loadbar.svg";
import {
  BlankParagraph,
  BlankWord,
  breakCache,
  timeAgoString,
  tokenImage,
} from "src/models/Utils";
import activityfeed from "src/views/_Common/svg/activityfeed.svg";
import { label, ParseMessage } from "src/models/Utils";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { analytics, GOALS } from "../../models/analytics/index.js";
import VisibilitySensor from "react-visibility-sensor";
import { prepareQuery } from "../_Common/Study/StudyChat.js";
import like from "../_Common/Study/svg/like.svg";
import comment from "../_Common/Study/svg/comment.svg";
import SweetAlert from "react-bootstrap-sweetalert";
import useModalA11y from "../_Common/AppModal/useModalA11y";
import Parser from "html-react-parser";

import soloIcon from "src/views/_Common/Study/svg/solo.svg";
import privateIcon from "src/views/_Common/Study/svg/private.svg";
import publicIcon from "src/views/_Common/Study/svg/public.svg";
import openIcon from "src/views/_Common/Study/svg/open.svg";
import ReactTooltip from "react-tooltip";
import trophy from "src/views/User/svg/trophy.svg";
import { GroupCallToAction, GroupLeaderBoard } from "./Community.js";
import { md5 } from "../../models/Utils.js";
import { useAppController } from "src/contexts/AppControllerContext";

export function HomeFeed({
  activeGroup,
  messageId,
  setActiveGroup,
}) {
  const appController = useAppController();
  const [homeItems, setHomeItems] = useState([]);
  const [homeGroups, setHomeGroups] = useState([]);
  const [loader, setLoader] = useState(null);
  const [linkedContent, setLinkedContent] = useState({});
  // Incremental reveal: build the DOM a page at a time instead of mounting all
  // ~200+ feed cards up-front. Each card still lazy-loads its own comments via
  // VisibilitySensor; this just caps how many cards exist at once.
  const FEED_PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);

  useEffect(() => {
    // Guard against setState after unmount / stale activeGroup change: an
    // async effect body can't return a cleanup, so run the work in an inner
    // fn and short-circuit every setState once `cancelled` flips.
    let cancelled = false;

    function OnInput() {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
    }

    const load = async () => {
      let token = appController.states.user.token;
      setLoader(null);
      let r = await BoMOnlineAPI(
        { homefeed: { token, channel: activeGroup, message: messageId } },
        { useCache: false },
      );
      if (cancelled) return;
      let items = r.homefeed[0]?.feed || [];
      let q = prepareQuery(items);

      let linkedContent = await BoMOnlineAPI(q);
      if (cancelled) return;
      setLinkedContent(linkedContent);
      setHomeItems(items);
      setHomeGroups(r.homefeed[0]?.groups || []);
      setVisibleCount(FEED_PAGE_SIZE);
      setLoader(null);

      const tx = document.getElementsByTagName("textarea");
      for (let i = 0; i < tx.length; i++) {
        tx[i].setAttribute(
          "style",
          "height:" + tx[i].scrollHeight + "px;overflow-y:hidden;",
        );
        tx[i].addEventListener("input", OnInput, false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [activeGroup]);

  if (loader) return loader;
  let bannerGroup = activeGroup
    ? homeGroups?.filter((g) => g.url === activeGroup).shift()
    : null;
  const hasMore = visibleCount < homeItems.length;
  const revealMore = () =>
    setVisibleCount((c) => Math.min(c + FEED_PAGE_SIZE, homeItems.length));
  let items = homeItems.slice(0, visibleCount).map((item, seq) => (
    <HomeFeedItem
      seq={seq}
      item={item}
      homeGroups={homeGroups}
      setActiveGroup={setActiveGroup}
      linkedContent={linkedContent}
      key={item.id}
    />
  ));
  return (
    <>
      <HomeFeedBanner
        bannerGroup={bannerGroup}
        setActiveGroup={setActiveGroup}
      />
      <ReactTooltip
        id="privacyTip"
        place="right"
        effect="solid"
        className="privacyTip"
        backgroundColor={"#FFF"}
        arrowColor={"#FFF"}
        html
      />
      <ReactTooltip
        id="likeTip"
        place="top"
        effect="solid"
        className="likeTip"
        backgroundColor={"#666"}
        arrowColor={"#666"}
        color={"#000"}
        html
      />
      {items}
      {hasMore && <FeedLoadMore key={visibleCount} onReveal={revealMore} />}
    </>
  );
}

// Reveals the next page when the sentinel scrolls near the viewport. Uses a
// native IntersectionObserver (with a generous rootMargin) so it works no
// matter which ancestor (.rightPanelScroll, window, etc.) actually scrolls —
// react-visibility-sensor misses custom scroll containers here.
function FeedLoadMore({ onReveal }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      // Fallback: no IO support → reveal immediately so content isn't stuck.
      onReveal();
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onReveal();
      },
      { rootMargin: "600px" },
    );
    io.observe(node);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className="feedLoadMoreSentinel" aria-hidden="true">
      {/* Inline spinner only — NOT <Loader />, whose .loadBar is position:absolute
          top:20vh (a page-level overlay). Inside this sentinel that collapsed the
          div to 0px and pinned the spinner floating over the feed the whole time
          hasMore was true. A plain inline <img> flows normally, gives the sentinel
          real height (a solid IntersectionObserver target), and scrolls away with
          the feed once the next page reveals. */}
      <img src={faceload} alt="" className="feedLoadMoreSpinner" />
    </div>
  );
}

function HomeFeedBanner({ bannerGroup, setActiveGroup }) {
  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  if (!bannerGroup) return null;
  return (
    <Card className="homeBannerCard">
      <CardBody className="homeBanner">
        <div className="homeBannerImg">
          <img src={bannerGroup.picture} alt={bannerGroup.name || ""} />
          <GroupCallToAction
            groupData={bannerGroup}
          />
        </div>
        <div className="homeBannerText">
          <h3>
            {bannerGroup.name}
            <Link to={"/home"} onClick={() => setActiveGroup(null)}>
              ×
            </Link>
          </h3>
          <div className="description">{bannerGroup.description}</div>
        </div>
      </CardBody>
      <CardBody>
        <GroupLeaderBoard groupData={bannerGroup} />
      </CardBody>
    </Card>
  );
}

function HomeFeedItem({
  seq,
  item,
  homeGroups,
  linkedContent,
  setActiveGroup,
}) {
  const appController = useAppController();
  const typeIcons = {
    public: publicIcon,
    private: privateIcon,
    solo: soloIcon,
    open: openIcon,
  };

  const myGroups =
    appController.states.studyGroup?.groupList.map((g) => g.url) || [];
  const [comments, fetchComments] = useState([]);
  const [fetching, setFetching] = useState(false);
  // Track mount so the post-await setState in loadCommentsFromAPI can't fire
  // after the feed item scrolls out / the feed reloads (unmounted-setState warn).
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  //load comments from api immediate if seq==1
  useEffect(() => {
    if (seq === 0) {
      loadCommentsFromAPI();
    }
  }, [seq]);

  const iAmInGroup = myGroups.includes(item.channel_url);

  const sbChannel = iAmInGroup
    ? appController.states.studyGroup?.groupList
        .filter((g) => g.url === item.channel_url)
        .shift()
    : null;

  let group =
    homeGroups?.filter((g) => g.url === item.channel_url).shift() || {};
  let timeAgo = timeAgoString(item.timestamp / 1000);

  let privacyIcon = typeIcons[group.privacy];

  let memberMap = {};
  for (let i in group.members) {
    let m = group.members[i];
    memberMap[m.user_id] = m;
  }
  
  const loadCommentsFromAPI = async () => {
    if(fetching) return;
    setFetching(true);
    let message = item.id;
    let channel = item.channel_url;
    let token = appController.states.user.token;
    let comments = await BoMOnlineAPI({ homethread: { token, channel, message } }, { useCache: false })
    if (!isMounted.current) return;
    fetchComments(comments.homethread);
    setFetching(false);
  }
  

  const handleVisibilityChange = async (visible) => {
    if (visible && !comments?.length && item.replycount) {
      loadCommentsFromAPI();
    }
  };

  // Live replies (backlog #12): the controller dispatches
  // addMessageToThread<parentId> for every socket-delivered thread reply, so
  // other users' comments appear in place instead of waiting for a
  // visibility-triggered refetch. Comments dedupes by id downstream, so the
  // sender's own optimistic copy never doubles. Ref mirror keeps the handler
  // reading current state without re-binding the listener every render.
  const liveReplyCtx = useRef({});
  liveReplyCtx.current = { comments, loadCommentsFromAPI, replycount: item.replycount };
  useEffect(() => {
    const eventName = "addMessageToThread" + item.id;
    const onLiveReply = (e) => {
      const msg = e.message;
      if (!msg || !isMounted.current) return;
      const ctx = liveReplyCtx.current;
      // Thread never loaded but has history: pull the whole thread (the new
      // reply is already persisted server-side) so older replies aren't
      // orphaned behind the live one.
      if (!ctx.comments?.length && ctx.replycount) return ctx.loadCommentsFromAPI();
      let progress = 0;
      try {
        const summary = msg._sender?.metaData?.summary;
        const parsed = typeof summary === "string" ? JSON.parse(summary) : summary;
        progress = parsed?.completed || 0;
      } catch (err) {}
      const shaped = {
        timestamp: msg.createdAt,
        msg: msg.message,
        id: msg.messageId,
        channel_url: msg.channelUrl,
        user: {
          picture: msg._sender?.plainProfileUrl,
          nickname: msg._sender?.nickname,
          user_id: msg._sender?.userId,
          progress,
          isBot: !!msg._sender?.metaData?.isBot,
        },
      };
      fetchComments((prev) => (Array.isArray(prev) ? [...prev, shaped] : [shaped]));
    };
    window.addEventListener(eventName, onLiveReply, false);
    return () => window.removeEventListener(eventName, onLiveReply, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);
  let finished = item.user.finished;
  const trophyImg = finished ? (
    <img className="trophy" src={trophy} alt={label("finished") || "Finished"} />
  ) : null;
  const statusBox = item.user.isBot ?
  <div className="progress bot">BOT</div> :
  <div className="progress">{item.user.progress}%</div>;
  return (
    <VisibilitySensor key={item.id} onChange={handleVisibilityChange}>
      <Card className="homeFeed" key={item.id}>
        <CardHeader className="homeFeedHeader group noselect" key={item.id}>
          <div className="topLine" key={item.id}>
            <span
              onClick={() => setActiveGroup(group.url)}
              data-tip={`${label(group.privacy + "_group")}`}
              data-class={`privacyTip_${group.privacy}`}
              data-for={"privacyTip"}
              data-arrow-color={""}
              className={"groupName " + group.privacy}
            >
              <img src={privacyIcon} alt={label(group.privacy + "_group") || ""} />{" "}
              {group.name}
            </span>
          </div>

          <div className="timestamp">
            <Link to={`/home/community/${group.url}/${item.id}`}>{timeAgo}</Link>
          </div>
        </CardHeader>
        <CardHeader className="homeFeedHeader noselect">
          <div className="imagebox">
            {trophyImg}
            <img
              src={item.user.picture}
              onError={breakCache}
              alt={item.user.nickname || ""}
            />
            {statusBox}
          </div>
          <h5>
            <div>
              {item.user.nickname}
              <span className="feedAction">
                {label("honorific", -1) + label("honorific_subject", -1) + " "}
                {label(determinAction(item))}
              </span>
            </div>
          </h5>

          <img
            className="groupAvatar"
            onClick={() => setActiveGroup(group.url)}
            src={group.picture}
            alt={group.name || group.url || ""}
          />
        </CardHeader>
        <CardBody className="homeFeedBody">
          {item.msg === "•" ? null : (
            <div className="itemMsg"><MessageMedia item={item} /> {ParseMessage(item.msg || "")}</div>
          )}
        
          <ContentInFeed
            item={item}
            linkedContent={linkedContent}
          />
        </CardBody>
        <Comments
					loadCommentsFromAPI={loadCommentsFromAPI}
          fetchComments={fetchComments}
          comments={comments}
          item={item}
          group={group}
          sbChannel={sbChannel}
          count={item.replycount}
          memberMap={memberMap}
        />
      </Card>
    </VisibilitySensor>
  );
}

function determinAction(item) {
  let noMsg = item.msg === "•";
  const key = item?.link?.key;

  if (key) return noMsg ? `highlighted_${key}` : `commented_${key}`;

  return "posted_comment";
}

function ContentInFeed({ item, linkedContent }) {
  if (!linkedContent || !item) return null;
  const link = item?.link;
  let map = {
    text: "textInFeed",
    section: "sectionInFeed",
    fax: "faxInFeed",
    com: "commentaryInFeed",
    img: "imageInFeed",
  };
  let key = map[link.key];
  let val = link.val;
  let content = linkedContent?.[key]?.[val] || {};

  switch (key) {
    case "textInFeed":
      return (
        <TextInFeed
          textData={content}
          highlights={item.highlights}
        />
      );
    case "sectionInFeed":
      return (
        <SectionInFeed
          sectionData={content}
          highlights={[]}
        />
      );
    case "commentaryInFeed":
      return (
        <CommentaryInFeed
          comData={content}
          highlights={item.highlights}
        />
      );
    case "imageInFeed":
      return <ImageInFeed imageData={content} />;
    case "faxInFeed":
      let pieces = val.split(".");
      let version = pieces.pop();
      val = pieces.shift();
      content = linkedContent?.textInFeed?.[val] || {};
      return (
        <FaxInFeed
          textData={content}
          item={item}
          version={version}
        />
      );
    default:
      return null;
  }
}

function LikeUI({ likes, memberMap }) {
  likes = likes || [];
  let likecutoff = 2;
  let likeObjs = likes.map((l) => memberMap[l]).filter((x) => !!x);
  let likecount = likes.length;
  let namedlikes = likeObjs.slice(0, likecutoff) || [];
  let otherlikes = likeObjs.slice(likecutoff) || [];
  let otherstring = otherlikes.length
    ? label("and_x_others", [otherlikes.length])
    : null;
  let likelabel =
    likecount === 1 ? label("like_this_singular") : label("like_this_plural");
  if (likes.length === 0)
    return (
      <>
        <img src={like} className="like" alt="" /> 0 {label("likes")}
      </>
    );

  let html = `<ul>${likeObjs
    .map(
      (i) =>
        `<li><img src='${i?.picture}' alt=''><span class='progress'>${i?.progress}%</span> ${i?.nickname}</li>`,
    )
    .join("")}</ul>`;

  return (
    <span data-tip={html} data-for={"likeTip"}>
      <img src={like} className="like" alt="" />
      <b>
        {namedlikes
          ?.map((u) => u?.nickname)
          .join(
            otherstring
              ? label("honorific", -1) + ", "
              : label("honorific", -1) + " " + label("and") + " ",
          ) +
          label("honorific", -1) +
          label("honorific_subject", -1) +
          " "}
      </b>{" "}
      {otherstring} {likelabel}
    </span>
  );
}


function MessageMedia({ item }) {

  return null;

  const [componendId] = useState(md5(item.id));
  const [parentElementWidth, setParentElementWidth] = useState(0);
  const [mediaSize, setMediaSize] = useState(null);

  const imageUrl = "https://ipxy.io/img/WVhKMGFXTnNaVWxrUFVNXlJFdyVkSEIyWjNZMkpuVl5iRDFvZEhSd2NeVV5OVE5CSlRJMU1rWWxNalVeUm5OamIyNTBaVzUwTFdOa1p6UXRNITVqWkc1KmJuTjBZV2ReWVcwdVkyOXRKVEkxTWtaMkpUSTFNa1owTlRFdU1qZzROUzAlTlNVXk5USkdOREU1TWprNU9ESTJYelk1T0RrJU5ETTRPVEUlTlRRME9EUmZOek0xTVRrek9UVTROVEU1TVRjMk1qVTVYMjR1YW5CbkpUSTFNMFp6ZEhBbE1qVXpSR1J6ZEMxcWNHZGZaVEUxSlRJMU1qWmZibU5mYUhRbE1qVXpSSE5qYjI1MFpXNTBMV05rWnpRdE0hNWpaRzUqYm5OMFlXZF5ZVzB1WTI5dEpUSTFNalpmYm1OZlkyRjBKVEkxTTBRJU1EQWxNalVeTmw5dVkxOXZhR01sTWpVelJGQmFVM2h3TlROWmFYTk5RVmd0ZW4qWFpuUWxNalVeTm1Wa2JTVV5OVE5FUVU5Uk1XTXdkMEpCUVVGQkpUSTFNalpqWTJJbE1qVXpSRGN0TlNVXk5USTJiMmdsTWpVelJEQXdYMEZtUVd0dE0wViFZbEJMWmpkRE1WWjFSWGx6T1clIVVFTjRRazR0VTJoTE9IQlpOVmR6V0VFdGJFNUtRMUVsTWpVXk5tOWxKVEkxTTBRMk5VRTBRVFkyUlNVXk5USTJYMjVqWDNOKlpDVV5OVE5FT0dJek5UUTI";

  const overlay = "instagram";
  const url = "https://www.instagram.com/p/C2DL1tpvgv6"



  const popUpImage = () => {
      // PopupCenter removed - could open in new tab instead
      window.open(url, "_blank");
  }

  const fitItem = () => {



  };

    useEffect(()=>{
      console.log("useEffect: setParentElementWidth");
      const parentElement = document.getElementById(componendId)?.parentElement;
      setParentElementWidth(parentElement?.offsetWidth);

    },[!!document.getElementById(componendId), window?.innerWidth]);

    useEffect(()=>{

      if(parentElementWidth < 300) setMediaSize("small");
      else if(parentElementWidth < 500) setMediaSize("medium");
      else setMediaSize("large");

    },[parentElementWidth]);

    if(!mediaSize) return null;

  return <div className="messageMedia" onClick={popUpImage}  id={componendId}>
    <img src={imageUrl} alt="" />
    {mediaSize}
    {parentElementWidth}
  </div>

}

function Comments({ comments, count, item, group, memberMap, sbChannel, fetchComments,fetching,loadCommentsFromAPI}) {

  const appController = useAppController();
  const [alertOn, setAlert] = useState(false);
  useModalA11y(alertOn, { onClose: () => setAlert(false), label: "Members only" });

  const [newMessages, setNewMessages] = useState([]);
  let myUserId = appController.states.user.user;

  const [itemState, setItem] = useState(item);
  const [likes, setLikes] = useState(item.likes || []);

  const toggleLike = () => {
    let tmp = [...likes];
    if (tmp?.includes(myUserId)) tmp.splice(tmp.indexOf(myUserId), 1);
    else tmp.unshift(myUserId);

    setLikes(tmp);
  };

  let itemId = item.id;

  let thread = [];
  if (comments === -1) {
    thread = (
      <div className="commentThreadItem">
        <div className="textbox">
          <div className="mesg">{label("loading_comments")}</div>
        </div>
      </div>
    );
  } else {
    comments = Array.isArray(comments) ? comments : [];
    comments = [
      ...comments.filter((m) => m && m.id !== itemId && !/^[\s•]+$/.test(m.msg)),
      ...newMessages.filter(Boolean),
    ];
    //dedupe comments based on id (skip any holes defensively)
    let seen = {};
    comments = comments.filter(function(item) {
      if (!item) return false;
      return seen.hasOwnProperty(item.id) ? false : (seen[item.id] = true);
    });
    thread = comments.map((comment) => (
      <Comment comment={comment} key={comment.id} />
    ));
  }

  //thead is zero but item.replycount is not zero put a button to load more
  if (!thread.length && item.replycount) {
    thread = <div className="commentThreadItem">
      <div className="buttonRow loadComments">
      <Button onClick={loadCommentsFromAPI}>{label(fetching ? "load" : "load_x_comments",[count])}</Button>
      </div>
    </div>
  }


  count = thread.length || item.replycount;

  let comlabel = (count === 1) ? "comment_count_singular" : "comment_count_plural";

  let countRow = <div className="countRow noselect">
    <div className="likeCount"><LikeUI item={itemState} likes={likes} memberMap={memberMap} /></div>
    <div className="commentCount"><img src={comment} className="commentimg" alt="" />{label(comlabel, [count || "..."])} </div>
  </div>;

  if (!likes.length && !count) countRow = null;

  const handleLike = () => {
    let messageId = item.id;
    const params = {};
    params.isInclusive = true;

    toggleLike();
    sbChannel.getMessagesByMessageId(messageId, params, function(
      messages,
      error,
    ) {
      messages.forEach((message) => {
        if (!likes?.includes(myUserId)) {
          sbChannel.addReaction(message, "like", async function(
            reactionEvent,
            error,
          ) {
            message.applyReactionEvent(reactionEvent);
          });
        } else {
          sbChannel.deleteReaction(message, "like", async function(
            reactionEvent,
            error,
          ) {
            message.applyReactionEvent(reactionEvent);
          });
        }
      });
    });
  };

  const handleComment = () => {
    let el = document.getElementById("feedItem" + itemId);
    el.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
    el.focus();
  };

  let buttonRow = (
    <div className={"buttonRow " + (!sbChannel ? "disabledrow" : "")}>
      <Button disabled={!sbChannel} onClick={handleLike}>
        <img src={like} className="like" alt="" />{" "}
        {label(likes.includes(myUserId) ? "unlike" : "like")}{" "}
      </Button>
      <Button disabled={!sbChannel} onClick={handleComment}>
        <img src={comment} className="commentimg" alt="" /> {label("comment")}
      </Button>
    </div>
  );
  //likes = null;
  const mycomment =
    !comments !== -1 ? (
      <MyComment
        setNewMessages={setNewMessages}
        sbChannel={sbChannel}
        group={group}
        itemId={itemId}
        trophy={trophy}
      />
    ) : null;

  return (
    <div className="study home" key={itemId}>
      {countRow}
      {buttonRow}
      {thread}
      {mycomment}
      <SweetAlert
        customClass={"sweet-alert-modal"}
        show={alertOn}
        title={"Members only"}
        onConfirm={() => setAlert(false)}
        //  onCancel={onCancel}
        showConfirm={true}
        showCancel={true}
        btnSize=""
        cancelBtnBsStyle="danger"
        confirmBtnText="Join"
        cancelBtnText="Cancel"
        confirmBtnCssClass="model-confirm-btn-css-class"
        cancelBtnCssClass="model-cancel-btn-css-class"
      >
        {"a"}
      </SweetAlert>
    </div>
  );
}

function Comment({ comment }) {
  const appController = useAppController();
  const match = useRouteMatch();
  const urlMatch = parseInt(match.params?.messageId || 0) || 0;
  if (!comment) return null;
  let finished = comment.user.finished;
  const isBot = comment.user.nickname === "StudyBuddy" || comment.user.isBot;
  const botBadge = isBot ? <span className="botBadge">BOT</span> : null;
  const trophyImg = finished ? (
    <img className="trophy" src={trophy} alt={label("finished") || "Finished"} />
  ) : null;
  let timeAgo = timeAgoString(comment.timestamp / 1000);
  return (
    <div
      className={
        "commentThreadItem " + (urlMatch === comment.id ? "selected" : "")
      }
      key={comment.id}
    >
      <div className="imagebox noselect">
        {trophyImg}
        <img
          src={comment.user.picture}
          onError={breakCache}
          alt={comment.user.nickname || ""}
        />
        {!isBot && (
          <div className="progress">{comment.user.progress || 0}%</div>
        )}
      </div>
      <div className="textbox">
        <div className="namerow noselect">
          {comment.user.nickname} {botBadge}{" "}
          <span>
            •{" "}
            <Link to={`/home/community/${comment.channel_url}/${comment.id}`}>
              {timeAgo}
            </Link>
          </span>
        </div>
        <div className="mesg">{ParseMessage(comment.msg,appController)}</div>
      </div>
    </div>
  );
}

function MyComment({
  group,
  itemId,
  setNewMessages,
  sbChannel,
  trophy,
}) {
  const appController = useAppController();
  let tokenImg = tokenImage();

  let img = appController.states.user.social?.profile_url || tokenImg;

  let joinlabel =
    group.privacy === "open" ? "join_group" : "apply_for_membership";
  let finished = appController.states.user.finished;
  let trophyComp = finished ? (
    <img className="trophy" src={trophy} alt={label("finished") || "Finished"} />
  ) : null;
  const myName = appController.states.user.social?.nickname || "";

  if (!sbChannel)
    return (
      <div className="commentThreadItem">
        <div className="imagebox noselect">
          {trophyComp}
          <img src={img} onError={breakCache} alt={myName} />
          <div className="progress">
            {appController.states.user.progress.completed || 0}%
          </div>
        </div>
        <div className="textbox notmember">
          <textarea
            className="form-control textarea join_to_comment"
            disabled
            placeholder={label("join_to_comment")}
          />
          <GroupCallToAction
            groupData={group}
            joinlabel={label(joinlabel)}
          />
        </div>
      </div>
    );

  const sendMessage = (textbox, parentMessageId) => {
    let text = textbox.value;
    textbox.classList.add("sending");
    textbox.disabled = true;
    let channel = sbChannel;
    const params = {};
    params.message = text;
    params.parentMessageId = parentMessageId;
    try {
      channel.sendUserMessage(params).onSucceeded((message) => {
        analytics.goal(GOALS.COMMENT);
        textbox.value = "";
        textbox.classList.remove("sending");
        textbox.disabled = false;
        textbox.focus();

        let summary = { completed: 0 };
        try {
          summary = JSON.stringify(message.sender.metaData.summary);
        } catch (e) {}

        setNewMessages([
          {
            timestamp: Math.round(message.createdAt),
            msg: message.message,
            id: message.messageId,
            channel_url: channel.url,
            user: {
              picture: message.sender.plainProfileUrl,
              nickname: message.sender.nickname,
              user_id: message.sender.userId,
              progress: summary?.completed || 0,
            },
          },
        ]);
      });
    } catch (error) {
      console.log({ error });
      return false;
    }
    channel.endTyping();
  };

  return (
    <div className="commentThreadItem">
      <div className="imagebox noselect">
        <img src={img} onError={breakCache} alt={myName} />
        <div className="progress">
          {appController.states.user.progress.completed || 0}%
        </div>
      </div>
      <div className="textbox">
        <textarea
          id={"feedItem" + itemId}
          className="form-control textarea"
          placeholder={label("say_something")}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              sendMessage(e.target, itemId);
              e.preventDefault();
            }
          }}
        />
      </div>
    </div>
  );
}
