import {
  findAncestor,
  scrollTo,
  getCoords,
} from "src/models/Utils";
import { recordDeepLinkEvent } from "src/utils/deepLinkInstrument";
import { orderByDomAncestry } from "src/utils/orderByDomAncestry";
import { awaitDomOpen } from "src/utils/awaitDomOpen";

// function initPage(pageController) {
export function initPage(pageController, lastLeaf) {

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

export async function initPageItem(pageController, callback) {
  recordDeepLinkEvent("initPageItem:enter");
  const offsetTop = document.documentElement.clientHeight * 0.2;
  const { textToOpen: rawTextToOpen, itemToScrollTo } = findTextToOpen(pageController);

  if (!itemToScrollTo || rawTextToOpen.length === 0) {
    recordDeepLinkEvent("initPageItem:noTarget", { rawTextToOpen });
    // Only warn when the user asked for a specific verse but we couldn't find its row.
    // Bare /<pageSlug> routes have no textId set — those are not failures.
    if (pageController.states.initOpen.textId) {
      const slug = `${pageController.states.pageSlug}/${pageController.states.initOpen.textId}`;
      pageController.functions.setInitWarning({ type: "verseNotFound", slug });
    }
    pageController.functions.markAsInitiated();
    if (callback) callback();
    return;
  }

  const ordered = orderByDomAncestry(rawTextToOpen);
  recordDeepLinkEvent("initPageItem:plan", { textToOpen: ordered });

  await scrollToAsync(itemToScrollTo.offsetTop - offsetTop);
  recordDeepLinkEvent("initPageItem:outerScrollDone");

  for (const slug of ordered) {
    const el = document.querySelector(`[textid='${slug}'] .reference a`);
    if (!el) {
      recordDeepLinkEvent("initPageItem:itemSkip", { slug, reason: "missing" });
      continue;
    }
    if (pageController.states.autoClicked.has(slug)) {
      recordDeepLinkEvent("initPageItem:itemSkip", { slug, reason: "already-clicked" });
      continue;
    }
    pageController.states.autoClicked.add(slug);

    const coords = getCoords(el);
    recordDeepLinkEvent("initPageItem:itemScrollStart", { slug });
    await scrollToAsync(coords?.top - offsetTop);
    recordDeepLinkEvent("initPageItem:itemClick", { slug });
    el.click();
    const result = await awaitDomOpen(slug, 2000);
    recordDeepLinkEvent("initPageItem:itemOpened", { slug, result });
  }

  recordDeepLinkEvent("initPageItem:markAsInitiated");
  pageController.functions.markAsInitiated();
  if (callback) {
    recordDeepLinkEvent("initPageItem:callback");
    callback();
  }
}

export function scrollToAsync(distance) {
  return new Promise(resolve => scrollTo(distance, resolve));
}

export function initPageImage(pageController) {
  const imageId = pageController.states.initOpen.imageId;
  initPageItem(pageController, () => {
    pageController.appController.functions.requestImageActivation({ imageId });
  });
}

export function initPageCommentary(pageController) {
  initPageItem(pageController, () =>
    pageController.appController.functions.setPopUp({
      type: "commentary",
      ids: [pageController.states.initOpen.commentaryId],
    }),
  );
}
export function initPageFax(pageController) {
  initPageItem(pageController);
}

export function findTextToOpen(pageController) {
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
