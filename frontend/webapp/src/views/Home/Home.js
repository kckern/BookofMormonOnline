import React, { useState, useEffect } from "react";
import { useParams, useHistory, useRouteMatch, Link } from "react-router-dom";
import moment from "moment";
import ProgressBox from "../User/ProgressBox.js";
import SignIn from "../User/SignIn.js"
import "../User/SignIn.css"
import trophy from "../User/svg/trophy.svg";

import { loadHomeFeed } from "src/models/dummyData/study";
import { ImageInFeed } from "src/views/_Common/Study/StudyInFeed";
import { HomeFeed } from "./Feed.js";

import ReactTooltip from "react-tooltip";
import "./StudyGroupFeed.css";
import "./Home.css";
import "./Home.m.css";
import "../User/ProgressBox.css";
import blue from "../User/svg/blue.svg";
import green from "../User/svg/green.svg";
import yellow from "../User/svg/yellow.svg";
import blank from "../User/svg/blank.svg";
import empty from "../User/svg/empty.svg";


import { label } from "src/models/Utils";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { TabContent, TabPane, Nav, NavItem, NavLink, Card, Button, CardTitle, CardText, Row, Col, CardHeader, CardBody } from 'reactstrap';
import { toast } from "react-toastify";
import Loader, { Spinner } from "../_Common/Loader/index.js";
import { md5 } from "../../models/SendbirdController.js";

const privateStyle = (nickname) => {

  if(!/[*]/.test(nickname)) return {};
  nickname = nickname.replace(/[*]/g, '');

  let decHash = (md5(md5(nickname))+"6").replace(/[^0123456789]/g, '');
  let first = parseInt(decHash.slice(0,1));
  let last = parseInt(decHash.slice(-1));
  const deg = Math.round(((first) * 360 / 10)+(last * 50));

  return {
    filter: `sepia(1) hue-rotate(${deg}deg)`,
  }


}



function Home({ appController }) {

  const match = useRouteMatch();
  const params = match.params;
  const base = match.url.split("/")[1];

  let urlFeedGroup = (base === "home") ? params.channelId : null;
  let urlFeedMessage = (base === "home") ? params.messageId : null;

  const [activeGroup, setActiveGroup] = useState(urlFeedGroup);
  const [activeMessage, setActiveMessage] = useState(urlFeedMessage);


  useEffect(() => {
    let urlFeedGroup = (base === "home") ? params.channelId : null;
    let urlFeedMessage = (base === "home") ? params.messageId : null;
    setActiveGroup(urlFeedGroup);
    setActiveMessage(urlFeedMessage);
  }, [params])

  useEffect(() => document.title = label("home_title"), [])


  //{(appController.states.user.user) ? <ProgressPanel appController={appController} /> : <HomeSignIn appController={appController} />}
  return false ? null : (
    <div className="home container" >
    <div className="leftPanelScroll noselect">
      <GroupBrowser appController={appController} activeGroup={activeGroup} setActiveGroup={setActiveGroup} />
    </div>
      <div className="rightPanelScroll">
        <HomeFeed appController={appController} activeGroup={activeGroup} messageId={activeMessage} setActiveGroup={setActiveGroup} setActiveMessage={setActiveMessage} />
      </div>

    </div>
  );
}


