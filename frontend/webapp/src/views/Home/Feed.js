import React, { useState, useEffect } from "react";
import { useParams, useHistory, Link, useRouteMatch } from "react-router-dom";
import crypto from "crypto-browserify";
import ProgressBox from "../User/ProgressBox.js";
import { Card, CardHeader, CardBody, CardFooter, Button } from "reactstrap";

import { loadHomeFeed } from "src/models/dummyData/study";
import { FaxInFeed, ImageInFeed, SectionInFeed, TextInFeed, CommentaryInFeed } from "src/views/_Common/Study/StudyInFeed";

import "./StudyGroupFeed.css";
import "./Home.css";
import "./Home.m.css";

import faceload from "src/views/_Common/svg/loadbar.svg";
import { BlankParagraph, BlankWord, breakCache, timeAgoString, tokenImage } from "src/models/Utils";
import activityfeed from "src/views/_Common/svg/activityfeed.svg";
import { label, ParseMessage } from "src/models/Utils";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import VisibilitySensor from "react-visibility-sensor";
import Loader from "../_Common/Loader/index.js";
import { prepareQuery } from "../_Common/Study/StudyChat.js";
import like from "../_Common/Study/svg/like.svg";
import comment from "../_Common/Study/svg/comment.svg";
import SweetAlert from "react-bootstrap-sweetalert";
import Parser from "html-react-parser";


import soloIcon from "src/views/_Common/Study/svg/solo.svg";
import privateIcon from "src/views/_Common/Study/svg/private.svg";
import publicIcon from "src/views/_Common/Study/svg/public.svg";
import openIcon from "src/views/_Common/Study/svg/open.svg";
import ReactTooltip from "react-tooltip";
import trophy from "src/views/User/svg/trophy.svg";
import { GroupCallToAction, GroupLeaderBoard } from "./Home.js";


export function HomeFeed({ appController, activeGroup, messageId, setActiveGroup }) {


  const [homeItems, setHomeItems] = useState([]);
  const [homeGroups, setHomeGroups] = useState([]);
  const [loader, setLoader] = useState(null);
  const [linkedContent, setLinkedContent] = useState({});



  useEffect(async () => {
    let token = appController.states.user.token;
    setLoader(<Loader />);
    let r = await BoMOnlineAPI({ homefeed: { token, channel: activeGroup, message: messageId } }, { useCache: false });

    let items = r.homefeed[0]?.feed || [];
    let q = prepareQuery(items);
    let linkedContent = await BoMOnlineAPI(q);
    setLinkedContent(linkedContent);
    setHomeItems(items);
    setHomeGroups(r.homefeed[0]?.groups || []);
    setLoader(null);


    const tx = document.getElementsByTagName("textarea");
    for (let i = 0; i < tx.length; i++) {
      tx[i].setAttribute("style", "height:" + (tx[i].scrollHeight) + "px;overflow-y:hidden;");
      tx[i].addEventListener("input", OnInput, false);
    }

    function OnInput() {
      this.style.height = "auto";
      this.style.height = (this.scrollHeight) + "px";
    }



  }, [activeGroup]);


  if (loader) return loader;
  let bannerGroup = (activeGroup) ? homeGroups?.filter(g => g.url === activeGroup).shift() : null;
  let items = homeItems.map(item => <HomeFeedItem appController={appController} item={item} homeGroups={homeGroups} setActiveGroup={setActiveGroup} linkedContent={linkedContent}  key={item.id} />);
  return <>
    <HomeFeedBanner appController={appController} bannerGroup={bannerGroup} setActiveGroup={setActiveGroup} />
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
  </>

}

function HomeFeedBanner({ appController, bannerGroup, setActiveGroup }) {


  useEffect(() => {
    ReactTooltip.rebuild()
  }, [])

  if (!bannerGroup) return null;
  return <Card><CardBody className="homeBanner">
    <div className="homeBannerImg">
      <img src={bannerGroup.picture} />
      <GroupCallToAction appController={appController} groupData={bannerGroup} />
    </div>
    <div className="homeBannerText">
      <h3>{bannerGroup.name}<Link to={"/home"} onClick={() => setActiveGroup(null)}>×</Link></h3>
      <div className="description">{bannerGroup.description}</div>
    </div>
  </CardBody>
    <CardBody>
      <GroupLeaderBoard groupData={bannerGroup} />
    </CardBody>

  </Card>
}

