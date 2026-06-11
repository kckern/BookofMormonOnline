import { useEffect, useRef, useState } from "react";
import { createScrollManager, step } from "src/scroll";
import { recordDeepLinkEvent } from "src/utils/deepLinkInstrument";
import { orderByDomAncestry } from "src/utils/orderByDomAncestry";

// ONE arbiter for the window: any new campaign — or any user scroll input —
// cancels the campaign in flight. autoAdvance and deep-link init share it.
export const pageScrollManager = createScrollManager({
  onEvent: (e) => recordDeepLinkEvent(`scrollManager:${e.name}`, e),
});

export const isRefOpen = (slug) =>
  !!document
    .querySelector(`[textid="${slug}"] .reference`)
    ?.classList.contains("open");

export function buildOpenList(pageSlug, textId) {
  const textSlug = `${pageSlug}/${textId}`;
  const el = document.querySelector(`[textid="${textSlug}"]`);
  if (!el) return { targetRow: null, openSlugs: [] };
  const targetRow = el.closest(".row");
  const parentSlug = el.closest(".row > [textid]")?.getAttribute("textid");
  const slugs = [];
  if (typeof parentSlug === "string" && parentSlug && parentSlug !== textSlug) {
    slugs.push(parentSlug);
  }
  slugs.push(textSlug);
  return { targetRow, openSlugs: orderByDomAncestry(slugs) };
}

// Pure-ish builder (reads the DOM, mutates nothing): initOpen → campaign steps.
export function buildInitSteps(pageController) {
  const { initOpen, pageSlug, autoClicked } = pageController.states;

  if (initOpen.goToSection) {
    const id = `${pageSlug}/${initOpen.goToSection}`;
    if (!document.getElementById(id)) return { steps: null, reason: "sectionMissing" };
    return { steps: [step.scrollToElement(() => document.getElementById(id))] };
  }

  // Legacy lastLeaf section scroll (old initPage path).
  if (!initOpen.textId && initOpen.lastLeaf && initOpen.lastLeaf !== initOpen.pageSlug) {
    const id = `${initOpen.pageSlug}/${initOpen.lastLeaf}`;
    if (!document.getElementById(id)) return { steps: [] };
    return { steps: [step.scrollToElement(() => document.getElementById(id))] };
  }

  if (!initOpen.textId) return { steps: [] };

  const { targetRow, openSlugs } = buildOpenList(pageSlug, initOpen.textId);
  if (!targetRow || !openSlugs.length) return { steps: null, reason: "verseNotFound" };

  const steps = [step.scrollToElement(() => targetRow)];
  for (const slug of openSlugs) {
    steps.push(
      // Parity: TextContent tags opens as auto when the slug is in autoClicked.
      step.call(() => autoClicked.add(slug)),
      step.openAndAwait(
        () => document.querySelector(`[textid="${slug}"] .reference a`),
        {
          isOpen: () => isRefOpen(slug),
          getContainer: () =>
            document.querySelector(`[textid="${slug}"]`)?.closest(".row"),
        }
      )
    );
  }
  const targetSlug = openSlugs[openSlugs.length - 1];
  steps.push(
    step.scrollToElement(
      () =>
        document.querySelector(`[textid="${targetSlug}"]`)?.closest(".row") ||
        targetRow
    )
  );
  return { steps };
}

// phase: idle → waiting (comments gate) → positioning → ready
export function usePageInit(pageController, { gateOpen, identityKey, onTail }) {
  const [phase, setPhase] = useState("idle");
  const lastRunKey = useRef(null);
  const sawInputWhileWaiting = useRef(false);

  // UC-11: a user already reading during the comments gate must not be yanked.
  useEffect(() => {
    if (phase !== "waiting") return;
    const mark = () => { sawInputWhileWaiting.current = true; };
    const opts = { passive: true, once: true };
    window.addEventListener("wheel", mark, opts);
    window.addEventListener("touchstart", mark, opts);
    return () => {
      window.removeEventListener("wheel", mark, opts);
      window.removeEventListener("touchstart", mark, opts);
    };
  }, [phase]);

  useEffect(() => {
    let disposed = false;
    if (pageController.states.loading !== false) {
      setPhase("idle");
      return undefined;
    }
    if (!gateOpen) {
      setPhase("waiting");
      return undefined;
    }
    // E-13: the same resolved target re-arriving via a URL rewrite (e.g.
    // /image/N → /art/N) must not re-run the pipeline.
    if (lastRunKey.current === identityKey) return undefined;
    lastRunKey.current = identityKey;
    setPhase("positioning");
    // Consume the don't-yank flag once per run — every exit path below must
    // see this run's value, and it must never leak into the next identity.
    const userWasReading = sawInputWhileWaiting.current;
    sawInputWhileWaiting.current = false;
    recordDeepLinkEvent("initPageItem:enter");

    const finish = () => {
      if (disposed) return;
      recordDeepLinkEvent("initPageItem:markAsInitiated");
      pageController.functions.markAsInitiated();
      setPhase("ready");
    };

    const built = buildInitSteps(pageController);
    if (built.steps === null) {
      if (built.reason === "verseNotFound" && pageController.states.initOpen.textId) {
        pageController.functions.setInitWarning({
          type: "verseNotFound",
          slug: `${pageController.states.pageSlug}/${pageController.states.initOpen.textId}`,
        });
      }
      finish();
      return undefined;
    }
    if (!built.steps.length || userWasReading) {
      finish();
      return undefined;
    }
    pageScrollManager.run(built.steps).then(({ status }) => {
      if (!disposed && status === "completed" && onTail) {
        recordDeepLinkEvent("initPageItem:callback");
        onTail();
      }
      finish();
    });
    return () => { disposed = true; };
  }, [gateOpen, identityKey, pageController.states.loading]);

  // Leaving the page (or switching identity) supersedes any in-flight campaign.
  useEffect(() => () => pageScrollManager.cancel("superseded"), [identityKey]);

  return phase;
}
