// Study-group comment loading for a page: fetch + index + live window-event
// wiring, gated exactly as the old Page.js loadPageComments was. Extracted per
// audit 2026-07-14 §5.3; fixes §2.13 (listeners were added with per-render
// function identities and never removed on unmount).
import { useEffect, useRef, useState } from "react";
import { recordDeepLinkEvent } from "src/utils/deepLinkInstrument";
import { useMessenger } from "src/contexts/MessengerContext";
import { pageScrollManager } from "./usePageInit";
import { countFaxFromIndex, mergeCounts } from "./pageCommentCounts";
import { indexPageComments } from "./commentIndex";

const COMMENTS_FALLBACK_MS = 2500;

// Socket-fanout study-group actions relevant to this page.
function processStudyGroupEvent(pageController, e) {
  let action = {};
  try {
    action = JSON.parse(e.action);
  } catch (err) {
    return false;
  }
  let { username, key, val } = action;
  if (username === pageController.appController.states.user.user) return false;

  let processors = {
    updatePagePosition: (username, val) => {
      let { pageSlug, location } = val;
      if (pageSlug === pageController.states.pageSlug)
        pageController.functions.moveStudyBuddies({ username, location });
    },
    exitStudyGroup: (username, val) => {
      if (pageController.appController.states.studyGroup.activeGroup.url === val) {
        pageController.functions.moveStudyBuddies({ username, location: null });
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
}

export function usePageComments(pageController) {
  const messenger = useMessenger();
  const [commentState, setCommentState] = useState("init");
  const [readyToScroll, setReadyToScroll] = useState(false);

  // Guards async setState after navigation (see the original Page.js comment).
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const appStates = pageController.appController.states;
  const group = appStates.studyGroup.activeGroup;
  const studyModeisOn = appStates.studyGroup.studyModeOn;
  const needToLoadComments =
    !!appStates.user.user && studyModeisOn && !!group?.url;

  useEffect(() => {
    if (pageController.pageComments) setReadyToScroll(true);
  }, [pageController.pageComments]);

  useEffect(() => {
    if (studyModeisOn) setReadyToScroll(false);
  }, [group?.url]);

  // Live-update listeners, one registration per (page, group), cleaned up on
  // unmount/change. pageController's inner objects are mutated in place by the
  // reducer, so these closures observe current state even across re-renders.
  useEffect(() => {
    if (!group || !pageController.pageData) return undefined;
    const pageSlug = pageController.states.pageSlug;
    const addMessageToPage = (e) =>
      pageController.functions.addToPageComments(e.message);
    const updateMessageToPage = (e) =>
      pageController.functions.updateToPageComment(e.message);
    const onStudyGroupAction = (e) => processStudyGroupEvent(pageController, e);
    window.addEventListener("addMessageToPage-" + pageSlug, addMessageToPage);
    window.addEventListener("updateMessageToPage-" + pageSlug, updateMessageToPage);
    window.addEventListener("fireStudyGroupAction", onStudyGroupAction);
    return () => {
      window.removeEventListener("addMessageToPage-" + pageSlug, addMessageToPage);
      window.removeEventListener("updateMessageToPage-" + pageSlug, updateMessageToPage);
      window.removeEventListener("fireStudyGroupAction", onStudyGroupAction);
    };
  }, [pageController.states.pageSlug, group?.url, !!pageController.pageData]);

  // Fetch + index. Same gates as the old loadPageComments.
  useEffect(() => {
    if (!pageController.pageData) return undefined;
    setCommentState("started loading");
    const newPageLoad = group && !pageController.pageComments;
    const switchToOtherGroup =
      group && pageController.states.commentGroupId !== group.url;
    if (!newPageLoad && !switchToOtherGroup) {
      setReadyToScroll(true);
      return undefined;
    }
    pageController.functions.setPageComments({
      groupId: null,
      index: null,
      counts: null,
    });
    setCommentState("set Listeners");
    const groupId = group.url;
    const fallbackTimer = setTimeout(() => {
      recordDeepLinkEvent("loadPageComments:fallback");
      if (isMounted.current) setReadyToScroll(true);
    }, COMMENTS_FALLBACK_MS);

    if (!messenger?.loadPageComments) {
      clearTimeout(fallbackTimer);
      setReadyToScroll(true);
      return undefined;
    }
    setCommentState("made query");
    messenger
      .loadPageComments(group, pageController.pageData?.slug)
      .then(({ messages, counts }) => {
        clearTimeout(fallbackTimer);
        // Bail if the page unmounted while the fetch was in flight.
        if (!isMounted.current) return;
        setCommentState("indexing");
        const index = indexPageComments(messages);
        // Single paint: index AND counts land in one dispatch (spec P1) — fax
        // counts derive from the index client-side, com/img came from the
        // server. Defer the React paint out of any active scroll campaign so
        // render work never competes with the animation.
        setCommentState("placing");
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
    return () => clearTimeout(fallbackTimer);
  }, [group?.url, pageController.states.pageSlug, pageController.pageData]);

  return { commentState, readyToScroll, setReadyToScroll, needToLoadComments };
}