function HomeFeedItem({ appController, item, homeGroups, linkedContent, setActiveGroup }) {



  const typeIcons = {
    public: publicIcon,
    private: privateIcon,
    solo: soloIcon,
    open: openIcon,
  };

  const myGroups = appController.states.studyGroup?.groupList.map(g => g.url) || [];
  const [comments, fetchComments] = useState([]);

  const iAmInGroup = myGroups.includes(item.channel_url);

  const sbChannel = (iAmInGroup) ? appController.states.studyGroup?.groupList.filter(g => g.url === item.channel_url).shift() : null;



  let group = homeGroups?.filter(g => g.url === item.channel_url).shift() || {};
  let timeAgo = timeAgoString(item.timestamp / 1000);

  let privacyIcon = typeIcons[group.privacy];

  let memberMap = {};
  for (let i in group.members) {
    let m = group.members[i];
    memberMap[m.user_id] = m;
  }

  const handleVisibilityChange = async (visible) => {
    if (visible && !comments.length && item.replycount) {
      fetchComments(-1);
      let message = item.id;
      let channel = item.channel_url;
      let token = appController.states.user.token;
      let comments = await BoMOnlineAPI({ homethread: { token, channel, message } }, { useCache: false })
      fetchComments(comments.homethread);
    }
  }
  let finished = item.user.finished;
  const trophyImg = (finished) ? <img className="trophy" src={trophy} /> : null;
  return (
    <VisibilitySensor key={item.id} onChange={handleVisibilityChange}><Card className="homeFeed" key={item.id}>
      <CardHeader className="homeFeedHeader group noselect" key={item.id}>
        <div className="topLine" key={item.id}>
          <span
            onClick={() => setActiveGroup(group.url)}
            data-tip={`${label(group.privacy + "_group")}`}
            data-class={`privacyTip_${group.privacy}`}
            data-for={"privacyTip"}
            data-arrow-color={""}
            className={"groupName " + group.privacy}>
            <img src={privacyIcon} /> {group.name}</span>
        </div>

        <div className="timestamp"><Link to={`/home/${group.url}/${item.id}`}>{timeAgo}</Link></div>
      </CardHeader>
      <CardHeader className="homeFeedHeader noselect">
        <div className="imagebox">{trophyImg}<img src={item.user.picture} onError={breakCache} /><div className="progress">{item.user.progress}%</div></div>
        <h5>
          <div>
            {item.user.nickname}<span className="feedAction">{label("honorific", -1) + label("honorific_subject", -1) + " "}{label(determinAction(item))}</span>
          </div>
        </h5>

        <img
          className="groupAvatar"
          onClick={() => setActiveGroup(group.url)}
          src={group.picture}
          alt={group.url}
        />
      </CardHeader>
      <CardBody>
        {(item.msg === "•") ? null : <div className="itemMsg">{ParseMessage(item.msg || "")}</div>}
        <ContentInFeed item={item} linkedContent={linkedContent} appController={appController} />
      </CardBody>
      <Comments appController={appController} comments={comments} item={item} group={group} sbChannel={sbChannel} count={item.replycount} memberMap={memberMap} />
    </Card></VisibilitySensor>
  );

}

function determinAction(item) {
  let noMsg = item.msg === "•";
  const key = item?.link?.key;

  if (key) return (noMsg) ? `highlighted_${key}` : `commented_${key}`;

  return "posted_comment";
}

