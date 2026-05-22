const { test, expect } = require("@playwright/test");

const IGNORED = [
  /Invalid DOM property/,
  /validateDOMNesting/,
  // Pre-existing: some map tiles are missing from the dev media server.
  /Failed to load resource/,
];

function attachConsole(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (IGNORED.some((p) => p.test(t))) return;
    errors.push(`console.error: ${t}`);
  });
  return errors;
}

// sons-of-mosiah has seq values 1–14, so seq 1 is the first row and seq 3 is at array index 2.
test("default selection: /story/X selects move 1", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah");
  const firstFence = page.locator(".mapPanel .map_story_fence").first();
  await expect(firstFence).toBeVisible({ timeout: 15_000 });
  await expect(firstFence).toHaveClass(/selected/);
  if (errors.length) throw new Error(errors.join("\n"));
});

test("explicit selection: /story/X/move/3 selects fence with data-seq=3", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/3");
  const targetFence = page.locator(".mapPanel .map_story_fence[data-seq='3']");
  await expect(targetFence).toBeVisible({ timeout: 15_000 });
  await expect(targetFence).toHaveClass(/selected/);
  if (errors.length) throw new Error(errors.join("\n"));
});

test("panel alternates post and fence, posts ≥ fences + 1", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/1");
  await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
  const sequence = await page.$$eval(
    ".mapPanel .map_story_post, .mapPanel .map_story_fence",
    (els) => els.map((e) => (e.classList.contains("map_story_post") ? "P" : "F")),
  );
  expect(sequence.length).toBeGreaterThan(0);
  expect(sequence[0]).toBe("P");
  expect(sequence[sequence.length - 1]).toBe("P");
  const postCount = sequence.filter((s) => s === "P").length;
  const fenceCount = sequence.filter((s) => s === "F").length;
  expect(postCount).toBeGreaterThanOrEqual(fenceCount + 1);
  // sons-of-mosiah has 14 moves; with at least one shared post, postCount is at most 15.
  expect(fenceCount).toBe(14);
  if (errors.length) throw new Error(errors.join("\n"));
});

test("floating avatars render for the selected move", async ({ browser }) => {
  // bom_map_move_people is unpopulated in the dev DB (reader user, read-only).
  // The CRA app installs a Service Worker that intercepts the mapstories
  // request before Playwright's default route handler can see it. We need
  // serviceWorkers:'block' so that page.route() can intercept and inject
  // people data for the first move of sons-of-mosiah.
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = attachConsole(page);

  await page.route("http://localhost:8200/en", async (route) => {
    const req = route.request();
    let body = {};
    try { body = JSON.parse(req.postData() || "{}"); } catch (_) {}
    const isMapstories = typeof body.query === "string" && body.query.includes("mapstories");
    if (!isMapstories) {
      await route.continue();
      return;
    }
    const resp = await route.fetch();
    const json = await resp.json();
    const stories = json?.data?.mapstories;
    if (Array.isArray(stories)) {
      const story = stories.find((s) => s.slug === "sons-of-mosiah");
      if (story?.moves?.[0]) {
        story.moves[0].people = [
          { slug: "ammon1", name: "Ammon" },
          { slug: "aaron1", name: "Aaron" },
        ];
      }
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(json) });
  });

  await page.goto("http://localhost:8200/map/internal/story/sons-of-mosiah");
  const avatars = page.locator(".mapPanel .map_story_avatars");
  await expect(avatars).toHaveCount(1, { timeout: 15_000 });
  const imgs = avatars.locator("img");
  const imgCount = await imgs.count();
  expect(imgCount).toBeGreaterThanOrEqual(1);
  // Each img must point at /people/<slug>
  const srcs = await imgs.evaluateAll((els) => els.map((e) => e.getAttribute("src") || ""));
  for (const s of srcs) expect(s).toMatch(/\/people\//);
  await context.close();
  if (errors.length) throw new Error(errors.join("\n"));
});

test("avatars slide: top changes when selection moves", async ({ browser }) => {
  // bom_map_move_people is unpopulated in the dev DB — mirror Task 3's SW-block
  // + route intercept to inject people on ALL moves so .map_story_avatars exists
  // at both the initial position (move 1) and after clicking (move 3).
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = attachConsole(page);

  const mockPeople = [
    { slug: "ammon1", name: "Ammon" },
    { slug: "aaron1", name: "Aaron" },
  ];

  await page.route("http://localhost:8200/en", async (route) => {
    const req = route.request();
    let body = {};
    try { body = JSON.parse(req.postData() || "{}"); } catch (_) {}
    const isMapstories = typeof body.query === "string" && body.query.includes("mapstories");
    if (!isMapstories) {
      await route.continue();
      return;
    }
    const resp = await route.fetch();
    const json = await resp.json();
    const stories = json?.data?.mapstories;
    if (Array.isArray(stories)) {
      const story = stories.find((s) => s.slug === "sons-of-mosiah");
      if (story?.moves) {
        // Inject people on every move so the avatars element exists regardless
        // of which move is selected.
        story.moves.forEach((move) => { move.people = mockPeople; });
      }
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(json) });
  });

  await page.goto("http://localhost:8200/map/internal/story/sons-of-mosiah");
  const avatars = page.locator(".mapPanel .map_story_avatars");
  await expect(avatars).toBeVisible({ timeout: 15_000 });

  // Record top at default selection (move 1).
  const topAt1 = await avatars.evaluate((el) => el.getBoundingClientRect().top);

  // Click move 3 fence.
  await page.locator(".mapPanel .map_story_fence[data-seq='3']").click();
  await expect(page).toHaveURL(/\/move\/3$/, { timeout: 5_000 });

  // Allow slide transition (0.4 s) to finish.
  await page.waitForTimeout(700);

  const topAt3 = await avatars.evaluate((el) => el.getBoundingClientRect().top);
  expect(topAt3).toBeGreaterThan(topAt1);

  await context.close();
  if (errors.length) throw new Error(errors.join("\n"));
});

