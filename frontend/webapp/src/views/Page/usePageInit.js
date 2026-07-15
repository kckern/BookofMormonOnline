import { useEffect, useRef, useState } from "react";
import { createScrollManager, step } from "src/scroll";
import { recordDeepLinkEvent } from "src/utils/deepLinkInstrument";
import { orderByDomAncestry } from "src/utils/orderByDomAncestry";

// ONE arbiter for the window: any new campaign — or any user scroll input —
// cancels the campaign in flight. autoAdvance and deep-link init share it.
export const pageScrollManager = createScrollManager({
  onEvent: (e) => recordDeepLinkEvent(`scrollManager:${e.name}`, e),
});

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
  const { initOpen, pageSlug } = pageController.states;

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
      // We also emit itemOpened here (in DOM-ancestry order, before this slug's
      // open settles but after every earlier slug's): a call-step is skipped
      // once the campaign is interrupted/superseded, so this only fires for
      // rows the campaign actually reaches, and always precedes the callback
      // (the tail action runs after the final scroll). The deeplink specs
      // assert this slug sequence and the itemOpened→callback ordering.
      step.call(() => {
        pageController.functions.markAutoClicked(slug);
        recordDeepLinkEvent("initPageItem:itemOpened", { slug });
      }),
      step.openAndAwait(
        () => document.querySelector(`[textid="${slug}"] .reference a`),
        {
          isOpen: () => pageController.functions.isRowOpen(slug),
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

// The verse rows (`[textid]`) render a few frames AFTER `loading` flips false
// and AFTER the deep-link target (textId) resolves — the Page renders its
// sections in a later commit than the one that wakes this effect. Building the
// campaign immediately would measure an empty DOM and (wrongly) report
// verseNotFound. So when a specific target is expected, poll for its element to
// appear before building. Resolves true once present, false on timeout.
const EXPECTED_TARGET_TIMEOUT_MS = 4000;
function expectedTargetSelector({ initOpen, pageSlug }) {
  if (initOpen.goToSection) return `[id="${pageSlug}/${initOpen.goToSection}"]`;
  if (initOpen.textId) return `[textid="${pageSlug}/${initOpen.textId}"]`;
  if (!initOpen.textId && initOpen.lastLeaf && initOpen.lastLeaf !== initOpen.pageSlug)
    return `[id="${initOpen.pageSlug}/${initOpen.lastLeaf}"]`;
  return null; // no specific target — nothing to wait for
}
export function awaitTargetPresent(selector, { isDisposed, timeoutMs = EXPECTED_TARGET_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    if (!selector || document.querySelector(selector)) return resolve(true);
    let rafId = null;
    let timer = null;
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (timer) clearTimeout(timer);
      resolve(v);
    };
    const tick = () => {
      if (isDisposed && isDisposed()) return finish(false);
      if (document.querySelector(selector)) return finish(true);
      rafId = window.requestAnimationFrame(tick);
    };
    timer = setTimeout(() => finish(false), timeoutMs);
    rafId = window.requestAnimationFrame(tick);
  });
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
    // /commentary/<id> and /image/<id> arrive with no textId/pageSlug; those
    // resolve asynchronously (getPageDataFromAPIViaNote → setPageSlugId) and
    // re-fire this effect with a richer identityKey. Don't run — and don't
    // consume the identity or markAsInitiated — until the host target has been
    // resolved, or the real campaign's identity would be pre-empted by this
    // placeholder one.
    const { initOpen } = pageController.states;
    const targetPending =
      (initOpen.commentaryId || initOpen.imageId) && !initOpen.textId;
    if (targetPending) return undefined;

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

    const runCampaign = () => {
      if (disposed) return;
      const built = buildInitSteps(pageController);
      if (built.steps === null) {
        if (built.reason === "verseNotFound" && pageController.states.initOpen.textId) {
          pageController.functions.setInitWarning({
            type: "verseNotFound",
            slug: `${pageController.states.pageSlug}/${pageController.states.initOpen.textId}`,
          });
        }
        finish();
        return;
      }
      if (!built.steps.length || userWasReading) {
        finish();
        return;
      }
      pageScrollManager.run(built.steps).then(({ status }) => {
        if (!disposed && status === "completed" && onTail) {
          recordDeepLinkEvent("initPageItem:callback");
          onTail();
        }
        finish();
      });
    };

    // Wait for the expected target row to render before building (it lands a
    // few frames after this effect wakes). No expected target → run now.
    const selector = expectedTargetSelector(pageController.states);
    awaitTargetPresent(selector, { isDisposed: () => disposed }).then(runCampaign);

    return () => { disposed = true; };
  }, [gateOpen, identityKey, pageController.states.loading]);

  // Leaving the page (or switching identity) supersedes any in-flight campaign.
  useEffect(() => () => pageScrollManager.cancel("superseded"), [identityKey]);

  return phase;
}
