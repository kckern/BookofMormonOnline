/* eslint-disable react-hooks/exhaustive-deps */
import React, { useReducer, useEffect, useState } from "react";
import ReactTooltip from "react-tooltip";
// BROWSER HISTORY
// API ACTIONS
// COMPONENTS
import Loader from "../_Common/Loader";
// CHILD
import Section from "./Section";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import "./Page.css";
// import Comments from '../_Common/Study/Study';
import {
  testJSON,
  findAncestor,
  scrollTo,
  label,
  playSound,
  getCoords,
  isMobile,
} from "src/models/Utils";
import { useRouteMatch } from "react-router-dom";

import { Floaters } from "./Floaters";
import { Alert } from "reactstrap";
import loading_comments from "src/views/_Common/Study/svg/loading_comment.svg";
import { MuteButton } from "./MuteButton";

function prepareInitOpen(params) {
  let initOpen = {};
  let { pageSlug, textId, imageId, commentaryId, faxVersion } = params;

  initOpen["pageSlug"] = pageSlug;

  if (textId) initOpen["textId"] = textId;
  if (imageId) initOpen["imageId"] = imageId;
  if (commentaryId) initOpen["commentaryId"] = commentaryId;
  if (faxVersion) initOpen["faxVersion"] = faxVersion;

  return initOpen;
}

