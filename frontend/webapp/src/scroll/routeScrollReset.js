// Page-change scroll handling for the SPA shell.
//
// The app shell stays mounted across route changes and only its contents are
// swapped, so without this the new page inherits the old page's scroll offset:
// open Preferences from a scrolled-down chapter and you land mid-page. And
// since each view re-renders its content asynchronously, Back never got its
// position back either (the page is too short to hold the old offset when the
// browser tries).
//
// "Different page" is the section, not the full path. Several views push URLs
// while you stay on them (Read rewrites /read/<slug> as you scroll, the fax
// viewer pushes per page, the map pushes per story) and already manage their
// own scroll; resetting on every push would yank the reader back to the top.

import { createAbortToken } from "./scrollCampaign";

const RESTORE_TIMEOUT_MS = 3000;

// The section a pathname belongs to. /home is a shell with tabs, and its tabs
// have sub-pages, so both are part of the section: /home/user,
// /home/user/preferences and /home/feed/<channel> are each their own page.
export function sectionKey(pathname) {
  const seg = (pathname || "/").split("/").filter(Boolean);
  if (seg[0] === "home") return seg.slice(0, 3).join("/");
  return seg[0] || "";
}

// What to do with scroll after a navigation: "top", "restore" or null.
// - PUSH to another page: top.
// - POP (back/forward) to another page: restore that entry's saved position.
// - REPLACE is a URL correction or redirect of a page already on screen: none.
// - A #hash names its own target: none.
// - Same page (in-section navigation): none; the view owns it.
export function scrollAction({ prevPathname, pathname, hash, navigationType }) {
  if (hash || prevPathname == null) return null;
  if (sectionKey(prevPathname) === sectionKey(pathname)) return null;
  if (navigationType === "PUSH") return "top";
  if (navigationType === "POP") return "restore";
  return null;
}

export function resetScroll(doc = document, win = window) {
  win.scrollTo(0, 0);
  const panel = doc.getElementById("main-panel");
  if (panel) panel.scrollTop = 0;
}

// Scroll back to y once the re-rendered page is tall enough to hold it.
// Gives up (without moving) if the user scrolls first or the token aborts;
// on timeout, goes as far as the page allows.
export function restoreScroll(y, { token = createAbortToken(), timeoutMs = RESTORE_TIMEOUT_MS } = {}) {
  if (!(y > 0)) return token;
  const userInput = () => token.abort("user");
  const inputs = ["wheel", "touchstart", "keydown", "mousedown"];
  inputs.forEach((t) => window.addEventListener(t, userInput, { passive: true, once: true }));
  const maxY = () => document.documentElement.scrollHeight - window.innerHeight;
  const deadline = Date.now() + timeoutMs;
  let rafId = null;
  const cleanup = () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    inputs.forEach((t) => window.removeEventListener(t, userInput));
  };
  token.onAbort(cleanup);
  const tick = () => {
    if (token.aborted) return;
    if (maxY() >= y || Date.now() >= deadline) {
      window.scrollTo(0, Math.min(y, Math.max(0, maxY())));
      cleanup();
      return;
    }
    rafId = window.requestAnimationFrame(tick);
  };
  rafId = window.requestAnimationFrame(tick);
  return token;
}