function GroupBrowser({ appController, activeGroup, setActiveGroup }) {

  const [groupListData, setData] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [finishers, setFinishers] = useState([]);
  const [queryFilter, setQueryFilter] = useState({ token: appController.states.user.token });
  const [seeMoreLabel, setSeeMoreLabel] = useState(label("see_more"));
  const isFiltered = !!queryFilter.grouping;

  useEffect(() => {
    setData([]);
    BoMOnlineAPI({
      homegroups: queryFilter,
      leaderboard: queryFilter
    }, { useCache: false }).then(r => {
      setData(r.homegroups)
      setLeaders(r.leaderboard[0].currentProgress)
      setFinishers(r.leaderboard[0].recentFinishers || [])
      setSeeMoreLabel(label("see_more"));
    }
    )
  }, [appController.states.user.user, queryFilter?.grouping]);

  let groupcount = groupListData?.map(i => i?.grouping).filter((v, i, a) => a.indexOf(v) === i).length;

  return <Card className="Community">
    <CardHeader><h3>{isFiltered ? label(queryFilter?.grouping) : label("community")}{isFiltered ? <span onClick={() => setQueryFilter({ token: appController.states.user.token })}>×</span> : null}</h3></CardHeader>
    <ReactTooltip
      id="button-tip"
      place="left"
      effect="solid"
      backgroundColor={"#666"}
      arrowColor={"#666"}
    />
    <ReactTooltip
      id="card-tip"
      place="right"
      effect="solid"
      className="card-tip"
      backgroundColor={"#EEE"}
      arrowColor={"#666"}
      html
    />
    <CardBody>

      {!groupListData.length || !leaders.length ? <Spinner /> : <>
          <h3>{label("recent_finishers")}</h3>
          <RecentFinishers finishers={finishers} />
          <h3>{label("leader_board")}</h3>
          <LeaderBoard leaders={leaders.slice(0,10)} />
          {groupListData.map((item, i) => {
                if (!item) return null;
                const grouping = item.grouping;
                const prev = groupListData[i - 1] || null;
                const next = groupListData[i + 1] || null;
                return <React.Fragment key={i}>
                  {(grouping !== prev?.grouping && groupcount > 1) ? <h3>{label(item.grouping)}</h3> : null}
                  <GroupCard appController={appController} groupData={item} activeGroup={activeGroup} setActiveGroup={setActiveGroup} />
                  {(grouping !== next?.grouping && !queryFilter.grouping) ? <div className="seeMore" onClick={() => setQueryFilter(q => { q.grouping = grouping; setSeeMoreLabel(label("loading")); console.log(q); return q; })}>{seeMoreLabel}</div> : null}
                </React.Fragment>
                })}
          </>}
    </CardBody>
  </Card>
}

function RecentFinishers({finishers}){

  return <div className="leaderboard">
  {finishers.slice(0,5).map((m, i) =>  <div className="leaderBoardItem" key={i}>
      <div className="rank">{i+1}</div>
      <div class="img-container">
        <img src={m.picture} alt={m.nickname}   style={privateStyle(m.nickname)}/>
        <span class="trophies">{m.finished?.map(i=><img src={trophy}/>)}</span>
      </div>
      <div className="namenum" style={{marginTop:"1ex"}}>
        <div className="nickname">{m.nickname}</div>

        <div className="lastseen"><span>{label("last_studied")}</span> {(()=>{
          const d = Math.max(...m.finished);
          const dateYYMMDD = moment.unix(d).format("ddd, DD MMM YYYY");
          return dateYYMMDD;
        })()}</div>
      </div>
  </div>)}
</div>
}

function LeaderBoard({leaders}){
  /*

          user_id
          nickname
          picture
          progress
          finished
          lastseen
          laststudied
          bookmark*/

return <div className="leaderboard">
  {leaders.map((m, i) =>  <div className="leaderBoardItem" key={i}>
      <div className="rank">{i+1}</div>
      <div class="img-container">
        <img   style={privateStyle(m.nickname)} src={m.picture} alt={m.nickname} />
        <span class="trophies">{m.finished?.map(i=><img src={trophy}/>)}</span>
      </div>
      <div className="namenum" >
        <div className="nickname">{m.nickname}</div>
        <div className="progress">
          <div  className="progressbar" style={{width:`${m.progress}%`}}>{" "}</div>
          <span>{m.progress}%</span>
        </div>

        {false && <div className="lastseen"><span>{label("last_studied")}</span> {(()=>{
          const d = new Date(m.lastseen);
          const daysAgo = Math.floor((new Date() - d*1000) / (1000 * 60 * 60 * 24));
          if(daysAgo <= 1) return label("today");
          if(daysAgo <= 2) return label("yesterday");
          return `${daysAgo} ${label("days_ago")}`;
        })()}</div>}
      </div>
  </div>)}
</div>
}