export default function Page({ appController }) {
  const match = useRouteMatch();
  if (match.params.pageSlug === "study") {
    let parts = localStorage
      .getItem("studybookmark")
      ?.split("/")
      .slice(-2) || [null, null];
    match.params.pageSlug = parts[0] || "lehites";
    match.params.textId = parts[1] || 1;
  }

  let initOpen = prepareInitOpen(match.params);

  useEffect(() => {
    pageController.functions.setPageData(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    pageController.functions.setLoading(true);
    if (match.params.imageId || match.params.commentaryId)
      getPageDataFromAPIViaNote(match.params);
    else getPageDataFromAPI(match.params.pageSlug);
  }, [match.params.pageSlug]);

  let [commentState, setCommentState] = useState("init");

  const [pageController, dispatch] = useReducer(
    reducer,
    (() => {
      //Set Initial States
      let states = {
        loading: null,
        init: false,
        activeSection: null,
        activeRow: null,
        activeAudio: null,
        commentGroupId: null,
        audioPlaying: false,
        pageSlug: initOpen.pageSlug,
        textId: null,
        touched: false,
        route: match,
        initOpen: initOpen,
        openRows: [],
        studyBuddies: {},
        progress: {},
      };
      let preLoad = {
        peoplePlaceToolTipData: {},
        peoplePlaces: {},
      };
      //Define all Row-level functions
      let functions = {
        setLoading: (val) => {
          dispatch({ fn: "setLoading", val: val });
        },
        markAsInitiated: (val) => {
          dispatch({ fn: "markAsInitiated", val: val });
          onScrollPage(pageController);
        },
        autoAdvance: () => {
          if (!pageController.appController.states.preferences.autoplay)
            return false;
          let parts = pageController.states.activeRow.split("/").reverse();
          let nextNum = parseInt(parts[0]) + 1;
          parts[0] = nextNum;
          let newSlug = parts.reverse().join("/");
          let el = document.querySelectorAll(`a[href='/${newSlug}']`)[0];
          el?.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
          });
          el?.click();
        },
        setPageData: (val) => {
          dispatch({ fn: "setPageData", val: val });
        },
        setPageComments: (val) => {
          dispatch({ fn: "setPageComments", val: val });
        },
        addToPageComments: (val) => {
          dispatch({ fn: "addToPageComments", val: val });
        },
        updateToPageComment: (val) => {
          dispatch({ fn: "updateToPageComment", val: val });
        },
        deleteToPageComments: (val) => {
          dispatch({ fn: "deleteToPageComments", val: val });
        },
        setActiveRow: (val) => {
          dispatch({ fn: "setActiveRow", val: val });
        },
        addOpenRow: (val) => {
          dispatch({ fn: "addOpenRow", val: val });
        },
        removeOpenRow: (val) => {
          dispatch({ fn: "removeOpenRow", val: val });
        },
        setActiveSection: (val) => {
          dispatch({ fn: "setActiveSection", val: val });
        },
        setPageSlugId: (val) => {
          dispatch({ fn: "setPageSlugId", val: val });
        },
        resetPage: (val) => {
          dispatch({ fn: "resetPage", val: val });
        },
        setTouched: (val) => {
          dispatch({ fn: "setTouched", val: val });
        },
        setInitOpen: (val) => {
          dispatch({ fn: "setInitOpen", val: val });
        },
        setOpenRows: (val) => {
          dispatch({ fn: "setOpenRows", val: val });
        },
        moveStudyBuddies: (val) => {
          dispatch({ fn: "moveStudyBuddies", val: val });
        },
        setPageProgress: (val) => {
          dispatch({ fn: "setPageProgress", val: val });
        },
      };
      //Create Initial Controller
      let initPageController = {
        states: states,
        preLoad: preLoad,
        pageData: null,
        pageComments: null,
        pageCommentCounts: null,
        functions: functions,
        appController: appController,
      };
      //Return the Row Controller
      return initPageController;
    })(),
  );

  useEffect(() => {
    return () => {
      pageController.states.activeAudio?.pause(); // Pause Audio if navigate from another page
    };
  }, []);

  useEffect(() => {
    setReadyToScroll(false);
    startInit(false);
    dispatch({ fn: "markAsInitiated", val: false });
    prepareInitOpen(match.params);
    handlePageInit();
  }, [match.params.pageSlug]);

  const studyModeisOn =
    pageController.appController.states.studyGroup.studyModeOn;
  const userIsLoggedIn = !!pageController.appController.states.user.user;
  const hasActiveGroup = !!pageController.appController.states.studyGroup
    .activeGroup?.url;
  const needToLoadComments = userIsLoggedIn && studyModeisOn && hasActiveGroup;
  const [readyToScroll, setReadyToScroll] = useState(false);
  const [initStarted, startInit] = useState(false);
  const [stageClass, setStageClass] = useState(null);

  useEffect(() => {
    if (pageController.pageComments) setReadyToScroll(true);
  }, [pageController.pageComments]);
  useEffect(() => {
    if (pageController.appController.states.studyGroup.studyModeOn)
      setReadyToScroll(false);
  }, [pageController.appController.states.studyGroup.activeGroup?.url]);

  //Init Page
  const handlePageInit = () => {
    //  console.log("handlePageInit",{initStarted,readyToScroll,d:document.querySelector(".content")})
    if (initStarted) return false;
    if (!readyToScroll) return false;
    if (!document.querySelector(".content")) return false;

    startInit(true);
    if (pageController.states.initOpen.faxVersion)
      return initPageFax(pageController);
    if (pageController.states.initOpen.imageId)
      return initPageImage(pageController);
    if (pageController.states.initOpen.commentaryId)
      return initPageCommentary(pageController);
    if (pageController.states.pageSlug && pageController.states.initOpen.textId)
      return initPageItem(pageController);
    if (
      pageController.states.initOpen.pageSlug === pageController.pageData?.slug
    ) {
      return initPage(pageController, pageController.states.initOpen.lastLeaf);
    }
  };

  useEffect(handlePageInit, [
    readyToScroll,
    pageController.states.loading,
    needToLoadComments,
    document.querySelector(".content"),
  ]);

  //Load Page Comments
  useEffect(() => {
    if (!pageController.pageData) return false;
    loadPageComments(pageController, setReadyToScroll);
  }, [
    pageController.appController.states.studyGroup.activeGroup?.url,
    pageController.states.pageSlug,
    pageController.pageData,
  ]);

  //Audio Settings Changed
  useEffect(() => {
    if (!pageController.appController.states.preferences.audio) {
      pageController.states.activeAudio?.pause();
    } else {
      playSound(pageController.states.activeAudio);
      // pageController.states.activeAudio?.play();
    }
  }, [pageController.appController.states.preferences.audio]);

  const getPageDataFromAPI = async (pageSlug, textId) => {
    //API Call
    //console.log("getPageDataFromAPI",{pageSlug});
    pageController.states.activeAudio?.pause();
    let response = await BoMOnlineAPI(
      {
        page: pageSlug,
        pageprogress: {
          token: appController.states.user.token,
          slug: [pageSlug],
        },
      },
      { useCache: ["page"] },
    );

    //Update Page via Controller
    let index = pageSlug;
    let keys = Object.keys(response?.page || {});

    if (!response.page[index]) {
      if (keys.includes(pageSlug))
        return getPageDataFromAPI(
          pageSlug
            .split("/")
            .slice(0, -1)
            .join("/"),
          textId,
        );
      index = Object.keys(response.page)
        .filter((a) => RegExp(pageSlug).test(a))
        .shift();
    }

    if (!response.page[index].sections) {
      return document.querySelector(".contents_link a").click();
    } //TODO history.push("/contents");

    pageController.functions.setPageSlugId({
      pageSlug,
      textId,
      lastLeaf: match.url.split("/").pop(),
    });
    pageController.functions.setPageData(response.page[index]);
    pageController.functions.setPageProgress(response.pageprogress);
    if (!pageController.appController.states.studyModeOn) {
      pageController.functions.setLoading(false);
    }
  };

  //Load Page Data in Case of /image/000 or /commentary/0000 loadd
  const getPageDataFromAPIViaNote = async (params) => {
    let { pageSlug, textId } = false;
    if (params.imageId) {
      let response = await BoMOnlineAPI({ image: params.imageId });
      let image = response.image[params.imageId];
      pageSlug = image.location.slug.replace(/\/\d+$/, "");
      textId = image.location.slug.match(/\d+$/)[0];
    }
    if (params.commentaryId) {
      let response = await BoMOnlineAPI({ commentary: params.commentaryId });
      let commentary = response.commentary[params.commentaryId];
      pageSlug = commentary.location?.slug.replace(/\/\d+$/, "");
      textId = commentary.location?.slug.match(/\d+$/)[0];
    }
    if (pageSlug) getPageDataFromAPI(pageSlug, textId);
  };

  const processStudyGroupEventOnPage = (e) => {
    let action = {};
    try {
      action = JSON.parse(e.action);
    } catch (e) {
      return false;
    }
    let { username, key, val } = action;
    if (username === pageController.appController.states.user.user)
      return false;

    //console.log({ key, username, val });

    let processors = {
      updatePagePosition: (username, val) => {
        let { pageSlug, location } = val;
        if (pageSlug === pageController.states.pageSlug)
          pageController.functions.moveStudyBuddies({ username, location });
      },
      exitStudyGroup: (username, val) => {
        if (
          pageController.appController.states.studyGroup.activeGroup.url === val
        ) {
          pageController.functions.moveStudyBuddies({
            username,
            location: null,
          });
        }
      },
      updateTypingLocation: (username, val) => {
        pageController.appController.functions.setTypingLocations({
          username,
          action: val,
        });
      },
    };

    if (processors[key]) processors[key](username, val);
  };

  const loadPageComments = (pageController, setReadyToScroll) => {
    setCommentState("started loading");
    let group = pageController.appController.states.studyGroup.activeGroup;

    let newPageLoad =
      group && pageController.pageData && !pageController.pageComments;

    let switchToOtherGroup =
      group &&
      pageController.pageData &&
      pageController.states.commentGroupId !== group.url;

    const addMessageToPage = (e) => {
      pageController.functions.addToPageComments(e.message);
    };
    const updateMessageToPage = (e) => {
      pageController.functions.updateToPageComment(e.message);
    };

    if (!newPageLoad && !switchToOtherGroup) {
      setReadyToScroll(true);
      return false;
    }

    pageController.functions.setPageComments({
      groupId: null,
      index: null,
      counts: null,
    });

    window.removeEventListener(
      "addMessageToPage-" + pageController.states.pageSlug,
      addMessageToPage,
      false,
    );
    window.addEventListener(
      "addMessageToPage-" + pageController.states.pageSlug,
      addMessageToPage,
      false,
    );
    window.removeEventListener(
      "updateMessageToPage-" + pageController.states.pageSlug,
      updateMessageToPage,
      false,
    );
    window.addEventListener(
      "updateMessageToPage-" + pageController.states.pageSlug,
      updateMessageToPage,
      false,
    );

    window.removeEventListener(
      "fireStudyGroupAction",
      processStudyGroupEventOnPage,
      false,
    );
    window.addEventListener(
      "fireStudyGroupAction",
      processStudyGroupEventOnPage,
      false,
    );

    // create an Observer instance
    const resizeObserver = new ResizeObserver((entries) => {
      if (pageController.states.touched) return null;
      justScroll(pageController);
    });
    resizeObserver.observe(document.querySelector(".main-panel"));

    setCommentState("set Listeners");
    if (!group || !group.createPreviousMessageListQuery) {
      setReadyToScroll(true);
      return false;
    }
    let groupId = group.url;
    var listQuery = group.createPreviousMessageListQuery();
    listQuery.limit = 100;
    listQuery.reverse = false;
    listQuery.includeThreadInfo = true; // Retrieve a list of messages along with their metaarrays.
    listQuery.includeReactions = true; // Retrieve a list of messages along with their reactions.
    listQuery.customTypesFilter = [pageController.pageData?.slug];
    setCommentState("made  query");
    try {
      listQuery.load().then((messages) => {
        setCommentState("indexing");
        let index = indexPageComments(messages);
        setCommentState("counting");
        pageController.functions.setPageComments({
          groupId,
          index,
          counts: null,
        });
        countPageComments(index, pageController, setCommentState).then(
          (counts) => {
            setCommentState("placing");
            pageController.functions.setPageComments({
              groupId,
              index,
              counts,
            });
          },
        );
      });
    } catch (error) {
      console.log({ error });
      return false;
    }
  };

  if(!appController.states.preloaded) return <Loader />;
  if (pageController.states.loading !== false) return <Loader />;
  pageController.appController.functions['setStageClass'] = setStageClass;
  return (
    <>
      {!readyToScroll && needToLoadComments ? (
        <LoadingPageCommentsNotice
          commentState={commentState}
          setReadyToScroll={setReadyToScroll}
        />
      ) : null}
      <div
        className={
          "content page " +
          (readyToScroll || !needToLoadComments ? "ready " : "notready ") +
          (stageClass ? stageClass : "")
        }
        onMouseDown={() => pageController.functions.setTouched(true)}
      >
        <MuteButton pageController={pageController} />
        <Floaters pageController={pageController} />
        <h3 className="title lg-4 text-center">
          {pageController.pageData?.title}
        </h3>

        {pageController.pageData?.sections.map((sectionData, sectionIndex) => {
          sectionData.sectionIndex = sectionIndex;
          return (
            <Section
              key={sectionIndex}
              sectionData={sectionData}
              rowIndex={sectionData}
              pageController={pageController}
            />
          );
        })}
      </div>
    </>
  );
}