test("segment layer active when a move is selected", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah");
  // Wait for the map to mount and for the URL effect to set selectedMoveSeq=1.
  await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(800);
  const debug = await page.evaluate(() => window.__mapDebug);
  expect(debug, "window.__mapDebug should be exposed").toBeTruthy();
  expect(debug.segmentFeatureCount).toBe(1);
  // Marching ants should be advancing the offset.
  const o1 = await page.evaluate(() => window.__mapDebug.lineDashOffset);
  await page.waitForTimeout(400);
  const o2 = await page.evaluate(() => window.__mapDebug.lineDashOffset);
  expect(o2).not.toBe(o1);
  if (errors.length) throw new Error(errors.join("\n"));
});

test("view auto-fits to the selected segment", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah");
  await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(900); // allow fit animation
  const center1 = await page.evaluate(() => window.__mapDebug?.viewCenter);
  // Click move 5.
  await page.locator(".mapPanel .map_story_fence[data-seq='5']").click();
  await expect(page).toHaveURL(/\/move\/5$/);
  await page.waitForTimeout(900);
  const center2 = await page.evaluate(() => window.__mapDebug?.viewCenter);
  expect(center1).toBeTruthy();
  expect(center2).toBeTruthy();
  // Centers should differ (different move = different segment midpoint).
  expect(center1[0] !== center2[0] || center1[1] !== center2[1]).toBe(true);
  if (errors.length) throw new Error(errors.join("\n"));
});

test("walker feature on canvas animates along selected segment", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/3");
  await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(800);
  const c1 = await page.evaluate(() => window.__mapDebug?.walkerCoords);
  expect(c1).toBeTruthy();
  await page.waitForTimeout(500);
  const c2 = await page.evaluate(() => window.__mapDebug?.walkerCoords);
  expect(c2).toBeTruthy();
  expect(c1[0] !== c2[0] || c1[1] !== c2[1]).toBe(true);
  if (errors.length) throw new Error(errors.join("\n"));
});

test("segment clears when story closes", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/2");
  await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(800);
  // Click the back arrow (⬅) to leave the story.
  await page.locator(".mapPanel span", { hasText: "⬅" }).first().click();
  // URL goes back to a /place/ URL.
  await expect(page).toHaveURL(/\/place\//, { timeout: 5_000 });
  await page.waitForTimeout(400);
  const debug = await page.evaluate(() => window.__mapDebug);
  expect(debug.segmentFeatureCount).toBe(0);
  expect(debug.walkerCoords).toBe(null);
  if (errors.length) throw new Error(errors.join("\n"));
});

test("URL auto-replaces /story/X with /story/X/move/1 on cold load", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah");
  await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/map\/internal\/story\/sons-of-mosiah\/move\/1$/);
  if (errors.length) throw new Error(errors.join("\n"));
});

test("selected segment uses run color (not always red)", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/1");
  await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(800);
  const color = await page.evaluate(() => window.__mapDebug?.selectedColor);
  // STORY_RUN_COLORS first entry is '#3b82f6'
  expect(color).toBe('#3b82f6');
  if (errors.length) throw new Error(errors.join("\n"));
});

test("only the active story's moves draw on the map", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/1");
  await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(800);
  // sons-of-mosiah has 14 moves; static layer has 13 (selected excluded); segment has 1.
  const debug = await page.evaluate(() => window.__mapDebug);
  expect(debug.storyLinesFeatureCount).toBe(13);
  expect(debug.segmentFeatureCount).toBe(1);
  // Navigate away to a /place/ URL; both layers should clear.
  await page.goto("/map/internal/place/jershon");
  await page.waitForTimeout(800);
  const debug2 = await page.evaluate(() => window.__mapDebug);
  expect(debug2.storyLinesFeatureCount).toBe(0);
  expect(debug2.segmentFeatureCount).toBe(0);
  if (errors.length) throw new Error(errors.join("\n"));
});

test("static story lines: all non-selected moves drawn, run-colored", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/3");
  await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(900);
  const debug = await page.evaluate(() => window.__mapDebug);
  // sons-of-mosiah has 14 moves; selected is excluded; static layer should have 13.
  expect(debug.storyLinesFeatureCount).toBe(13);
  // forceShow set should cover all unique endpoint slugs across the story.
  expect(debug.forceShowCount).toBeGreaterThan(2);
  if (errors.length) throw new Error(errors.join("\n"));
});

test("first post has run color #3b82f6 outline + connector", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/1");
  const firstPost = page.locator(".mapPanel .map_story_post").first();
  await expect(firstPost).toBeVisible({ timeout: 15_000 });
  const cssVar = await firstPost.evaluate((el) => getComputedStyle(el).getPropertyValue('--run-color').trim());
  expect(cssVar).toBe('#3b82f6');
  const outlineColor = await firstPost.evaluate((el) => getComputedStyle(el).outlineColor);
  expect(outlineColor).toBe('rgb(59, 130, 246)');
  if (errors.length) throw new Error(errors.join("\n"));
});
