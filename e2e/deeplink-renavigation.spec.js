const { test, expect, getEvents, waitForEvent, getFixture } = require("./fixtures");

const A = getFixture("commentaryId");
const B = getFixture("secondCommentaryId");

test.describe("commentary deep-link renavigation", () => {
  test.skip(A === "REPLACE_ME" || B === "REPLACE_ME", "Set E2E_COMMENTARY_ID and E2E_SECOND_COMMENTARY_ID to run");

  test("navigating /commentary/A → /commentary/B re-runs init with B's id", async ({ instrumentedPage: page }) => {
    await page.goto(`/commentary/${A}`);
    await waitForEvent(page, "initPageItem:callback");
    const eventsA = await getEvents(page);
    expect(eventsA.some(e => e.name === "initPageItem:enter")).toBe(true);

    // Reset capture and navigate
    await page.evaluate(() => { window.__deepLinkEvents.length = 0; });
    await page.goto(`/commentary/${B}`, { waitUntil: "domcontentloaded" });
    await waitForEvent(page, "initPageItem:callback");
    const eventsB = await getEvents(page);
    expect(eventsB.filter(e => e.name === "initPageItem:enter").length).toBeGreaterThanOrEqual(1);

    // The page URL must end at /commentary/B (popup pushes commentary/B's slug)
    await expect(page).toHaveURL(new RegExp(`/commentary/${B}$`));
  });

  test("client-side <Link>-style navigation also re-runs init", async ({ instrumentedPage: page }) => {
    await page.goto(`/commentary/${A}`);
    await waitForEvent(page, "initPageItem:callback");
    await page.evaluate(() => { window.__deepLinkEvents.length = 0; });

    // Simulate a SPA navigation via history.pushState + popstate (closest to a <Link> click)
    await page.evaluate((id) => {
      window.history.pushState({}, "", `/commentary/${id}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, B);
    await waitForEvent(page, "initPageItem:callback");
    const events = await getEvents(page);
    expect(events.some(e => e.name === "initPageItem:enter")).toBe(true);
  });
});