function LoadingPageCommentsNotice({ commentState, setReadyToScroll }) {
  //commentState
  return (
    <Alert className="pageInfo" color="info">
      <img src={loading_comments} />
      {label("loading_group_page_comments")}
      <span className="x" onClick={() => setReadyToScroll(true)}>
        ×
      </span>
    </Alert>
  );
}
//<pre>{commentState}</pre>

// function initPage(pageController) {
function initPage(pageController, lastLeaf) {

  if (lastLeaf !== pageController.states.initOpen.pageSlug) {
    let itemToScrollTo = document.getElementById(
      pageController.states.initOpen.pageSlug + "/" + lastLeaf,
    );
    setTimeout(()=>{
      itemToScrollTo.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      });
      setTimeout(pageController.functions.markAsInitiated,1000);
    },1000)
  } else {
    pageController.functions.markAsInitiated();
    pageController.appController.functions.setSlug(
      pageController.states.initOpen.pageSlug,
    );
  }
}

function justScroll(pageController) {
  return false;
  let { itemToScrollTo } = findTextToOpen(pageController);
  let sectionSlug = pageController.states.route.params.pageSlug;
  if (!itemToScrollTo)
    itemToScrollTo = document.querySelector("[id='" + sectionSlug + "']");
  let distance = itemToScrollTo?.offsetTop - 100; //margin

  scrollTo(distance, 0);
}

