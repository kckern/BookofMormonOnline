const { test, expect } = require("@playwright/test");

test.describe("map event URL routing", () => {
  test("clicking Events on Jershon updates URL to /story/", async ({ page }) => {
    // Filter out pre-existing React warnings unrelated to this fix:
    //  - detectScriptures emits `class=` strings parsed back through React (Invalid DOM property)
    //  - MapStoryPost uses <caption> inside a <div> (validateDOMNesting)
    const IGNORED_CONSOLE_PATTERNS = [
      /Invalid DOM property/,
      /validateDOMNesting/,
    ];
    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (IGNORED_CONSOLE_PATTERNS.some((p) => p.test(text))) return;
      consoleErrors.push(`console.error: ${text}`);
    });

    await page.goto("/map/internal/place/jershon");

    // Wait for the place panel + Events tab to render (Events only appears
    // once placeDetails has loaded AND there is at least one matching story).
    const eventsTab = page.locator(".mapPanel .nav-item", { hasText: "Events" });
    await expect(eventsTab).toBeVisible({ timeout: 15_000 });

    expect(page.url()).toMatch(/\/map\/internal\/place\/jershon$/);

    // Capture every URL transition the moment it happens so we can detect
    // even a brief flash back to /place/. Two sources:
    //  - frame "framenavigated" — fires on real history changes
    //  - a pushState/replaceState shim that records the URL synchronously
    //    on every call, even ones that get superseded a tick later
    const urlLog = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) urlLog.push({ src: "framenav", url: frame.url(), t: Date.now() });
    });
    await page.evaluate(() => {
      window.__urlPushLog = [];
      const wrap = (fnName) => {
        const orig = window.history[fnName].bind(window.history);
        window.history[fnName] = function (...args) {
          window.__urlPushLog.push({ src: fnName, url: String(args[2] ?? ""), t: Date.now() });
          return orig(...args);
        };
      };
      wrap("pushState");
      wrap("replaceState");
    });

    await eventsTab.click();

    // Two possible outcomes:
    // (a) Single matching story → URL jumps straight to /story/:slug.
    // (b) Multiple matching stories → tab content shows .map_story cards;
    //     click the first to navigate.
    // Allow for optional /move/N suffix that the app auto-appends on load.
    const STORY_URL_RE = /\/map\/internal\/story\/[^/]+(\/move\/\d+)?$/;

    const directNavigated = await page
      .waitForURL(STORY_URL_RE, { timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    if (!directNavigated) {
      const firstStory = page.locator(".mapPanel .map_story").first();
      await expect(firstStory).toBeVisible({ timeout: 5_000 });
      await firstStory.click();
      await expect(page).toHaveURL(STORY_URL_RE, { timeout: 5_000 });
    }

    // Let any post-click setSlug/getMap effects fire.
    await page.waitForTimeout(1_500);

    // Final URL is stable on /story/.
    await expect(page).toHaveURL(STORY_URL_RE);

    // Merge framenav events + pushState/replaceState calls in time order
    // and assert that once we land on /story/, nothing pushes us back to
    // /place/jershon — even momentarily.
    const pushes = await page.evaluate(() => window.__urlPushLog);
    const transitions = [...urlLog, ...pushes].sort((a, b) => a.t - b.t);
    // Print so we can see the actual trajectory.
    console.log("URL transitions:\n" + transitions.map((t) => `  [${t.src}] ${t.url}`).join("\n"));
    const firstStoryIdx = transitions.findIndex((t) => /\/story\//.test(t.url));
    expect(firstStoryIdx, `no story URL ever appeared. log: ${JSON.stringify(transitions, null, 2)}`).toBeGreaterThanOrEqual(0);
    const afterStory = transitions.slice(firstStoryIdx + 1);
    const revertIdx = afterStory.findIndex((t) => /\/place\/jershon/.test(t.url));
    expect(
      revertIdx,
      `URL reverted to /place/jershon after navigating to /story/. transitions after story:\n${JSON.stringify(afterStory, null, 2)}`,
    ).toBe(-1);

    // Sanity: the story panel actually rendered (fence cards visible).
    await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 5_000 });

    // Screenshot what we actually rendered so we can eyeball the new layout.
    await page.locator(".mapPanel").screenshot({ path: "../test-results/story-panel.png" });

    // --- New layout assertions (post/fence alternating panel) ---

    // 1. Each fence card represents one movement; verify at least one exists.
    const fenceCount = await page.locator(".mapPanel .map_story_fence").count();
    expect(fenceCount).toBeGreaterThan(0);

    // 2. Posts (place tiles) >= fences + 1.
    //    Normally posts = fences + 1 (shared posts), but discontinuities emit two
    //    back-to-back posts, adding one extra post per gap.
    const postCount = await page.locator(".mapPanel .map_story_post").count();
    expect(postCount).toBeGreaterThanOrEqual(fenceCount + 1);

    // 3. The last fence connects down when another post follows it.
    //    Since there is always a terminus post, the last fence must have .connects.
    const lastFence = page.locator(".mapPanel .map_story_fence").last();
    await expect(lastFence).toHaveClass(/connects/);

    // 4. The terminus post (last post) must NOT have .connects (nothing comes after it).
    const lastPost = page.locator(".mapPanel .map_story_post").last();
    await expect(lastPost).not.toHaveClass(/connects/);

    // 5. At least one post connects below (i.e., has a run-colored line segment).
    const connectingPostCount = await page.locator(".mapPanel .map_story_post.connects").count();
    expect(connectingPostCount).toBeGreaterThanOrEqual(1);

    // 6. Distance badge appears on every fence card.
    const badgeCount = await page.locator(".mapPanel .map_story_distance_badge").count();
    expect(badgeCount).toBeGreaterThanOrEqual(1);
    // One badge per fence.
    expect(badgeCount).toBe(fenceCount);
    // Description text should no longer contain "miles".
    const descTexts = await page.$$eval(
      ".mapPanel .map_story_fence_body",
      (els) => els.map((e) => e.textContent || ""),
    );
    for (const text of descTexts) expect(text).not.toMatch(/\bmiles?\b/i);

    // 7. Travelers header collapses when same as previous row's travelers.
    //    For Ammonites this should produce at least one collapsed row (the
    //    Sons of Mosiah travel together across multiple consecutive moves).
    const travelerHeaderCount = await page
      .locator(".mapPanel .map_story_fence .map_story_fence_body > p > b")
      .count();
    expect(travelerHeaderCount).toBeLessThan(fenceCount);
    expect(travelerHeaderCount).toBeGreaterThanOrEqual(1);

    if (consoleErrors.length) {
      throw new Error("Console errors during test:\n" + consoleErrors.join("\n"));
    }
  });

  test("cold deep-link to /map/internal/story/ammonites does not collapse", async ({ page }) => {
    // Track every URL push so we can prove the URL never gets stomped down
    // to /map/internal (the regression we're guarding against).
    await page.addInitScript(() => {
      window.__pushLog = [];
      const wrap = (n) => {
        const o = window.history[n].bind(window.history);
        window.history[n] = function (...a) {
          window.__pushLog.push(`${n}:${a[2] ?? ""}`);
          return o(...a);
        };
      };
      wrap("pushState");
      wrap("replaceState");
    });

    await page.goto("/map/internal/story/ammonites");
    // Wait for the story panel to actually render so we know data has loaded
    // and all mount-time effects have fired.
    await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
    // Give any straggling setSlug calls a beat to fire.
    await page.waitForTimeout(1_500);

    // URL must still be on /story/ammonites (with optional /move/N suffix).
    await expect(page).toHaveURL(/\/map\/internal\/story\/ammonites(\/move\/\d+)?$/);

    // Nothing should have pushed us to /map/internal (or any non-story URL).
    const pushes = await page.evaluate(() => window.__pushLog);
    const bad = pushes.filter((p) => /pushState|replaceState/.test(p) && !/\/story\//.test(p));
    expect(bad, `unexpected non-story URL pushes:\n${pushes.join("\n")}`).toHaveLength(0);
  });
});