function GroupCard({ groupData, appController, activeGroup, setActiveGroup }) {

  groupData.members = groupData.members.filter(m => m.nickname !== "StudyBuddy"); //TODO get metadata variables

  const [visibleMembers] = useState(groupData.members.sort(() => (Math.random() > .5) ? 1 : -1).slice(0, 4));

  useEffect(() => {
    ReactTooltip.rebuild();
  });

  let activeClass = activeGroup === groupData.url ? "active" : activeGroup ? "inactive" : "";

  let cardTipHtml = groupToolTipHtml(groupData);

  return <div className={`groupCard ${activeClass}`} data-tip={cardTipHtml} data-for={"card-tip"} ><Link to={`/home/${groupData.url}`}>
    <div className="groupContent" onClick={() => ReactTooltip.hide()} >
      <div className="groupImage">
        <img src={groupData.picture} />
      </div>
      <div className="groupText">
        <div className="groupTitle">{groupData.name}</div>
        <div className="groupMessage">
          <div className="groupMessageAvatar"><img src={groupData.latest.user.picture} /></div>
          <div className="groupMessageContent"> {(groupData.latest.msg?.replace(/<[^>]*>/gi, "")?.replace(/^•$/,label("highlight_msg")))}</div>
        </div>
      </div>
      <div className="groupMembership">
        {(groupData.members.length > 4) ? <div className="groupMembershipCount">{groupData.members.length}</div> : null}
        <div className="groupMembers">
          {visibleMembers?.map((m, i) => <div key={i}><img src={m.picture} /></div>)}
        </div>
        <GroupCallToAction appController={appController} groupData={groupData} />
      </div>
    </div>
  </Link>
  </div>

}

