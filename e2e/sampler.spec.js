const { test, expect } = require("./fixtures");

test("sampler renders a bounded tile grid", async ({ instrumentedPage: page }) => {
  await page.goto("/home");
  await page.waitForSelector(".samplerGrid .tile:not(.skeleton)", { timeout: 15000 });
  const tiles = await page.locator(".samplerGrid .tile:not(.skeleton)").count();
  expect(tiles).toBeGreaterThanOrEqual(6);
  await expect(page.locator(".samplerFooter")).toBeVisible();
});

test("legacy /home/:channelId deep links redirect to /community", async ({ instrumentedPage: page }) => {
  await page.goto("/home/some-legacy-channel");
  await page.waitForURL(/\/community\/some-legacy-channel/, { timeout: 15000 });
});

test("people tile navigates to a person page", async ({ instrumentedPage: page }) => {
  await page.goto("/home");
  await page.waitForSelector(".peopleTileCard", { timeout: 15000 });
  await page.locator(".peopleTileCard").first().click();
  await page.waitForURL(/\/people\/.+/, { timeout: 15000 });
});
