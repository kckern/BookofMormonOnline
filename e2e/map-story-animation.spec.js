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
