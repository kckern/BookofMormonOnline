import React, { useState, useEffect, useCallback } from "react";
import SignIn from "./SignIn";
import EditProfile from "./EditProfile";
import Preferences from "./Preferences";
import { ChangePassword } from "./Password";
import { isMobile, label } from "src/models/Utils";
import {
  Button,
  Card,
  CardHeader,
  Alert,
  CardBody,
  Input,
  InputGroupAddon,
  InputGroupText,
  InputGroup,
} from "reactstrap";
import "./User.css";

import "react-calendar-heatmap/dist/styles.css";
import ProgressBox from "./ProgressBox.js";
import { StudyHistory } from "./History";
import { HistoryList } from "./HistoryList";
import { Profile } from "./Profile";
import { Col, Row } from "reactstrap";
import { useRouteMatch } from "react-router";
import MobileUser from "./MobileUser";
import { Spinner } from "../_Common/Loader";
import { useAppController } from "src/contexts/AppControllerContext";
export default function User() {
  const appController = useAppController();
  let name = appController.states.user.social?.nickname;
  useEffect(
    () =>
      (document.title =
        label("study_progress_for_x", [name ? name : label("guest")]) +
        " | " +
        label("home_title")),
    [],
  );
  const match = useRouteMatch();
  const [viewPrefs, setViewPrefs] = useState(
    match.params.value === "preferences",
  );
  const [viewHistory, setHistoryView] = useState(
    match.params.value === "history",
  );

  const [studyLog, setStudyLog] = useState(null);
  const [studySummary, setStudySummary] = useState(null);
  const [progressList, setProgressList] = useState(null);

  useEffect(() => {
    setStudyLog(null);
    setStudySummary(null);
    setProgressList(null);
  }, [appController.states.user.user]);

  useEffect(() => {
    switch (match.params.value) {
      case "preferences":
        setHistoryView(false);
        setViewPrefs(true);
        break;
      case "history":
        setViewPrefs(false);
        setHistoryView(true);
        break;
      default:
        break;
    }
  }, [match.params.value, studyLog]);

  if (isMobile()) return <MobileUser />;

  return (
    <div className="container">
      <div id="page" className="user noselect">
        <div className="user">
          <Row>
            <Col md="8">
              {viewPrefs ? (
                <Preferences />
              ) : viewHistory ? (
                <HistoryList
                  studyLog={studyLog}
                  progressList={progressList}
                  setHistoryView={setHistoryView}
                />
              ) : (
                <ProgressBox />
              )}
            </Col>
            <Col md="4">
              <ProfileItems
                studySummary={studySummary}
                setHistoryView={setHistoryView}
              />
              <StudyHistory
                setHistoryView={setHistoryView}
                setStudyLog={setStudyLog}
                setStudySummary={setStudySummary}
                studyLog={studyLog}
                setProgressList={setProgressList}
                progressList={progressList}
              />
            </Col>
          </Row>
        </div>
      </div>
    </div>
  );
}

export function ProfileItems({ studySummary, setHistoryView }) {
  const appController = useAppController();
  const [profileState, setProfileState] = useState("profile");
  const [loading, setLoading] = useState(false);

  if (loading) return <Spinner />;

  let isLoggedIn = appController.states.user.social ? true : false;
  if (!isLoggedIn)
    return (
      <Card className="card-login">
        <CardBody>
          <SignIn
            setProfileState={setProfileState}
            setLoading={setLoading}
          />
        </CardBody>
      </Card>
    );

  return profileState === "edit" ? (
    <EditProfile
      setProfileState={setProfileState}
    />
  ) : profileState === "profile" ? (
    <Profile
      setProfileState={setProfileState}
      studySummary={studySummary}
      setHistoryView={setHistoryView}
    />
  ) : profileState === "password" ? (
    <ChangePassword
      setProfileState={setProfileState}
    />
  ) : null;
}