function ContentInFeed({ item, linkedContent, appController }) {
  if (!linkedContent || !item) return null;
  const link = item?.link;
  let map = {
    text: "textInFeed",
    section: "sectionInFeed",
    fax: "faxInFeed",
    com: "commentaryInFeed",
    img: "imageInFeed",
  }
  let key = map[link.key];
  let val = link.val;
  let content = linkedContent?.[key]?.[val] || {};


  switch (key) {
    case 'textInFeed':
      return <TextInFeed textData={content} highlights={item.highlights} appController={appController} />
    case 'sectionInFeed':
      return <SectionInFeed sectionData={content} highlights={[]} appController={appController} />
    case 'commentaryInFeed':
      return <CommentaryInFeed comData={content} appController={appController} highlights={item.highlights} />
    case 'imageInFeed':
      return <ImageInFeed imageData={content} appController={appController} />
    case 'faxInFeed':
      let pieces = val.split(".");
      let version = pieces.pop();
      val = pieces.shift();
      content = linkedContent?.textInFeed?.[val] || {};
      return <FaxInFeed textData={content} item={item} version={version} appController={appController} />
    default:
      return null
  }



}

function LikeUI({  likes, memberMap }) {

  likes = likes || [];
  let likecutoff = 2;
  let likeObjs = likes.map(l => memberMap[l]).filter(x => !!x);
  let likecount = likes.length;
  let namedlikes = likeObjs.slice(0, likecutoff) || [];
  let otherlikes = likeObjs.slice(likecutoff) || [];
  let otherstring = (otherlikes.length) ? label("and_x_others", [otherlikes.length]) : null;
  let likelabel = likecount === 1 ? label("like_this_singular") : label("like_this_plural");
  if (likes.length === 0) return <><img src={like} className="like" /> 0 {label("likes")}</>

  let html = `<ul>${likeObjs.map(i => `<li><img src='${i?.picture}'><span class='progress'>${i?.progress}%</span> ${i?.nickname}</li>`).join('')}</ul>`;

  return <span data-tip={html} data-for={"likeTip"}>
    <img src={like} className="like" />
    <b>{namedlikes?.map(u => u?.nickname)
      .join(
        otherstring ?
          label("honorific", -1) + ", " :
          label("honorific", -1) + " " + label("and") + " ")

      + label("honorific", -1) + label("honorific_subject", -1) + " "
    }</b> {otherstring} {likelabel}</span>
}

function Comments({ appController, comments, count, item, group, memberMap, sbChannel }) {


  const [alertOn, setAlert] = useState(false);

  const [newMessages, setNewMessages] = useState([]);
  let myUserId = appController.states.user.user;

  const [itemState, setItem] = useState(item);
  const [likes, setLikes] = useState(item.likes || []);



  const toggleLike = () => {
    let tmp =[...likes ];
    if (tmp?.includes(myUserId))
    tmp.splice(tmp.indexOf(myUserId), 1);
    else
    tmp.unshift(myUserId);
    
    setLikes(tmp);
  }


  let itemId = item.id;

  let thread = [];
  if (comments === -1) {
    thread = <div className="commentThreadItem">
      <div className="textbox">
        <div className="mesg">{label("loading_comments")}</div>
      </div>
    </div>
  } else {
    comments = Array.isArray(comments) ? comments : [];
    comments = [...comments.filter(m=>m.id!==itemId && !/^[\s•]+$/.test(m.msg)),...newMessages];
    thread = comments.map(comment => <Comment comment={comment} key={comment.id} />);

  }
  count = thread.length


  let comlabel = (count === 1) ? "comment_count_singular" : "comment_count_plural";

  let countRow = <div className="countRow noselect">
    <div className="likeCount"><LikeUI item={itemState} likes={likes} memberMap={memberMap} /></div>
    <div className="commentCount"><img src={comment} className="commentimg" />{label(comlabel, [count + ""])} </div>
  </div>;

  if (!likes.length && !count) countRow = null;


  const handleLike = () => {
    let messageId = item.id;
    const params = new appController.sendbird.sb.MessageListParams();
    params.isInclusive = true;

    toggleLike();
    sbChannel.getMessagesByMessageId(messageId, params, function (messages, error) {

      messages.forEach(message => {
        if (!likes?.includes(myUserId)) {
          sbChannel.addReaction(message, "like", async function (reactionEvent, error) {
             message.applyReactionEvent(reactionEvent);
          });
        }
        else {
          sbChannel.deleteReaction(message, "like", async function (reactionEvent, error) {
            message.applyReactionEvent(reactionEvent);
          });
        }
      });
    });



  }

  const handleComment = () => {

    let el = document.getElementById("feedItem" + itemId);
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    el.focus()
  }


  let buttonRow = <div className={"buttonRow " + ((!sbChannel) ? "disabledrow" : "")}>
    <Button disabled={!sbChannel} onClick={handleLike}><img src={like} className="like" /> {label(likes.includes(myUserId) ? "unlike" : "like")} </Button>
    <Button disabled={!sbChannel} onClick={handleComment}><img src={comment} className="commentimg" /> {label("comment")}</Button>
  </div>
  //likes = null;

  const mycomment = (!comments !== -1) ? <MyComment setNewMessages={setNewMessages} appController={appController} sbChannel={sbChannel} group={group} itemId={itemId} trophy={trophy} /> : null;

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
      >{"a"}</SweetAlert>
    </div>
  );
}


