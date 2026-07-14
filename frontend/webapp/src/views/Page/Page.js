/* eslint-disable react-hooks/exhaustive-deps */
import React, { useReducer, useEffect, useState, useRef } from "react";
// BROWSER HISTORY
// API ACTIONS
// COMPONENTS
import Loader from "../_Common/Loader";
// CHILD
import Section from "./Section";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import "./Page.css";
import {
  testJSON,
  label,
  playSound,
  isMobile,
} from "src/models/Utils";
import { useRouteMatch } from "react-router-dom";

import { Floaters } from "./Floaters";
import PageNotFound from "./PageNotFound";
import InitWarning from "./InitWarning";
import { Alert } from "reactstrap";
import loading_comments from "src/views/_Common/Study/svg/loading_comment.svg";
import { MuteButton } from "./MuteButton";
import { recordDeepLinkEvent } from "src/utils/deepLinkInstrument";
import { usePageInit, pageScrollManager, isRefOpen } from "./usePageInit";
import { countFaxFromIndex, mergeCounts } from "./pageCommentCounts";
import { createScrollSpy, step } from "src/scroll";
import { appFunctions } from "src/models/appController";
import { useAppController } from "src/contexts/AppControllerContext";
import { useMessenger } from "src/contexts/MessengerContext";
import { PageControllerProvider } from "src/contexts/PageControllerContext";

// Apply a Main slug change from inside the Page reducer WITHOUT a nested React
// dispatch. The reducer is replayed by React during render; the old
// `appController.functions.setSlug(...)` re-dispatched into Main's reducer on
// every replay, firing "Cannot update a component (Main) while rendering Page".
// Calling the sibling reducer directly mutates the same draft + drives
// history navigation, but schedules no Main setState during render.
function applySlug(appController, slug, opts) {
  appFunctions.setSlug(appController, { val: slug, replace: opts?.replace === true });
}

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

