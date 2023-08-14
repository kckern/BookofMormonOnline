import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Col,
  Row,
  NavItem,
  NavLink,
  Nav,
  TabContent,
  TabPane, Dropdown, DropdownToggle, DropdownMenu, DropdownItem
} from "reactstrap";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { breakCache, label } from "src/models/Utils";
import "./Profile.css";
import PictureWithOverlay from "./PictureWithOverlay";
import uploadIcon from "./svg/uploadImage.svg";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import ReactLoading from "react-loading";
import Gluejar from "react-gluejar";
import loading from "./svg/loading.svg";

import trophy from "./svg/trophy.svg";
import spotlight from "./svg/spotlight.svg";
import cake from "./svg/cake.svg";
import parkingmeter from "./svg/parkingmeter.svg";
import count from "./svg/count.svg";
import exit from "./svg/exit.svg";
import edit from "./svg/edit.svg";
import padlock from "./svg/padlock.svg";
import moment from "moment";
import momentDurationFormatSetup from "moment-duration-format";
momentDurationFormatSetup(moment);
moment.locale(label("moment_locale"));

export function Profile({
  setProfileState,
  appController,
  studySummary,
  setHistoryView,
}) {
  const [menuOn, setMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const processLogout = () => {
    setLoggingOut(true);
    BoMOnlineAPI({ signout: { token: appController.states.user.token } }).then(
      (results) => {
        if (results.signout) {
          appController.sendbird
            ?.updateUserState({
              channels: appController.states.studyGroup.groupList,
              activeCall: "",
              activeGroup: "",
            })
            .then((r) => {
              if (appController.states.studyGroup.activeCall?.localParticipant)
                appController.states.studyGroup.activeCall.exit();
              appController.functions.processSignOut();
              setProfileState("profile");
              setLoggingOut(false);
            });
        } else {
          //TODO Failed Logout
        }
      }
    );
  };

  let menu = menuOn ? (
    <ul onBlur={() => setMenu(false)} className="dropdown">
      <li onClick={() => setProfileState("edit")}>
        <img src={edit} />
        {label("edit_profile")}
      </li>
      <li onClick={() => setProfileState("password")}>
        <img src={padlock} />
        {label("change_password")}{" "}
      </li>
      <li onClick={() => processLogout(setLoggingOut)}>
        <img src={exit} />
        {label(loggingOut ? "logging_out" : "log_out")}
      </li>
    </ul>
  ) : null;



  const [dropDown, setDropDown] = useState(false)


  let me = appController.states.user.social;

  return (
    <>
      <Card className="card-user">
        <CardBody className="profileCard">
          <ProfilePicture appController={appController} />
          <div className="profileText">
            {menu}
            <h5>
              {me.nickname}
              <Dropdown
                className="profileDropdown"
                direction="left"
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
                  <DropdownItem header>{label("user_profile")}</DropdownItem>
                  <DropdownItem divider/>
                  <DropdownItem onClick={() => setProfileState("edit")}>
                    <img src={edit} />
                    {label("edit_profile")}
                  </DropdownItem>
                  <DropdownItem onClick={() => setProfileState("password")}>
                    <img src={padlock} />
                    {label("change_password")}{" "}
                  </DropdownItem>
                  <DropdownItem onClick={() => processLogout(setLoggingOut)}>
                    <img src={exit} />
                    {label(loggingOut ? "logging_out" : "log_out")}
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </h5>
            <div>
              {label("username")}:<br />
              <code>@{appController.states.user.user}</code>
            </div>
            {appController.states.user?.email ? (
              <div>
                {label("email")}:<br />
                <code className="email">{appController.states.user.email}</code>
              </div>
            ) : null}
          </div>
        </CardBody>
        <CardFooter>
          <hr />
          <div className="button-container">
            <Row className="quickstats" onClick={setHistoryView}>
              <Col className="ml-auto">
                <h5>
                  <img src={cake} />
                  <div className="stat_label"><b>{label("date_started")}:</b></div>
                  <div>
                  {studySummary?.first ? (
                    moment.unix(studySummary?.first).format(label("history_date_format_full"))
                  ) : (
                    <img src={loading} className="loading" />
                  )}{" "}
                </div></h5>
              </Col>
              <Col className="ml-auto mr-auto">
                <h5>
                  <img src={parkingmeter} />
                  <div className="stat_label"><b>{label("study_time")}:</b></div>
                  <div>
                  {(Number.isInteger(studySummary?.duration)) ? (
                    moment
                      .duration(studySummary?.duration, "seconds")
                      .format(label("duration_format"))
                  ) : (
                    <img src={loading} className="loading" />
                  )}{" "}
                  </div></h5>
              </Col>
              <Col className="mr-auto">
                <h5>
                  <img src={count} />
                  <div className="stat_label"><b>{label("study_sessions")}:</b></div>
                  <div>
                  {(Number.isInteger(studySummary?.count)) ? (studySummary?.count) : <img src={loading} className="loading" /> }{" "}
               
                  </div></h5>
              </Col>
            </Row>
          </div>
        </CardFooter>
        <CardFooter></CardFooter>
      </Card>
      {studySummary?.finished ? (
        <Card className={"trophyCase"}>
          <CardHeader>
            <h5 className="title">
              <img src={spotlight} /> {label("trophy_case")}
            </h5>
          </CardHeader>
          <CardBody>
            <ul>
              {studySummary?.finished.map((timestamp) => (
                <li
                  onClick={() => {
                   // appController.functions.setPopUp({ type: "victory" });
                  }}
                >
                  <img src={trophy} />{" "}
                  {label("completed_on_x", [
                    moment.unix(timestamp).format(label("history_date_format_full")),
                  ])}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}

function ProfilePicture({ appController }) {
  const [openModal, setOpenModal] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const sb = appController.sendbird.sb;
  useEffect(() => {
    if (
      profileImage !== appController.states.user.social.profile_url ||
      profileImage === null
    )
      setProfileImage(appController.states.user.social.profile_url);
  }, [appController.states.user.social.profile_url]);
  return (
    <PictureWithOverlay
      imgUrl={profileImage}
      onError={breakCache}
      setOpenModal={setOpenModal}
      openModal={openModal}
      appController={appController}
      isGroup={false}
    />
  );
/* tmp */
}