function Comment({ comment }) {
  const match = useRouteMatch();
  const urlMatch = parseInt((match.params?.messageId || 0)) || 0;
  if (!comment) return null;
  let finished = comment.user.finished;
  const isBot = comment.user.nickname === "StudyBuddy"; //TODO get from api
  const botBadge = (isBot) ? <span className="botBadge">BOT</span> : null;
  const trophyImg = (finished) ? <img className="trophy" src={trophy} /> : null;
  let timeAgo = timeAgoString(comment.timestamp / 1000);
  return <div className={"commentThreadItem " + ((urlMatch === comment.id) ? "selected" : "")} key={comment.id}>
    <div className="imagebox noselect">
      {trophyImg}
      <img src={comment.user.picture} onError={breakCache} />
      {!isBot && <div className="progress">{comment.user.progress || 0}%</div>}

    </div>
    <div className="textbox">
      <div className="namerow noselect">{comment.user.nickname} {botBadge} <span>• <Link to={`/home/${comment.channel_url}/${comment.id}`}>{timeAgo}</Link></span></div>
      <div className="mesg">{ParseMessage(comment.msg)}</div>
    </div>
  </div>

}




function MyComment({ appController, group, itemId, setNewMessages, sbChannel, trophy }) {
  let tokenImg = tokenImage();

  let img = appController.states.user.social?.profile_url || tokenImg;

  let joinlabel = (group.privacy === "open") ? "join_group" : "apply_for_membership";
  let finished = appController.states.user.finished;
  let trophyComp = (finished) ? <img className="trophy" src={trophy} /> : null;

  if (!sbChannel) return <div className="commentThreadItem">
    <div className="imagebox noselect">
      {trophyComp}
      <img src={img} onError={breakCache} />
      <div className="progress">{appController.states.user.progress.completed || 0}%</div>
    </div>
    <div className="textbox notmember">
      <textarea
        className="form-control textarea join_to_comment"
        disabled
        placeholder={label("join_to_comment")}
      />
      <GroupCallToAction appController={appController} groupData={group} joinlabel={label(joinlabel)} />
    </div>
  </div>;


  const sendMessage = (textbox, parentMessageId) => {
    let text = textbox.value;
    textbox.classList.add("sending");
    textbox.disabled = true;
    let channel = sbChannel;
    const params = new appController.sendbird.sb.UserMessageParams();
    params.message = text;
    params.parentMessageId = parentMessageId;
    setTimeout(channel.endTyping, 1000);
    channel.sendUserMessage(params, function (message, error) {
      if (error) {
        // Handle error.
        console.log(error);
        return false;
      }
      window.clicky?.goal("comment");
      textbox.value = "";
      textbox.classList.remove("sending");
      textbox.disabled = false;
      textbox.focus();

      let summary = { completed: 0 };
      try { summary = JSON.stringify(message._sender.metaData.summary) } catch (e) { }

      setNewMessages([{
        timestamp: Math.round(message.createdAt),
        msg: message.message,
        id: message.messageId,
        channel_url: channel.url,
        user: {
          picture: message._sender.plainProfileUrl,
          nickname: message._sender.nickname,
          user_id: message._sender.userId,
          progress: summary?.completed || 0
        }
      }]);

    });

  }


  return <div className="commentThreadItem">
    <div className="imagebox noselect">
      <img src={img} onError={breakCache} />
      <div className="progress">{appController.states.user.progress.completed || 0}%</div>
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



}