function initPageItem(pageController, callback) {
  const offsetTop = document.documentElement.clientHeight * 0.2;
  let { textToOpen, itemToScrollTo } = findTextToOpen(pageController);
  let distance = itemToScrollTo?.offsetTop - offsetTop; //margin

  textToOpen = textToOpen.sort();

  //console.log({ itemToScrollTo, textToOpen });

  //Open all of the items (even nested ones)
  let time = 0;
  scrollTo(distance, () => {
    for (let i in textToOpen) {
      if (!textToOpen[i]) return false;
      setTimeout(() => {
        let el = document.querySelector(
          `[textid='${textToOpen[i]}'] .reference a`,
        );
        if (!el || el?.attributes.autoclicked) return false;
        let coords = getCoords(el);
        el?.setAttribute("autoclicked", true);
        //console.log(`AUTO-CLICK ${textToOpen[i]}`)
        scrollTo(coords?.top - offsetTop, () => el?.click());
      }, time);
      time = time + 1000;
    }

    setTimeout(() => pageController.functions.markAsInitiated(), time);
    if (callback) setTimeout(callback, time);
  });
}

function initPageImage(pageController) {
  initPageItem(pageController);
}

function initPageCommentary(pageController) {
  initPageItem(pageController, () =>
    pageController.appController.functions.setPopUp({
      type: "commentary",
      ids: [pageController.states.initOpen.commentaryId],
    }),
  );
}
function initPageFax(pageController) {
  initPageItem(pageController);
}

