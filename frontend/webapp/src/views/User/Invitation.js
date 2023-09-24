import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardFooter,
  CardBody,
  Button,
  NavLink,
  Nav,
  TabContent,
  TabPane,
  Row,
  Col,
  Alert,
} from "reactstrap";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import "./Invitation.css";
import { Link, useHistory } from "react-router-dom";
import { isMobile, label, testJSON } from "src/models/Utils";
import { useRouteMatch } from "react-router-dom";
import SignIn from "./SignIn"
import { SignUp } from "./SignUp.js"
import solo from "src/views/_Common/Study/svg/solo.svg"
import city from "src/views/_Common/Study/svg/public.svg"
import globe from "src/views/_Common/Study/svg/open.svg"
import lock from "src/views/_Common/Study/svg/private.svg"

import group_icon from "./svg/group.svg"
import members from "./svg/members.svg"
import chat from "./svg/chat.svg"
import warning from "./svg/warning.svg"
import newuser from "./svg/newuser.svg"
import signin from "./svg/signin.svg"
import noaccess from "./svg/noaccess.svg"
import moment from "moment";
import Loader from "../_Common/Loader";
import SocialSignIn from "./SocialSignIn";
import { history } from "src/models/routeHistory";

export default function Invitation({ appController }) {

  const match = useRouteMatch();
  const history = useHistory();
  const userToken = appController.states.user.token;
  const hash = match.params.hash;
  const [group, setGroup] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [contentState, setContentState] = useState("main");
  const [accepting, setAccepting] = useState(false);
  const [loading, setLoading] = useState(false);

  

  useEffect(() => {
    BoMOnlineAPI({ loadGroupsFromHash: hash },
      { useCache: false }).then((groups) => {
        if (groups.loadGroupsFromHash[hash] && groups.loadGroupsFromHash[hash]?.channel_url)
          setGroup(groups.loadGroupsFromHash[hash])
        else setNotFound(true)
      });
  }, [])

  useEffect(() => {
    if (appController.sendbird?.sb?.currentUser) return null;
    if (contentState === "signIn" || contentState === "signUp") handleAccept();
  }, [appController.sendbird?.sb?.currentUser]);


  const handleAccept = async () => {

    if (!appController.states.user.user) return setContentState("guestAccept");
    setAccepting(true);
    const {channel_url, group, results} = await joinGroupFromHash(hash, userToken); //.then((group) => {
      console.log({channel_url,group, results});
      if(!channel_url || !group) return;
      appController.sendbird.getStudyGroups().then((list) =>{
        appController.functions.setStudyGroups(list);
        appController.functions.setStudyMode(true);
        appController.functions.setActiveStudyGroup(group);
        if(isMobile()) history.push(`/group/${group.url}/leaderboard`) 
        else appController.functions.openDrawer(true);

        //check if active study group is the new group, if not, set it every 5 seconds until it is, max 10 times
        let tries = 0;
        let interval = setInterval(()=>{
          if(appController.states.studyGroup.activeGroup?.url===channel_url || tries>10) {
            clearInterval(interval);
            return;
          }
          appController.functions.setActiveStudyGroup(group);
          tries++;
        },5000);


      } 
     );
  }


  const joinGroupFromHash = async (hash, userToken) => {

    try {
      const results = await BoMOnlineAPI({ joinGroup: { hash, userToken } });
  
      if (results?.joinGroup?.isSuccess) {
        let channel_url = results.joinGroup.channel;
  
        const groupChannel = await new Promise((resolve, reject) =>
          appController.sendbird.sb.GroupChannel.getChannel(channel_url, (groupChannel, error) =>
            error ? reject(error) : resolve(groupChannel)
          )
        );
        
        if (groupChannel) {
          history.push("/user");
          return {channel_url, group: groupChannel, results};
        } else {
          throw new Error("Group channel not found");
        }
      } else {
        history.push("/home");
        return {channel_url: null, group: null, results:{}}
      }
    } catch (error) {
      console.log({error});
      // Handle error appropriately
      history.push("/home");
      return {channel_url: null, group: null, results:false}
    }
  }

  
  if (notFound) return <div id="page" className="invitation">
    <div className="noInvite">
      <img src={noaccess}/>
    <Alert color={"warning"} >{label("invitation_not_found")}</Alert>
    </div>
    
    </div>

  if (!group) return <Loader />;

  if(loading) return <Loader/>

  let icons = {
    open: globe,
    public: city,
    private: lock,
    solo: solo,
  }

  let lowerContent = {
    main: <><CardBody className="profileCard">
      <div className="accept_decline">
        <Button onClick={handleAccept} className="btn btn-success">{accepting ? label("accept_inviting") : label("accept_invite")}</Button>
        <Link to={"/home"}><Button className="btn btn-danger">{label("decline_invite")}</Button></Link>
      </div>

      <div>{label("study_groups_are")}</div>
    </CardBody>
      <CardHeader>
        <h5 className="title md-4" style={{ textAlign: "center" }}>
          <img src={group_icon} className={"header_icon"} />
          {label("group_preview")}
        </h5>
      </CardHeader>
      <CardBody className="profileCard members_messages noselect">
        <Card>
          <CardHeader>
            <h5 className="title md-3">
              <img src={members} className={"header_icon"} />{label("group_members", [group.members?.length])}</h5></CardHeader>
          <CardBody className="memberListCard">
            <ul className="memberList">
              {group.members?.map(member => {
                let summary = testJSON(member.metadata.summary) || {};
                let completed = isNaN(0 + parseInt(summary.completed)) ? 0 : summary.completed;
                return <li className={"memberItem " + (member.is_online ? "online" : "")} key={member.user_id}>
                  <img src={member.profile_url} />
                  <div className={"completedLabel"}>{completed}%</div>
                  <div className={"nicknameLabel"}>{member.nickname}</div>
                </li>
              })}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h5 className="title md-3">
            <img src={chat} className={"header_icon"} />{label("recent_convo")}</h5></CardHeader>
          <CardBody className="messageList">
            <ul >
              {group.messages?.map(message => {
                return <li className={"messageItem"}>
                  <img src={message.user?.profile_url}/>
                  <div>
                    <div className="nickname">{message.user?.nickname} <span>{moment(message.created_at).format(label("full_datetime"))}</span></div>
                    <div>{message.message.replace(/(<([^>]+)>)/ig, '').replace(/^•$/,label("highlight_msg"))}</div>
                  </div>
                </li>
              })}
            </ul>
          </CardBody>
        </Card>
      </CardBody></>,
    guestAccept: <CardBody className="guestAccept">

      <h5 className="title md-4 text-center"><Alert color="warning" fade={true}><img src={warning} />{label("account_required")}<img src={warning} /></Alert></h5>

      <div className="SignUpIn">
        <Card>
          <CardHeader><h5 className="title md-4 text-center">{label("need_an_account")}</h5></CardHeader>
          <CardBody className="selectUpIn">
            <img src={newuser} />
            <Button onClick={() => setContentState("signUp")}>{label("sign_up")}</Button></CardBody>
        </Card>
        <Card>
          <CardHeader><h5 className="title md-4 text-center">{label("have_an_account")}</h5></CardHeader>
          <CardBody className="selectUpIn">
            <img src={signin} />
            <Button onClick={() => setContentState("signIn")}>{label("sign_in")}</Button>
          </CardBody>
        </Card>
      </div>

    </CardBody>,
    signUp: <div className="signUpWrapper">
      <a onClick={() => setContentState("guestAccept")}>⬅</a>
      <SocialSignIn appController={appController} cancel={() => { }} setLoading={setLoading} />
      <SignUp appController={appController} cancel={null} />
    </div>,
    signIn: <div className="signInWrapper">
      <a onClick={() => setContentState("guestAccept")}>⬅</a>
      <SignIn appController={appController}  setLoading={setLoading} />
    </div>,
  }
  return <div id="page" className="invitation">
    <Card className="card-invite" md={6}>

      <CardHeader className="inviteHeader">
        <div className={"coverBox"}>
          <img src={group.cover_url} className="cover" />
          <div className={"groupType"}><span><img src={icons[group.custom_type]} /> {label(group.custom_type+"_group")}</span></div>
        </div>
        <div className={"contentBox"}>
          <h3 className="title lg-2 you_are ">{label("you_are_invited")}</h3>
          <h3 className="title lg-4 ">{group.name?.trim()}</h3>

          <div>{testJSON(group.data) && (group.data)?.description || null}</div>

        </div>
      </CardHeader>
      {lowerContent[contentState]}
    </Card>

  </div>

};