export default function Page() {
  const appController = useAppController();
  const messenger = useMessenger();
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

  const routeKey = `${match.params.pageSlug || ""}|${match.params.textId || ""}|${match.params.commentaryId || ""}|${match.params.imageId || ""}|${match.params.faxVersion || ""}`;
  const pageIdentityKey = `${match.params.pageSlug || ""}|${match.params.commentaryId || ""}|${match.params.imageId || ""}`;

  useEffect(() => {
    pageController.functions.setPageData(null);
    // Deep links position the viewport themselves; everything else resets
    // instantly (a smooth scroll here raced the pipeline's scroll — whiplash).
    const i = prepareInitOpen(match.params);
    const hasScrollTarget = !!(i.textId || i.goToSection || i.commentaryId || i.imageId || i.faxVersion);
    if (!hasScrollTarget) window.scrollTo({ top: 0, behavior: "auto" });
    pageController.functions.setLoading(true);
    if (match.params.imageId || match.params.commentaryId)
      getPageDataFromAPIViaNote(match.params);
    else getPageDataFromAPI(match.params.pageSlug);
  }, [pageIdentityKey]);

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
        pageSlug: initOpen.pageSlug,
        textId: null,
        route: match,
        initOpen: initOpen,
        openRows: [],
        studyBuddies: {},
        progress: {},
        autoClicked: new Set(),
        notFound: null,  // { type: "commentary" | "image", id: string } when set
        initWarning: null,  // { type: "verseNotFound", slug?: string } when set
      };
      //Define all Row-level functions
      let functions = {
        setLoading: (val) => {
          dispatch({ fn: "setLoading", val: val });
        },
        markAsInitiated: (val) => {
          dispatch({ fn: "markAsInitiated", val: val });
        },
        autoAdvance: () => {
          if (!pageController.appController.states.preferences.autoplay)
            return false;
          let parts = pageController.states.activeRow.split("/").reverse();
          let nextNum = parseInt(parts[0]) + 1;
          parts[0] = nextNum;
          let newSlug = parts.reverse().join("/");
          const getTrigger = () =>
            document.querySelectorAll(`a[href='/${newSlug}']`)[0];
          if (!getTrigger()) return false;
          // Open first, then scroll to the opened content (the old order
          // centered the link, then the expansion pushed the content
          // off-screen). The anchor's click handler preventDefaults, so no
          // navigation occurs — this campaign is the sole driver, and the
          // shared manager lets user input or a later navigation supersede
          // it cleanly.
          pageScrollManager.run([
            step.openAndAwait(getTrigger, {
              isOpen: () => isRefOpen(newSlug),
              getContainer: () =>
                document.querySelector(`[textid="${newSlug}"]`)?.closest(".row") ||
                getTrigger(),
            }),
            step.scrollToElement(
              () =>
                document.querySelector(`[textid="${newSlug}"]`)?.closest(".row") ||
                getTrigger()
            ),
          ]);
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
        resetAutoClicked: () => {
          dispatch({ fn: "resetAutoClicked" });
        },
        setNotFound: (val) => {
          dispatch({ fn: "setNotFound", val: val });
        },
        setInitWarning: (val) => {
          dispatch({ fn: "setInitWarning", val: val });
        },
        setInitOpen: (val) => {
          dispatch({ fn: "setInitOpen", val: val });
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
    dispatch({ fn: "markAsInitiated", val: false });
    pageController.functions.resetAutoClicked();
    pageController.functions.setNotFound(null);
    pageController.functions.setInitWarning(null);
    pageController.appController.functions.requestImageActivation(null);
    const newInitOpen = prepareInitOpen(match.params);
    pageController.functions.setInitOpen(newInitOpen);
  }, [routeKey]);

  const studyModeisOn =
    pageController.appController.states.studyGroup.studyModeOn;
  const userIsLoggedIn = !!pageController.appController.states.user.user;
  const hasActiveGroup = !!pageController.appController.states.studyGroup
    .activeGroup?.url;
  const needToLoadComments = userIsLoggedIn && studyModeisOn && hasActiveGroup;
  const [readyToScroll, setReadyToScroll] = useState(false);
  const [stageClass, setStageClass] = useState(null);

  // Guards async setState in loadPageComments (.then/.catch/setTimeout/
  // waitForIdle) from firing after the user navigates away — was the source of
  // "Can't perform a React state update on an unmounted component" in Page.
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (pageController.pageComments) setReadyToScroll(true);
  }, [pageController.pageComments]);
  // Expose this page's comment controller to Main for PopUp/Commentary/Study/
  // Sidebar (was dispatched from the setPageComments reducer case — impure, so
  // it leaked a Main setState into Page's render phase).
  useEffect(() => {
    pageController.appController.functions.setActiveLeafCursorController(
      pageController,
    );
  }, [pageController.pageComments, pageController.pageCommentCounts]);
  useEffect(() => {
    if (pageController.appController.states.studyGroup.studyModeOn)
      setReadyToScroll(false);
  }, [pageController.appController.states.studyGroup.activeGroup?.url]);

  // Deep-link / section positioning, gated on the study-mode comments load.
  const gateOpen = !needToLoadComments || readyToScroll;
  const initIdentityKey = [
    pageController.states.initOpen.pageSlug || "",
    pageController.states.initOpen.textId || "",
    pageController.states.initOpen.goToSection || "",
    // lastLeaf is exclusively the legacy (no-textId) fallback target. It is
    // injected later than the rest of initOpen (setPageSlugId, after the API
    // resolves), so folding it in unconditionally would re-key once it lands.
    // Only the fallback path consumes it, so only the fallback path keys on it.
    pageController.states.initOpen.textId ? "" : (pageController.states.initOpen.lastLeaf || ""),
    pageController.states.initOpen.commentaryId || "",
    pageController.states.initOpen.imageId || "",
    pageController.states.initOpen.faxVersion || "",
  ].join("|");
  const onTail = pageController.states.initOpen.commentaryId
    ? () =>
        pageController.appController.functions.setPopUp({
          type: "commentary",
          ids: [pageController.states.initOpen.commentaryId],
        })
    : pageController.states.initOpen.imageId
    ? () =>
        pageController.appController.functions.requestImageActivation({
          imageId: pageController.states.initOpen.imageId,
        })
    : null;
  const initPhase = usePageInit(pageController, { gateOpen, identityKey: initIdentityKey, onTail });

  // Active-section tracking — enabled only once init has settled (the old
  // window.onscroll spy attached mid-animation and leaked across views).
  useEffect(() => {
    if (initPhase !== "ready") return undefined;
    // The IntersectionObserver fires immediately on mount for any section
    // already in the viewport. Skip the very first callback to avoid
    // replacing the just-established URL (popup, verse, etc.) before the
    // user has actually scrolled anywhere.
    let seenFirst = false;
    const spy = createScrollSpy({
      getSections: () => document.getElementsByClassName("pagesection"),
      onActive: (el) => {
        const slug = el.id;
        const title = el.attributes?.titletext?.nodeValue || null;
        if (!seenFirst) {
          seenFirst = true;
          // Pre-seed the active section so future callbacks only fire on change.
          pageController.states.activeSection = slug;
          return;
        }
        if (slug && slug !== pageController.states.activeSection) {
          pageController.functions.setActiveSection({ slug, title });
        }
      },
    });
    spy.start();
    return () => spy.stop();
  }, [initPhase, pageController.states.pageSlug]);

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

    // Navigated away while the page fetch was in flight — bail before
    // dispatching, or these updates warn "update on an unmounted component".
    if (!isMounted.current) return;

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
    try {
      let { pageSlug, textId } = false;
      if (params.imageId) {
        let response = await BoMOnlineAPI({ image: params.imageId });
        if (!isMounted.current) return;
        let image = response?.image?.[params.imageId];
        if (!image?.location?.slug) {
          pageController.functions.setNotFound({ type: "image", id: params.imageId });
          return;
        }
        pageSlug = image.location.slug.replace(/\/\d+$/, "");
        textId = image.location.slug.match(/\d+$/)?.[0];
      }
      if (params.commentaryId) {
        let response = await BoMOnlineAPI({ commentary: params.commentaryId });
        if (!isMounted.current) return;
        let commentary = response?.commentary?.[params.commentaryId];
        if (!commentary?.location?.slug) {
          pageController.functions.setNotFound({ type: "commentary", id: params.commentaryId });
          return;
        }
        pageSlug = commentary.location.slug.replace(/\/\d+$/, "");
        textId = commentary.location.slug.match(/\d+$/)?.[0];
      }
      if (pageSlug) getPageDataFromAPI(pageSlug, textId);
    } catch (err) {
      console.error("getPageDataFromAPIViaNote failed", err);
      const type = params.imageId ? "image" : "commentary";
      const id = params.imageId || params.commentaryId;
      pageController.functions.setNotFound({ type, id });
    }
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

    setCommentState("set Listeners");
    let groupId = group.url;
    const COMMENTS_FALLBACK_MS = 2500;
    const fallbackTimer = setTimeout(() => {
      recordDeepLinkEvent("loadPageComments:fallback");
      if (isMounted.current) setReadyToScroll(true);
    }, COMMENTS_FALLBACK_MS);

    if (!messenger?.loadPageComments) {
      clearTimeout(fallbackTimer);
      setReadyToScroll(true);
      return false;
    }
    setCommentState("made query");
    messenger
      .loadPageComments(group, pageController.pageData?.slug)
      .then(({ messages, counts }) => {
        clearTimeout(fallbackTimer);
        // Bail if the page unmounted (navigated away) while the fetch was in
        // flight — these setState/dispatch calls would warn "update on an
        // unmounted component".
        if (!isMounted.current) return;
        setCommentState("indexing");
        const index = indexPageComments(messages);
        // Single paint: index AND counts land in one dispatch (spec P1) —
        // fax counts derive from the index client-side, com/img came from
        // the server.
        setCommentState("placing");
        // Zero-layout-shift by construction (badges/bubbles are absolute,
        // notice is fixed) — but defer the React paint out of any active
        // scroll campaign so render work never competes with the animation.
        // Deep-link inits gate the campaign on readyToScroll, so this is
        // instant there; it only waits on autoAdvance/fallback overlaps.
        pageScrollManager.waitForIdle().then(() => {
          if (!isMounted.current) return;
          recordDeepLinkEvent("pageComments:placed");
          pageController.functions.setPageComments({
            groupId,
            index,
            counts: mergeCounts(counts, countFaxFromIndex(index)),
          });
        });
      })
      .catch((error) => {
        clearTimeout(fallbackTimer);
        console.log({ error });
        if (isMounted.current) setReadyToScroll(true);
      });
  };

  if(!appController.states.preloaded) return <Loader />;
  if (pageController.states.notFound) {
    return <PageNotFound type={pageController.states.notFound.type} id={pageController.states.notFound.id} />;
  }
  if (pageController.states.loading !== false) return <Loader />;
  pageController.appController.functions['setStageClass'] = setStageClass;
  return (
    <PageControllerProvider pageController={pageController}>
      {!readyToScroll && needToLoadComments ? (
        <LoadingPageCommentsNotice
          commentState={commentState}
          setReadyToScroll={setReadyToScroll}
        />
      ) : null}
      <InitWarning
        warning={pageController.states.initWarning}
        onDismiss={() => pageController.functions.setInitWarning(null)}
      />
      <div
        className={
          "content page " +
          (readyToScroll || !needToLoadComments ? "ready " : "notready ") +
          (stageClass ? stageClass : "")
        }
      >
        <MuteButton />
        <Floaters />
        <h3 className="title lg-4 text-center">
          {pageController.pageData?.title}
        </h3>

        {pageController.pageData?.sections.map((sectionData, sectionIndex) => (
          <Section
            key={sectionIndex}
            sectionData={sectionData}
            sectionIndex={sectionIndex}
          />
        ))}
      </div>
    </PageControllerProvider>
  );
}