function findTextToOpen(pageController) {
  if (pageController.states.initOpen.goToSection) {
    return {
      textToOpen: [],
      itemToScrollTo: document.getElementById(
        pageController.states.pageSlug +
          "/" +
          pageController.states.initOpen.goToSection,
      ),
    };
  }

  if (!pageController.states.initOpen.textId) {
    return { textToOpen: [], itemToScrollTo: null };
  }

  let textToOpen = [];
  let textSlug = `${pageController.states.pageSlug}/${pageController.states.initOpen.textId}`;
  let el = document.querySelector(`[textid="${textSlug}"]`);
  let itemToScrollTo = findAncestor(el, ".row");
  let parentSlug = el?.closest(".row > [textid]")?.getAttribute("textid");
  if (parentSlug !== textSlug) textToOpen.push(parentSlug);
  textToOpen.push(textSlug);

  //if (itemToScrollTo = document.querySelectorAll("[id='" + match.params.pageSlug + "']")[0];)
  return { textToOpen, itemToScrollTo };
}

function onScrollPage(pageController) {
  var _sections = document.getElementsByClassName("pagesection");

  window.onscroll = () => {
    // find scroll top position and screen bottom position.
    let scrollerTopPosition = window.scrollY,
      // scrollerButtomPosition = scrollerTopPosition + window.innerHeight,
      windowUpperSectionHeight =
        scrollerTopPosition + (window.innerHeight * 20) / 100,
      sectionId = null;

    let slug,
      title = null;
    for (let i = 0; i < _sections.length; i++) {
      //get section heighr
      let _section = _sections[i],
        elementTop = _section.offsetTop;
      // elementButtom = elementTop + _section.offsetHeight;

      //check section height is less then scrollTop height
      if (scrollerTopPosition <= elementTop) {
        if (windowUpperSectionHeight >= elementTop) {
          slug = _section.id;
          title = _section.attributes?.titletext?.nodeValue || "X?";

          break;
        }
      }
    }
    //update Url
    if (slug && slug !== pageController.states.activeSection) {
      pageController.functions.setTouched(true);
      pageController.functions.setActiveSection({ slug, title });
    }
  };
}

function loadAudioUrl(slug) {
  return `${assetUrl}/audio/${label("lang_code")}/${slug
    .split("/")
    .slice(-2)
    .join("-")}`;
}

