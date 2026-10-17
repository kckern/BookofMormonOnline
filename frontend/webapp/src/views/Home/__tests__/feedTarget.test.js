import fs from "node:fs";
import path from "node:path";
import { findFeedTarget, scrollToFeedTarget } from "../feedTarget";

// Blind story audit D4 (P1): the Home community pull quote opens
// /home/community/:channel/:messageId, but the message landed below the fold
// with the panel unscrolled. The feed now brings that message into view.
describe("feed target", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  test("finds the feed card carrying the message id", () => {
    document.body.innerHTML = `<div class="homeFeed" data-feed-id="11"></div><div class="homeFeed" data-feed-id="42"></div>`;
    expect(findFeedTarget(document, "42").getAttribute("data-feed-id")).toBe("42");
  });

  test("falls back to a selected comment row (message is a reply)", () => {
    document.body.innerHTML = `<div class="homeFeed" data-feed-id="1"><div class="commentThreadItem selected" id="c"></div></div>`;
    expect(findFeedTarget(document, "99").id).toBe("c");
  });

  test("no message id → no target", () => {
    document.body.innerHTML = `<div class="homeFeed" data-feed-id="1"></div>`;
    expect(findFeedTarget(document, null)).toBeNull();
  });

  test("scrolls the target to the top of its scroller and marks it", () => {
    document.body.innerHTML = `<div class="homeFeed" data-feed-id="42"></div>`;
    const el = document.querySelector("[data-feed-id]");
    el.scrollIntoView = vi.fn();
    expect(scrollToFeedTarget(document, "42")).toBe(true);
    expect(el.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "start" }));
    expect(el.classList.contains("homeFeedTarget")).toBe(true);
  });

  test("returns false when the target is not rendered yet", () => {
    expect(scrollToFeedTarget(document, "42")).toBe(false);
  });

  test("Feed cards carry data-feed-id and HomeFeed scrolls to messageId", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "..", "Feed.js"), "utf8");
    expect(src).toMatch(/data-feed-id=\{item\.id\}/);
    expect(src).toMatch(/scrollToFeedTarget\(/);
  });

  test("the target card gets a gold (not blue) marker", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "..", "StudyGroupFeed.css"), "utf8");
    expect(css).toMatch(/\.homeFeedTarget[^{]*\{[^}]*#c9a24b/i);
  });
});