function LoadingPageCommentsNotice({ commentState, setReadyToScroll }) {
  //commentState
  return (
    <Alert className="pageInfo" color="info">
      <img src={loading_comments} alt="" />
      {label("loading_group_page_comments")}
      <span className="x" onClick={() => setReadyToScroll(true)}>
        ×
      </span>
    </Alert>
  );
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
      let { slug, duration, pagetitle, heading, auto } = input.val;
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
      applySlug(pageController.appController, slug, { replace: auto === true });
      if (auto === true) pageController.states.autoClicked.delete(slug);

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
              let summary = saveMe?.summary;
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
      });

      if (pageController.states.init) {
        applySlug(pageController.appController, slug, { replace: auto === true });
        if (auto === true) pageController.states.autoClicked.delete(slug);
      }
      break;
    case "addOpenRow":
      pageController.states.openRows.push(input.val);
      break;
    case "removeOpenRow":
      document.title = pageController.pageData.title || label("home_title");
      applySlug(
        pageController.appController,
        pageController.states.activeSection || pageController.states.pageSlug,
      );
      pageController.states.openRows = pageController.states.openRows.filter(
        (x) => x !== input.val,
      );

      if (input.val === pageController.states.activeRow) {
        if (pageController.states.activeAudio)
          pageController.states.activeAudio?.pause();
      }

      break;
    case "setActiveSection":
      let { slug: sectionSlug, title: sectionTitle } = input.val;
      pageController.states.activeSection = sectionSlug;
      document.title =
        sectionTitle || pageController.pageData.title || label("home_title");
      // replace, not push: scrolling is not navigation — Back should leave
      // the page in one press. (The old `|| true` made the init guard dead.)
      applySlug(pageController.appController, sectionSlug, { replace: true });
      break;

    case "setPageComments":
      pageController.pageComments = input.val.index;
      pageController.pageCommentCounts = input.val.counts;
      pageController.states.commentGroupId = input.val.groupId;
      // NOTE: exposing this pageController to Main (setActiveLeafCursorController)
      // is a side effect and must NOT live in the reducer — React re-invokes
      // reducers during render, which fired a Main setState mid-Page-render
      // ("Cannot update a component (Main) while rendering Page"). Done in an
      // effect instead (see the effect keyed on pageController.pageComments).
      break;

    case "addToPageComments":
      pageController.pageComments = addToPageCommentIndex(
        pageController.pageComments,
        input.val,
      );
      break;

    case "moveStudyBuddies":
      if (isMobile()) break;
      let { username, location } = input?.val;
      if (!username) break; //ingnore missing info
      if (pageController.states.studyBuddies[username] === location) break; //ignore non-motion
      pageController.states.studyBuddies[username] = location;
      if (!location) delete pageController.states.studyBuddies[username];
      break;

    case "updateToPageComment":
      pageController.pageComments = updateToPageComment(
        pageController.pageComments,
        input.val,
      );
      break;

    case "deleteToPageComments":
      pageController.pageComments = deleteToPageComments(
        pageController.pageComments,
        input.val,
      );
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

    case "resetAutoClicked":
      pageController.states.autoClicked = new Set();
      break;

    case "setInitOpen":
      pageController.states.initOpen = input.val;
      break;

    case "setPageData":
      pageController.pageData = input.val;
      document.title = pageController.pageData?.title || label("home_title");
      break;
    case "setNotFound":
      pageController.states.notFound = input.val;
      pageController.states.loading = false;
      break;
    case "setInitWarning":
      pageController.states.initWarning = input.val;
      break;
    case "setLoading":
      pageController.states.loading = input.val;
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