function reducer(pageController, input) {
  switch (input.fn) {
    case "setActiveRow":
      let { slug, duration, pagetitle, heading } = input.val;
      pageController.states.activeRow = slug;
      pageController.states.openRows.push(slug);
      if (pageController.states.activeAudio)
        pageController.states.activeAudio?.pause();
      pageController.states.activeAudio = new Audio(loadAudioUrl(slug));

      pageController.states.activeAudio?.addEventListener("ended", (event) => {
        pageController.functions.autoAdvance();
      });

      if (pageController.appController.states.preferences.audio)
        playSound(pageController.states.activeAudio); //.play();
      document.title = heading + " | " + label("home_title");
      pageController.appController.functions.setSlug(slug);

      localStorage.setItem("studybookmark", slug);
      BoMOnlineAPI(
        {
          log: {
            token: pageController.appController.states.user.token,
            key: "block",
            val: slug,
          },
        },
        { useCache: false },
      ).then((r) => {
        let link_index = parseInt(slug.match(/\d+$/).shift());
        let progress = pageController.states.progress || {};
        if (!progress?.started_items) progress["started_items"] = [];
        if (!progress?.completed_items?.includes(link_index))
          progress?.started_items.push(link_index);
        pageController.functions.setPageProgress(progress);
        setTimeout(() => {
          BoMOnlineAPI(
            {
              pageprogress: {
                token: pageController.appController.states.user.token,
                slug: [pageController.pageData.slug],
              },
            },
            { useCache: false },
          ).then((response) => {
            pageController.functions.setPageProgress(response.pageprogress);

            let token = pageController.appController.states.user.token;
            BoMOnlineAPI(
              {
                userprogress: token,
              },
              { useCache: false },
            ).then((r) => {
              let saveMe = r.userprogress?.[token];
              let summary = saveMe.summary;
              if (saveMe)
                pageController.appController.functions.updateUserSummary({
                  ...saveMe,
                  ...{ slug, pagetitle, heading },
                });
              window.clicky?.goal("read");
              // if 100% then show confetti
              if (summary?.completed >= 100)
                pageController.appController.functions.setPopUp({
                  type: "victory",
                  popupData: summary,
                  vhtop: 10,
                });
            });
          });
        }, parseInt(duration) * 900);
        // pageController.appController.functions.updateUserSummary({ ...r.log.progress, ...{ slug, pagetitle, heading } })
      });

      if (pageController.states.init)
        pageController.appController.functions.setSlug(slug);
      break;
    case "addOpenRow":
      pageController.states.openRows.push(input.val);
      break;
    case "removeOpenRow":
      // MODIFY BY ME
      document.title = pageController.pageData.title || label("home_title");
      pageController.appController.functions.setSlug(
        pageController.states.activeSection || pageController.states.pageSlug,
      );
      pageController.states.openRows = pageController.states.openRows.filter(
        (x) => x !== input.val,
      );
      // for (let i in pageController.states.openRows) {
      //     if (pageController.states.openRows[i] === input.val) {
      //         pageController.states.openRows.splice(i, 1);
      //     }
      // }

      if (input.val === pageController.states.activeRow) {
        if (pageController.states.activeAudio)
          pageController.states.activeAudio?.pause();
      }

      break;
    case "setActiveSection":
      let { slug: sectionSlug, title: sectionTitle } = input.val;
      pageController.states.activeSection = sectionSlug;
      if (pageController.states.init || true) {
        document.title =
          sectionTitle || pageController.pageData.title || label("home_title");
        pageController.appController.functions.setSlug(sectionSlug);
      }
      //pageController.appController.functions.setSlug(input.val);
      break;

    case "setPageComments":
      pageController.pageComments = input.val.index;
      pageController.pageCommentCounts = input.val.counts;
      pageController.states.commentGroupId = input.val.groupId;
      pageController.appController.functions.setActivePageController(
        pageController,
      );
      break;
    case "setPageSlug":
      pageController.states.pageSlug = input.val.index;
      break;

    case "addToPageComments":
      pageController.pageComments = addToPageCommentIndex(
        pageController.pageComments,
        input.val,
      );
      // pageController.appController.functions.setActivePageController(pageController);
      break;

    case "moveStudyBuddies":
      if (isMobile()) break;
      let { username, location } = input?.val;
      if (!username) break; //ingnore missing info
      if (pageController.states.studyBuddies[username] === location) break; //ignore non-motion
      pageController.states.studyBuddies[username] = location;
      if (!location) delete pageController.states.studyBuddies[username];
      break;

    case "resetPage":
      pageController.states.initOpen.pageSlug = input.val;
      pageController.states.loading = null;
      break;

    case "setTouched":
      pageController.states.touched = input.val;
      break;

    case "updateToPageComment":
      pageController.pageComments = updateToPageComment(
        pageController.pageComments,
        input.val,
      );
      // pageController.appController.functions.setActivePageController(pageController);
      break;

    case "deleteToPageComments":
      pageController.pageComments = deleteToPageComments(
        pageController.pageComments,
        input.val,
      );
      // pageController.appController.functions.setActivePageController(pageController);
      break;

    case "setPageSlugId":
      pageController.states.pageSlug = input.val.pageSlug;
      if (input.val.textId)
        pageController.states.initOpen.textId = input.val.textId;
      if (input.val.textId) pageController.states.textId = input.val.textId;
      if (input.val.pageSlug)
        pageController.states.initOpen.pageSlug = input.val.pageSlug;
      if (input.val.pageSlug)
        pageController.states.pageSlug = input.val.pageSlug;
      if (input.val.lastLeaf)
        pageController.states.initOpen.lastLeaf = input.val.lastLeaf;
      break;

    case "setInitOpen":
      pageController.states.initOpen = input.val;
      break;

    case "setPageData":
      pageController.pageData = input.val;
      document.title = pageController.pageData?.title || label("home_title");
      break;
    case "setLoading":
      pageController.states.loading = input.val;
      break;
    case "startAudio":
      pageController.states.audioPlaying = true;
      break;
    case "pauseAudio":
      pageController.states.audioPlaying = false;
      break;
    case "setTooltip":
      pageController.states.toolTip = true;
      break;
    case "markAsInitiated":
      pageController.states.init = input.val || true;
      break;
    case "setPageProgress":
      pageController.states.progress = input.val;
      break;
    default:
      break;
  }
  return { ...pageController };
}