export function GroupCallToAction({ appController, groupData, joinlabel }) {
  const myId = appController.states.user.user;
  const list = appController.states.studyGroup.groupList.map(c => c.url);
  const amMember = list.includes(groupData.url);
  const [amRequester, setamRequester] = useState(groupData.requests?.includes(myId) || false);
  const { privacy } = groupData;
  const actions = {
    private: {
      label: "study",
      tooltip: "open_studyhall"
    },
    public: {
      label: "request",
      tooltip: "request_admission"
    },
    open: {
      label: "join",
      tooltip: "join_instantly"
    }
  }
  const getLabelString = () => (amMember) ? label(actions["private"]?.label) : (amRequester) ? label("applied") : joinlabel || label(actions[privacy]?.label) || "";
  const [button_label, setLabel] = useState(getLabelString());
  let button_tooltip = (amMember) ? label(actions["private"]?.tooltip) : (amRequester) ? label("application_recieved") : label(actions[privacy]?.tooltip) || "";

  useEffect(() => setLabel(getLabelString()), [appController.states.studyGroup.groupList]);

  if (!myId) return <Link to={"/user/signin"}>
    <div className={"groupCTA"} data-tip={label("sign_in")} data-for={"button-tip"}>
    <Button>{label("sign_in")}</Button>
    </div></Link>;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (amMember) {
      const group = appController.states.studyGroup.groupList.find(g => g.url === groupData.url);
      appController.functions.setActiveStudyGroup(group);
      appController.functions.setStudyMode(true);
      appController.functions.openDrawer(true);
    }
    else if (privacy === "public") {
      // Request Membership
      if (amRequester) {
        setLabel(label("withdrawing"));
        withdrawRequest(groupData.url, appController.states.user.token).then(() => {
          setLabel(label("request"));
          setamRequester(false);
        })
      } else {
        setLabel(label("applying"));
        setamRequester(true);
        requestToJoinGroup(groupData.url, appController.states.user.token).then(() => {
          setLabel(label("applied"));
        })
      }

    }
    else if (privacy === "open") {
      // Auto-grant Membership
      setLabel(label("joining"));
      joinOpenGroup(groupData.url, appController.states.user.token).then((success) => {
        if(success) setLabel(label("joined"));
      })
    }
  }


  const joinOpenGroup = async (url, userToken) => {

    let results = await BoMOnlineAPI({ joinOpenGroup: { url: url, userToken } });

    if (results?.joinOpenGroup?.isSuccess) {
      let channel_url = results.joinOpenGroup.channel;
      appController.sendbird.sb.GroupChannel.getChannel(channel_url, function (groupChannel, error) {
        if (error) {
          // Handle error.
          console.log({ error })
          toast.warn(label("join_failed"))
          return false;
        }
        appController.functions.setActiveStudyGroup(groupChannel);
        appController.functions.setStudyMode(true);
        appController.functions.openDrawer(true);
        appController.sendbird?.getStudyGroups()
          .then((list) => appController.functions.setStudyGroups(list));
        //TODO: Refresh Home
        return true;
      });

    } else { //fail
      console.log({ results, url, userToken })
      toast.warn(label("join_failed"))
      return false
    }
  }
  const requestToJoinGroup = async (url, userToken) => {
    let results = await BoMOnlineAPI({ requestToJoinGroup: { url: url, userToken } });
    if (results?.requestToJoinGroup?.isSuccess) {
      toast.info(label("application_recieved"));
    } else { //fail
      console.log({ results, url, userToken })
      toast.warn(label("join_failed"))
    }
  }

  const withdrawRequest = async (url, userToken) => {
    let results = await BoMOnlineAPI({ withdrawRequest: { url: url, userToken } });
    if (results?.withdrawRequest?.isSuccess) {
      toast.info(label("application_withdrawn"));
    } else { //fail
      console.log({ results, url, userToken })
      toast.warn(label("withdraw_failed"))
    }
  }
  return <div className={(amRequester) ? "groupCTA applied" : "groupCTA"} data-tip={button_tooltip} data-for={"button-tip"}>
    <Button onClick={handleClick}>{button_label}</Button>
  </div>
}

export function groupToolTipHtml(groupData) {


  groupData.members = groupData.members.filter(m => m.nickname !== "StudyBuddy"); //TODO get metadata variables

  const sortedMembers = groupData.members.sort((a, b) => b.progress - a.progress);

  return `<div class='cardTip'>
  <div>
    <div class='groupimg'>
      <img src=${groupData.picture} />
    </div>
    <div class='titledesc'>
      <h4>${groupData.name}</h4>
      <p>${groupData.description || ""}</p>
    </div>
  </div>
  <ul class="groupMembers">
    ${sortedMembers.map((m, i) => ` <li key=${i}>
      <img src=${m.picture} />
      <div class='tip-progress'>
        <div>${m.progress}%</div>
      </div>
      <div class='toolTipNickname'>${m.nickname}</div>
    </li>`
  ).join('')}</ul>
</div>`;
}

export function GroupLeaderBoard({groupData}) {
  groupData.members = groupData.members.filter(m => m.nickname !== "StudyBuddy"); //TODO get metadata variables
  const sortedMembers = groupData.members.sort((a, b) => b.progress - a.progress);
  return  <div class='GroupLeaderBoard'>
    {sortedMembers.map((m, i) =>  <><div className="leaderBoardItem" key={i}>
      <div className="rank">{i+1}</div>
      <div class="img-container">
      <img  style={privateStyle(m.nickname)} src={m.picture} alt={m.nickname}/>
            <span class="trophies">{m.finished?.map(i=><img src={trophy}/>)}</span>
      </div>
      <div className="namenum" >
        <div className="nickname">{m.nickname}</div>
        <div className="progress">
          <div  className="progressbar" style={{width:`${m.progress}%`}}>{" "}</div>
          <span>{m.progress}%</span>
        </div>
      </div>
    </div></>
  )}
</div> 
}

export default Home;