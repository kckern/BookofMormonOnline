import { useEffect, useState } from "react";
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
} from "reactstrap";
import { label } from "src/models/Utils";
import "./MobileUser.css";
import { ProfileItems } from "./User";
import Preferences from "./Preferences";
import { numericLoad, ProgressBar, progressShell } from "./ProgressBox.js";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

export default function MobileUser({ appController }) {
  let tokenToLoad = appController.states.user.token;
  const [activeTab, setActiveTab] = useState(
    appController.states.user.social ? "2" : "1",
  );
  const [studySummary, setStudySummary] = useState(null);
  useEffect(() => {
    BoMOnlineAPI({ studylog: [tokenToLoad] }, { useCache: false }).then(
      (result) => {
        if (result?.studylog) {
          setStudySummary(result.studylog[tokenToLoad]?.summary);
        }
      },
    );
    return () => {
      setStudySummary(null);
    };
  }, [appController.states.user?.user]);

  useEffect(() => {
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="content mobileuser">
      <div>
        <Nav tabs className="noselect">
          <NavItem>
            <NavLink
              className={activeTab === "1" ? "selected" : null}
              onClick={() => setActiveTab("1")}
            >
              {label("tab_profile")}
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              className={activeTab === "2" ? "selected" : null}
              onClick={() => setActiveTab("2")}
            >
              {label("tab_progress")}
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              className={activeTab === "3" ? "selected" : null}
              onClick={() => setActiveTab("3")}
            >
              {label("tab_prefs")}
            </NavLink>
          </NavItem>
        </Nav>
        <TabContent activeTab={activeTab}>
          <TabPane tabId="1">
            <Row>
              <ProfileItems
                appController={appController}
                studySummary={studySummary}
                setHistoryView={() => {}}
              />
            </Row>
          </TabPane>
          <TabPane tabId="2">
            <MobileProgressBox appController={appController} />
          </TabPane>
          <TabPane tabId="3">
            <Preferences appController={appController} />
          </TabPane>
        </TabContent>
      </div>
    </div>
  );
}

function MobileProgressBox({ appController }) {
  let tokenToLoad = appController.states.user.token;
  let userToLoad = appController.states.user.user;
  let queryBy = userToLoad || tokenToLoad;
  const [ProgressBoxData, setProgressBoxData] = useState({
    loading: true,
    queryBy: queryBy,
    progressData: progressShell(appController),
    userProgress: { completed: -1, started: -1 },
  });

  useEffect(() => {
    BoMOnlineAPI(
      {
        divisionProgress: null,
        userprogress: tokenToLoad,
      },
      {
        token: tokenToLoad,
        useCache: false,
      },
    ).then((r) => {
      if (r.userprogress && r.divisionProgress)
        setProgressBoxData({
          loading: false,
          queryBy: queryBy,
          progressData: r.divisionProgress,
          userProgress: r.userprogress?.[appController.states.user.token],
        });
    });
  }, []);

  let complete = ProgressBoxData.userProgress?.completed;
  let started = ProgressBoxData.userProgress?.started;
  let name = appController.states.user.social?.nickname;

  if (!Array.isArray(ProgressBoxData.progressData) && ProgressBoxData.progressData)
    ProgressBoxData.progressData = Object.values(ProgressBoxData.progressData);
  
  return (
    <div>
      <h4>{label("study_progress_for_x", [name ? name : label("guest")])}</h4>
      <ProgressBar
        complete={ProgressBoxData.userProgress.completed}
        started={ProgressBoxData.userProgress.started}
      />
      <div className="completed_started">
        {numericLoad(complete)}% {label("completed")} • {numericLoad(started)}%{" "}
        {label("started")}
      </div>
      <hr />

      <div className="divisionProgress">
        {ProgressBoxData.progressData?.map((item) => {
          const percentage = item.progress.completed || 0;
          return (
            <div
              className="divisionProgressItem"
              onClick={() =>
                appController.functions.setPopUp({
                  type: "user/progress",
                  ids: [item.slug],
                  vhtop: 10,
                })
              }
            >
              <h5>{item.title}</h5>{" "}
              <div>
                <img src={`${assetUrl}/home/${item.slug}-1`} />
                {percentage >= 0 ? (
                  <CircularProgressbar
                    strokeWidth={20}
                    value={percentage}
                    text={`${percentage}%`}
                  />
                ) : (
                  <div className="loadingCircle"></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