function countPageComments(commentsIndex, pageController, setCommentState) {
  //Fax
  let counts = {};
  for (let index in commentsIndex.fax) {
    let parts = index.split(".");
    let [num, ver] = parts;
    if (counts[num] === undefined) counts[num] = {};
    if (counts[num].fax === undefined) counts[num].fax = [];

    counts[num]["fax"].push(ver);
  }

  let q = {};
  if (commentsIndex.com)
    q["commentaryLocations"] = Object.keys(commentsIndex.com);
  if (commentsIndex.img) q["imageLocations"] = Object.keys(commentsIndex.img);

  setCommentState("starting img/com query");
  return BoMOnlineAPI(q).then((r) => {
    setCommentState("counting commentary");
    for (let x in r.commentaryLocations) {
      let num = parseInt(
        r.commentaryLocations[x].location.slug.match(/(.*?)\/(\d+)$/)[2],
      );
      let pageSlug = r.commentaryLocations[x].location.slug.match(
        /(.*?)\/(\d+)$/,
      )[1];
      if (pageSlug !== pageController.pageData?.slug) continue;
      if (counts[num] === undefined) counts[num] = {};
      if (counts[num].com === undefined) counts[num].com = [];
      counts[num]["com"].push(parseInt(x));
    }
    setCommentState("counting images");
    for (let x in r.imageLocations) {
      let num = parseInt(
        r.imageLocations[x].location.slug.match(/(.*?)\/(\d+)$/)[2],
      );
      let pageSlug = r.imageLocations[x].location.slug.match(
        /(.*?)\/(\d+)$/,
      )[1];
      if (pageSlug !== pageController.pageData.slug) continue;
      if (counts[num] === undefined) counts[num] = {};
      if (counts[num].img === undefined) counts[num].img = [];
      counts[num]["img"].push(parseInt(x));
    }
    setCommentState("counted");
    return counts;
  });
}

function indexPageComments(array) {
  let comments = {};
  for (let i in array) {
    let item = array[i];
    if (!testJSON(item.data)) continue;
    let meta = JSON.parse(item.data);
    if (meta.links === undefined) continue;
    let keys = Object.keys(meta.links);
    for (let k in keys) {
      let key = keys[k];
      if (comments[key] === undefined) comments[key] = {};
      comments[key][meta.links[key]] = item;
    }
  }
  return comments;
}

function addToPageCommentIndex(comments, item) {
  if (!comments) comments = {};
  if (!testJSON(item.data)) return comments;
  let meta = JSON.parse(item.data);
  if (!meta.links) return comments;
  let keys = Object.keys(meta.links);
  for (let k in keys) {
    let key = keys[k];
    if (!key) continue;
    if (!comments[key]) comments[key] = {};
    if (!Array.isArray(comments[key][meta[key]]))
      comments[key][meta.links[key]] = [];
    comments[key][meta.links[key]] = item;
  }
  return comments;
}

function updateToPageComment(comments, item) {
  if (!testJSON(item.data)) return comments;
  let meta = JSON.parse(item.data);
  if (meta.links === undefined) return comments;
  let keys = Object.keys(meta.links);
  for (let k in keys) {
    let key = keys[k];
    // if (comments[key] === undefined) comments[key] = {};
    // if (!Array.isArray(comments[key][meta.links[key]])) comments[key][meta.links[key]] = [];
    comments[key][meta.links[key]] = item;
  }
  return comments;
}

function deleteToPageComments(comments, item) {
  if (!testJSON(item.data)) return comments;
  let meta = JSON.parse(item.data);
  if (meta.links === undefined) return comments;
  let keys = Object.keys(meta.links);
  for (let k in keys) {
    let key = keys[k];
    // if (comments[key] === undefined) comments[key] = {};
    // if (!Array.isArray(comments[key][meta.links[key]])) comments[key][meta.links[key]] = [];
    comments[key][meta.links[key]] = [];
  }
  return comments;
}
