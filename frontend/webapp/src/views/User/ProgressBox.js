import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  NavItem,
  NavLink,
  Nav,
  TabContent,
  TabPane,
  Row,
  Col,
} from "reactstrap";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import "./ProgressBox.css";
import { Link, useHistory } from "react-router-dom";
import ReactTooltip from "react-tooltip";
import blue from "./svg/blue.svg";
import green from "./svg/green.svg";
import yellow from "./svg/yellow.svg";
import blank from "./svg/blank.svg";
import empty from "./svg/empty.svg";
import loading from "./svg/loading.svg";
import { label } from "src/models/Utils";
import { history } from "src/models/routeHistory";

const makeBlankSections = (counts, id) => {
  if (!counts) return {};
  return counts.map((sectionMax, i) => {
    let units = new Array(sectionMax).fill(null);
    return {
      slug: "section" + id + i,
      sectionText: units.map((unit, j) => {
        return { heading: null, link: j };
      }),
    };
  });
};
export default function ProgressBox({ appController }) {
  useEffect(() => history.push("/user"), []);

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
      if (r.userprogress && r.divisionProgress) {
        const progress = r.userprogress?.[appController.states.user.token];
        setProgressBoxData({
          loading: false,
          queryBy: queryBy,
          progressData: r.divisionProgress,
          userProgress: progress,
        });
        appController.functions.updateUserProgress(progress);
      }
    });
    return () => {
      setProgressBoxData({});
    };
  }, []);

  let completed = ProgressBoxData.userProgress?.completed;
  let started = ProgressBoxData.userProgress?.started;
  let name = appController.states.user.social?.nickname;
  let img = appController.states.user.social?.profile_url;

  return (
    <Card className="ProgressBox">
      <CardHeader>
        <h5>
          {label("study_progress_for_x", [name ? name : label("guest")])}:<br />
          <span>
            {numericLoad(completed)}% {label("completed")} •{" "}
            {numericLoad(started)}% {label("started")}
          </span>
        </h5>
        <ProgressBar complete={completed} started={started} />
      </CardHeader>
      <CardBody>
        <ProgressDetails
          progressData={ProgressBoxData.progressData}
          appController={appController}
        />
      </CardBody>
    </Card>
  );
}

export function ProgressBar({ complete, started }) {
  return (
    <div className="progress">
      <div
        className={"progress-bar progress-bar-success"}
        role="progressbar"
        style={{ width: complete + "%" }}
      ></div>
      <div
        className={"progress-bar progress-bar-warning"}
        role="progressbar"
        style={{ width: started + "%" }}
      ></div>
    </div>
  );
}

export function numericLoad(val) {
  if (val < 0) return <img src={loading} className="loading" />;
  return val;
}

export function progressShell(appController) {
  let progressData = appController.preLoad.divisionShell;
  let progress = {
    completed: -1,
    started: -1,
    completed_items: [],
    started_items: [],
  };
  //process object

  for (let d in progressData) {
    for (let p in progressData[d].pages) {
      progressData[d].progress = progress;
      progressData[d].pages[p].progress = progress;
      progressData[d].pages[p].sections = makeBlankSections(
        progressData[d].pages[p].counts,
        d + p,
      );
    }
  }
  return progressData;
}

function ProgressDetails({ progressData, appController, whois }) {
  const [activeItem, setActiveItem] = useState("lehites");
  if (!progressData) return null;
  if (!Array.isArray(progressData)) progressData = Object.values(progressData);

  const handleClick = (slug) => {
    setActiveItem(slug);
  };

  return (
    <Row>
      <Col>
        <div className="nav-tabs-navigation verical-navs p-0">
          <div className="nav-tabs-wrapper">
            <Nav className="flex-column nav-stacked " role="tablist" tabs>
              {progressData.map((item, i) => (
                <NavItem id={"navitem" + i} key={"navitem" + i}>
                  <NavLink
                    onClick={() => handleClick(item.slug)}
                    data-toggle="tab"
                    role="tab"
                    className={activeItem === item.slug ? "active" : ""}
                  >
                    <div className={"itemContents"}>
                      <div className="title">{item.title}</div>

                      <div className="progress">
                        <div
                          className={"progress-bar progress-bar-success"}
                          role="progressbar"
                          style={{ width: item.progress?.completed + "%" }}
                        ></div>
                        <div
                          className={"progress-bar progress-bar-warning"}
                          role="progressbar"
                          style={{ width: item.progress?.started + "%" }}
                        ></div>
                      </div>
                    </div>
                  </NavLink>
                </NavItem>
              ))}
            </Nav>
          </div>
        </div>
      </Col>
      <Col md="6" className="ProgressBoxPaneCol">
        {/* Tab panes */}
        <TabContent activeTab={activeItem}>
          <TabPane tabId={activeItem} className={"ProgressBoxPane"}>
            {progressData
              .filter((i) => i.slug === activeItem)
              .map((item, i) => (
                <ProgressPanel
                  key={"progressData" + i}
                  item={item}
                  appController={appController}
                  whois={whois}
                />
              ))}
          </TabPane>
        </TabContent>
      </Col>
    </Row>
  );
}

