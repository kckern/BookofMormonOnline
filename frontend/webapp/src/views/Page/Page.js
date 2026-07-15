/* eslint-disable react-hooks/exhaustive-deps */
import React, { useReducer, useEffect, useState, useRef, useMemo } from "react";
// API ACTIONS
// COMPONENTS
import Loader from "../_Common/Loader";
// CHILD
import Section from "./Section";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import "./Page.css";
import {
  label,
  playSound,
  isMobile,
} from "src/models/Utils";
import { useRouteMatch, useHistory } from "react-router-dom";

import { Floaters } from "./Floaters";
import PageNotFound from "./PageNotFound";
import InitWarning from "./InitWarning";
import { Alert } from "reactstrap";
import loading_comments from "src/views/_Common/Study/svg/loading_comment.svg";
import { MuteButton } from "./MuteButton";
import { usePageInit, pageScrollManager } from "./usePageInit";
import { addToPageCommentIndex, updateToPageComment, deleteToPageComments } from "./commentIndex";
import { usePageComments } from "./usePageComments";
import { setBaseDocTitle, pushDocTitle, popDocTitle } from "./docTitle";
import { createScrollSpy, step } from "src/scroll";
import { appFunctions } from "src/models/appController";
import { useAppController } from "src/contexts/AppControllerContext";
import { PageControllerProvider } from "src/contexts/PageControllerContext";
import ReactTooltip from "react-tooltip";
import { tooltipTheme } from "src/utils/themeColors";

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
  const match = useRouteMatch();
  const history = useHistory();
  let routeParams = match.params;
  if (routeParams.pageSlug === "study") {
    let parts = localStorage
      .getItem("studybookmark")
      ?.split("/")
      .slice(-2) || [null, null];
    routeParams = {
      ...routeParams,
      pageSlug: parts[0] || "lehites",
      textId: parts[1] || 1,
    };
  }

  let initOpen = prepareInitOpen(routeParams);

  const routeKey = `${routeParams.pageSlug || ""}|${routeParams.textId || ""}|${routeParams.commentaryId || ""}|${routeParams.imageId || ""}|${routeParams.faxVersion || ""}`;
  const pageIdentityKey = `${routeParams.pageSlug || ""}|${routeParams.commentaryId || ""}|${routeParams.imageId || ""}`;

  useEffect(() => {
    pageController.functions.setPageData(null);
    // Deep links position the viewport themselves; everything else resets
    // instantly (a smooth scroll here raced the pipeline's scroll — whiplash).
    const i = prepareInitOpen(routeParams);
    const hasScrollTarget = !!(i.textId || i.goToSection || i.commentaryId || i.imageId || i.faxVersion);
    if (!hasScrollTarget) window.scrollTo({ top: 0, behavior: "auto" });
    pageController.functions.setLoading(true);
    if (routeParams.imageId || routeParams.commentaryId)
      getPageDataFromAPIViaNote(routeParams);
    else getPageDataFromAPI(routeParams.pageSlug);
  }, [pageIdentityKey]);

  // Active narration audio lives in a ref (not reducer state): the reducer is
  // replayed by React and must stay side-effect-free, so audio create/pause/play
  // happens in the functions handlers, which reach it through this ref.
  const activeAudioRef = useRef(null);

  // Stage-swap transition class. Declared here (before the functions memo) so
  // the memoized setStageClass handler can close over the stable setter.
  const [stageClass, setStageClass] = useState(null);

  const initialPageState = {
    loading: null,
    init: false,
    activeSection: null,
    activeRow: null,
    commentGroupId: null,
    pageSlug: initOpen.pageSlug,
    textId: null,
    initOpen: initOpen,
    openRows: [],
    studyBuddies: {},
    progress: {},
    autoClicked: new Set(),
    notFound: null,  // { type: "commentary" | "image", id: string } when set
    initWarning: null,  // { type: "verseNotFound", slug?: string } when set
    pageData: null,
    pageComments: null,
    pageCommentCounts: null,
  };
  const [states, dispatch] = useReducer(pageReducer, initialPageState);

  // Live window: stable function closures + async campaign callbacks read
  // CURRENT state through this ref, never a render snapshot.
  const refs = useRef({});
  refs.current = { states, appController };

  const functions = useMemo(() => {
    // Build as `fns` so sibling handlers (e.g. the audio `ended` listener
    // calling autoAdvance) can reference one another through this stable table.
    const fns = {
      setLoading: (val) => {
        dispatch({ fn: "setLoading", val: val });
      },
      markAsInitiated: (val) => {
        dispatch({ fn: "markAsInitiated", val: val });
      },
      autoAdvance: () => {
        if (!refs.current.appController.states.preferences.autoplay)
          return false;
        let parts = refs.current.states.activeRow.split("/").reverse();
        let nextNum = parseInt(parts[0]) + 1;
        parts[0] = nextNum;
        let newSlug = parts.reverse().join("/");
        const getTrigger = () =>
          document.querySelector(`[textid="${newSlug}"] .reference a`);
        if (!getTrigger()) return false;
        // Open first, then scroll to the opened content (the old order
        // centered the link, then the expansion pushed the content
        // off-screen). The anchor's click handler preventDefaults, so no
        // navigation occurs — this campaign is the sole driver, and the
        // shared manager lets user input or a later navigation supersede
        // it cleanly.
        pageScrollManager.run([
          step.openAndAwait(getTrigger, {
            isOpen: () => fns.isRowOpen(newSlug),
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
        setBaseDocTitle(val?.title || label("home_title"));
        dispatch({ fn: "setPageData", val });
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
        const { slug, duration, pagetitle, heading, auto } = val;
        activeAudioRef.current?.pause();
        const audio = new Audio(loadAudioUrl(slug));
        audio.addEventListener("ended", () => fns.autoAdvance());
        activeAudioRef.current = audio;
        if (refs.current.appController.states.preferences.audio) playSound(audio);
        pushDocTitle("row", heading + " | " + label("home_title"));
        // Apply a Main slug change without a nested React dispatch — see
        // applySlug's note. auto opens replace (they're campaign-driven, not
        // user navigation) so Back leaves the page in one press.
        applySlug(refs.current.appController, slug, { replace: auto === true });
        localStorage.setItem("studybookmark", slug);
        dispatch({ fn: "setActiveRow", val: { slug, auto } });
        BoMOnlineAPI(
          { log: { token: refs.current.appController.states.user.token, key: "block", val: slug } },
          { useCache: false },
        ).then(() => {
          const link_index = parseInt(slug.match(/\d+$/).shift());
          const progress = { ...(refs.current.states.progress || {}) };
          progress.started_items = [...(progress.started_items || [])];
          if (!progress.completed_items?.includes(link_index))
            progress.started_items.push(link_index);
          fns.setPageProgress(progress);
          setTimeout(() => {
            BoMOnlineAPI(
              { pageprogress: { token: refs.current.appController.states.user.token, slug: [refs.current.states.pageData.slug] } },
              { useCache: false },
            ).then((response) => {
              fns.setPageProgress(response.pageprogress);
              const token = refs.current.appController.states.user.token;
              BoMOnlineAPI({ userprogress: token }, { useCache: false }).then((r) => {
                const saveMe = r.userprogress?.[token];
                const summary = saveMe?.summary;
                if (saveMe)
                  refs.current.appController.functions.updateUserSummary({ ...saveMe, ...{ slug, pagetitle, heading } });
                window.clicky?.goal("read");
                if (summary?.completed >= 100)
                  refs.current.appController.functions.setPopUp({ type: "victory", popupData: summary, vhtop: 10 });
              });
            });
          }, parseInt(duration) * 900);
        });
      },
      removeOpenRow: (val) => {
        popDocTitle("row");
        applySlug(
          refs.current.appController,
          refs.current.states.activeSection || refs.current.states.pageSlug,
        );
        if (val === refs.current.states.activeRow) activeAudioRef.current?.pause();
        dispatch({ fn: "removeOpenRow", val });
      },
      // THE row-open read API (single source of truth, decision 2026-07-14).
      // Reads live state through refs.current, so it is accurate mid-campaign
      // even though it is a stable closure.
      isRowOpen: (slug) => refs.current.states.openRows.includes(slug),
      setActiveSection: (val) => {
        setBaseDocTitle(val.title || refs.current.states.pageData?.title || label("home_title"));
        // replace, not push: scrolling is not navigation — Back should leave
        // the page in one press.
        applySlug(refs.current.appController, val.slug, { replace: true });
        dispatch({ fn: "setActiveSection", val });
      },
      setPageSlugId: (val) => {
        dispatch({ fn: "setPageSlugId", val: val });
      },
      resetAutoClicked: () => {
        dispatch({ fn: "resetAutoClicked" });
      },
      markAutoClicked: (slug) => dispatch({ fn: "markAutoClicked", val: slug }),
      isAutoClicked: (slug) => refs.current.states.autoClicked.has(slug),
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
        // Environment I/O guard lives in the handler, not the pure reducer.
        if (isMobile()) return;
        dispatch({ fn: "moveStudyBuddies", val });
      },
      setPageProgress: (val) => {
        dispatch({ fn: "setPageProgress", val: val });
      },
      setStageClass,
    };
    return fns;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Plain per-render controller. Identity changes each render (expected — the
  // contexts re-provide it and consumers read fresh). pageData/pageComments/
  // pageCommentCounts live in state and are mirrored as top-level fields so
  // consumers reading pageController.pageData keep working.
  const pageController = {
    states,
    pageData: states.pageData,
    pageComments: states.pageComments,
    pageCommentCounts: states.pageCommentCounts,
    functions,
    appController,
  };

  useEffect(() => {
    return () => {
      activeAudioRef.current?.pause(); // Pause Audio if navigate from another page
    };
  }, []);

  useEffect(() => {
    setReadyToScroll(false);
    dispatch({ fn: "markAsInitiated", val: false });
    pageController.functions.resetAutoClicked();
    pageController.functions.setNotFound(null);
    pageController.functions.setInitWarning(null);
    pageController.appController.functions.requestImageActivation(null);
    const newInitOpen = prepareInitOpen(routeParams);
    pageController.functions.setInitOpen(newInitOpen);
  }, [routeKey]);

  // Guards async setState in getPageDataFromAPI(ViaNote) from firing after the
  // user navigates away — was the source of "Can't perform a React state update
  // on an unmounted component" in Page.
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const { commentState, readyToScroll, setReadyToScroll, needToLoadComments } =
    usePageComments(pageController);

  // Expose this page's comment controller to Main for PopUp/Commentary/Study/
  // Sidebar (was dispatched from the setPageComments reducer case — impure, so
  // it leaked a Main setState into Page's render phase).
  useEffect(() => {
    pageController.appController.functions.setActiveLeafCursorController(
      pageController,
    );
  }, [pageController.pageComments, pageController.pageCommentCounts]);

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
    // Pre-seed tracking locally — the reducer is now immutable, so a write to
    // pageController.states.activeSection would be a lost mutation.
    let lastSeenSection = pageController.states.activeSection;
    const spy = createScrollSpy({
      getSections: () => document.getElementsByClassName("pagesection"),
      onActive: (el) => {
        const slug = el.id;
        const title = el.attributes?.titletext?.nodeValue || null;
        if (!seenFirst) {
          seenFirst = true;
          lastSeenSection = slug;
          return;
        }
        if (slug && slug !== lastSeenSection) {
          lastSeenSection = slug;
          pageController.functions.setActiveSection({ slug, title });
        }
      },
    });
    spy.start();
    return () => spy.stop();
  }, [initPhase, pageController.states.pageSlug]);

  //Audio Settings Changed
  useEffect(() => {
    if (!pageController.appController.states.preferences.audio) {
      activeAudioRef.current?.pause();
    } else {
      playSound(activeAudioRef.current);
      // activeAudioRef.current?.play();
    }
  }, [pageController.appController.states.preferences.audio]);

  const getPageDataFromAPI = async (pageSlug, textId) => {
    //API Call
    //console.log("getPageDataFromAPI",{pageSlug});
    activeAudioRef.current?.pause();
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
      return history.push("/contents");
    }

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

  if(!appController.states.preloaded) return <Loader />;
  if (pageController.states.notFound) {
    return <PageNotFound type={pageController.states.notFound.type} id={pageController.states.notFound.id} />;
  }
  if (pageController.states.loading !== false) return <Loader />;
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
        <ReactTooltip
          effect="solid"
          place="left"
          backgroundColor={tooltipTheme().backgroundColor}
          textColor={tooltipTheme().textColor}
          id="page-info-tooltip"
        />
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

// Pure immutable reducer. Every case returns a NEW state object — no mutation,
// no side effects (side effects live in the functions handlers). Action shape
// stays { fn, val }.
function pageReducer(state, input) {
  switch (input.fn) {
    case "setActiveRow": {
      const { slug, auto } = input.val;
      const openRows = state.openRows.includes(slug)
        ? state.openRows
        : [...state.openRows, slug];
      let autoClicked = state.autoClicked;
      if (auto === true && autoClicked.has(slug)) {
        autoClicked = new Set(autoClicked);
        autoClicked.delete(slug);
      }
      return { ...state, activeRow: slug, openRows, autoClicked };
    }
    case "removeOpenRow":
      return { ...state, openRows: state.openRows.filter((x) => x !== input.val) };
    case "setActiveSection":
      return { ...state, activeSection: input.val.slug };
    case "markAutoClicked": {
      if (state.autoClicked.has(input.val)) return state;
      const autoClicked = new Set(state.autoClicked);
      autoClicked.add(input.val);
      return { ...state, autoClicked };
    }
    case "resetAutoClicked":
      return { ...state, autoClicked: new Set() };
    case "setPageComments":
      return {
        ...state,
        pageComments: input.val.index,
        pageCommentCounts: input.val.counts,
        commentGroupId: input.val.groupId,
      };
    case "addToPageComments":
      return { ...state, pageComments: addToPageCommentIndex(state.pageComments, input.val) };
    case "updateToPageComment":
      return { ...state, pageComments: updateToPageComment(state.pageComments, input.val) };
    case "deleteToPageComments":
      return { ...state, pageComments: deleteToPageComments(state.pageComments, input.val) };
    case "moveStudyBuddies": {
      const { username, location } = input?.val || {};
      if (!username) return state;
      if (state.studyBuddies[username] === location) return state;
      const studyBuddies = { ...state.studyBuddies };
      if (location) studyBuddies[username] = location;
      else delete studyBuddies[username];
      return { ...state, studyBuddies };
    }
    case "setPageSlugId": {
      const next = { ...state, initOpen: { ...state.initOpen } };
      if (input.val.pageSlug) {
        next.pageSlug = input.val.pageSlug;
        next.initOpen.pageSlug = input.val.pageSlug;
      }
      if (input.val.textId) {
        next.textId = input.val.textId;
        next.initOpen.textId = input.val.textId;
      }
      if (input.val.lastLeaf) next.initOpen.lastLeaf = input.val.lastLeaf;
      return next;
    }
    case "setInitOpen":
      return { ...state, initOpen: input.val };
    case "setPageData":
      return { ...state, pageData: input.val };
    case "setPageProgress":
      return { ...state, progress: input.val };
    case "setNotFound":
      return { ...state, notFound: input.val, loading: false };
    case "setInitWarning":
      return { ...state, initWarning: input.val };
    case "setLoading":
      return { ...state, loading: input.val };
    case "markAsInitiated":
      return { ...state, init: input.val || true };
    default:
      return state;
  }
}

