/**
 * Deep-linked message (/home/community/:channel/:messageId): find its feed
 * card — or, when the message is a reply, its selected comment row — so the
 * feed can bring it into view instead of leaving it below the fold (blind
 * story audit D4).
 */
export function findFeedTarget(root, messageId) {
  if (!root || messageId == null || messageId === "") return null;
  const id = String(messageId).replace(/["\\]/g, "");
  return root.querySelector(`[data-feed-id="${id}"]`) || root.querySelector(".commentThreadItem.selected");
}

const reducedMotion = () => {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  } catch {
    return false;
  }
};

/** Scroll the target to the top of whichever ancestor scrolls; mark it. */
export function scrollToFeedTarget(root, messageId, { smooth = false } = {}) {
  const el = findFeedTarget(root, messageId);
  if (!el || typeof el.scrollIntoView !== "function") return false;
  el.classList.add("homeFeedTarget");
  el.scrollIntoView({ block: "start", inline: "nearest", behavior: smooth && !reducedMotion() ? "smooth" : "auto" });
  return true;
}
