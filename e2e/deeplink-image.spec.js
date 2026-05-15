const { test, expect, getEvents, waitForEvent } = require("./fixtures");

const IMAGE_ID = process.env.E2E_IMAGE_ID || "REPLACE_ME";

test.describe("image deep-link", () => {
  test.skip(IMAGE_ID === "REPLACE_ME", "Set E2E_IMAGE_ID to run");

  test("activation happens after row open, URL canonicalizes to /art/<id>", async ({ instrumentedPage: page }) => {
    await page.goto(`/image/${IMAGE_ID}`);
    await waitForEvent(page, "initPageItem:callback");
    await expect(page).toHaveURL(new RegExp(`/art/${IMAGE_ID}$`), { timeout: 5000 });
  });

  test("ImagePanel renders the activated image", async ({ instrumentedPage: page }) => {
    await page.goto(`/image/${IMAGE_ID}`);
    await waitForEvent(page, "initPageItem:callback");
    const src = await page.locator(`img.panel.i${IMAGE_ID}`).getAttribute("src");
    expect(src).toMatch(new RegExp(`/art/${IMAGE_ID}$`));
  });
});