export function ProgressDetailsCircles({ progressPages, callBack }) {
  const blankfn = () => {};
  if (!progressPages?.pages) return null;
  return (
    <div>
      {progressPages.pages?.map((page) => {
        if (!page.progress?.completed && page.progress?.completed !== 0) {
          return null;
        }
        let {
          completed,
          started,
          completed_items,
          started_items,
          active_items,
        } = page.progress;

        let pageDots =
          !page?.sections || typeof page?.sections?.map !== "function" ? (
            <></>
          ) : (
            page?.sections?.map((section, i) => {
              if (section.sectionText === undefined) return null;
              return (
                <span
                  key={section.slug ? section.slug : section.title}
                  className="sectionDots"
                >
                  {section?.sectionText?.map((item, i) => {
                    let dot = <img src={blank} />;
                    let status = label("not_started");
                    //TODO lookup completed
                    if (active_items?.includes(item.link)) {
                      dot = <img src={blue} />;
                      status = label("started");
                    }
                    if (completed_items?.includes(item.link)) {
                      dot = <img src={green} />;
                      status = label("completed");
                    }
                    if (started_items?.includes(item.link)) {
                      dot = <img src={yellow} />;
                      status = label("started");
                    }
                    if (!item.heading) {
                      dot = <img src={empty} />;
                      status = label("not_started");
                    }
                    let slug = page.slug + "/" + item.link;
                    if (!item.heading)
                      return (
                        <a key={("slug-", slug)}>
                          <span className="noclick" role="img">
                            <>{dot}</>
                          </span>
                        </a>
                      );
                    return (
                      <Link
                        key={slug + "dot" + i}
                        to={`/${slug}`}
                        data-html={true}
                        data-tip={
                          "<b>" +
                          section.title +
                          "</b> <br/>" +
                          item.heading +
                          "<br/>" +
                          status
                        }
                        data-for="dotToolTip"
                        onClick={callBack || blankfn}
                      >
                        <span role="img">
                          <>{dot}</>
                        </span>
                      </Link>
                    );
                  })}
                </span>
              );
            })
          );
        let completedBadgeClass = completed <= 0 ? " hide" : "";
        let completedBadge = (
          <span className={"pagePerc" + completedBadgeClass}>{completed}%</span>
        );
        return (
          <div className="sectionBox" key={page.slug}>
            {completedBadge}
            <h4>{page.title} </h4>
            <ReactTooltip
              effect="solid"
              id="dotToolTip"
              type="dark"
              offset={{ top: -8 }}
            />
            {pageDots}
          </div>
        );
      })}
    </div>
  );
}

function ProgressPanel({ item, appController }) {
  let tokenToLoad = appController.states.user.token;
  let userToLoad = appController.states.user.user;
  let queryBy = userToLoad || tokenToLoad;

  useEffect(() => {
    ReactTooltip.rebuild();
  });

  const [progressPages, setDetails] = useState({
    loading: true,
    queryBy: queryBy,
    slug: item.slug,
    pages: item.pages,
  });

  if (progressPages.slug !== item.slug) {
    //After Switch
    let shell = progressShell(appController);
    if (!Array.isArray(shell)) shell = Object.values(shell);
    setDetails({
      loading: true,
      slug: item.slug,
      pages: shell?.filter((tmp) => tmp.slug === item.slug).shift().pages,
    });
  }

  useEffect(() => {
    if (progressPages.loading || progressPages.queryBy !== queryBy) {
      BoMOnlineAPI(
        { divisionProgressDetails: item.slug },
        {
          token: tokenToLoad,
          useCache: false,
        },
      ).then((details) => {
        setDetails({
          loading: false,
          queryBy: queryBy,
          slug: item.slug,
          pages: details.divisionProgressDetails?.[item.slug].pages || [],
        });
      });
    }
    return () => {
      setDetails({});
    };
  }, []);

  return (
    <div
      key={"progressData" + item.slug}
      id={"progressData" + item.slug}
      className={"divProgress"}
    >
      <Link to={item.slug}>
        <h2>{item.title}</h2>
        <div
          className="divImg"
          style={{
            backgroundImage: `url("https://media.bookofmormon.online/home/${item.slug}-1")`,
          }}
        >
          <div>{item.description} </div>
        </div>
        <div className="progress">
          <div
            className={"progress-bar progress-bar-success"}
            role="progressbar"
            style={{ width: item.progress?.completed + "%" }}
          ></div>
          <div
            className={"progress-bar progress-bar-warning"}
            role="progressbar"
            style={{ width: item.progress?.started + "%" }}
          ></div>
        </div>
        <div className={"textProgress"}>
          {numericLoad(item.progress?.completed)}% {label("completed")}
          {" • "}
          {numericLoad(item.progress?.started)}% {label("started")}
        </div>
      </Link>
      <ProgressDetailsCircles progressPages={progressPages} />
    </div>
  );
}
