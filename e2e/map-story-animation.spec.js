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
  const firstRow = page.locator(".mapPanel .map_story_move").first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  await expect(firstRow).toHaveClass(/selected/);
  if (errors.length) throw new Error(errors.join("\n"));
});

test("explicit selection: /story/X/move/3 selects row 3", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/3");
  const rows = page.locator(".mapPanel .map_story_move");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  // Row at array index 2 = seq 3 (1-indexed).
  await expect(rows.nth(2)).toHaveClass(/selected/);
  if (errors.length) throw new Error(errors.join("\n"));
});

test("row layout: flex-end + desc negative margin", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah");
  const firstRow = page.locator(".mapPanel .map_story_move").first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  const rowAlignItems = await firstRow.evaluate((el) => getComputedStyle(el).alignItems);
  expect(rowAlignItems).toBe("flex-end");
  const descMarginBottom = await firstRow
    .locator(".map_story_move_desc")
    .evaluate((el) => getComputedStyle(el).marginBottom);
  // -1rem at default 16px root font → "-16px"
  expect(descMarginBottom).toBe("-16px");
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

  // Click move 3 (array index 2).
  await page.locator(".mapPanel .map_story_move").nth(2).click();
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
  await expect(page.locator(".mapPanel .map_story_move").first()).toBeVisible({ timeout: 15_000 });
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
