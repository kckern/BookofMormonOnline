const { test, expect, getEvents, waitForEvent, getFixture } = require("./fixtures");

const COMMENTARY_ID = getFixture("commentaryId");
const NESTED_COMMENTARY_ID = getFixture("nestedCommentaryId") !== "REPLACE_ME"
  ? getFixture("nestedCommentaryId")
  : COMMENTARY_ID;

test.describe("commentary deep-link sequencing", () => {
  test.skip(COMMENTARY_ID === "REPLACE_ME", "Set E2E_COMMENTARY_ID to run");

  test("popup callback fires AFTER the last row open", async ({ instrumentedPage: page }) => {
    await page.goto(`/commentary/${NESTED_COMMENTARY_ID}`);
    await waitForEvent(page, "initPageItem:callback");
    const events = await getEvents(page);
    const lastOpen = events.map(e => e.name).lastIndexOf("initPageItem:itemOpened");
    const cbIdx = events.map(e => e.name).indexOf("initPageItem:callback");
    expect(lastOpen).toBeGreaterThan(-1);
    expect(cbIdx).toBeGreaterThan(lastOpen);
  });

  test("items open in DOM-ancestry order (parent before leaf)", async ({ instrumentedPage: page }) => {
    await page.goto(`/commentary/${NESTED_COMMENTARY_ID}`);
    await waitForEvent(page, "initPageItem:callback");
    const events = await getEvents(page);
    const opens = events.filter(e => e.name === "initPageItem:itemOpened").map(e => e.payload.slug);

    if (opens.length < 2) test.skip(true, "Not a nested case for this ID");

    // The first opened slug must be an ancestor of the second
    const order = await page.evaluate(
      ([a, b]) => {
        const aEl = document.querySelector(`[textid='${a}']`);
        const bEl = document.querySelector(`[textid='${b}']`);
        if (!aEl || !bEl) return "missing";
        return aEl.contains(bEl) ? "ancestor" : "not-ancestor";
      },
      [opens[0], opens[1]],
    );
    expect(order).toBe("ancestor");
  });

  test("popup is visible by the time callback fires", async ({ instrumentedPage: page }) => {
    await page.goto(`/commentary/${COMMENTARY_ID}`);
    await waitForEvent(page, "initPageItem:callback");
    await expect(page.locator("#popUp")).toBeVisible({ timeout: 5000 });
  });

  test("auto-click history entries collapse — single back-button stop reaches the page", async ({ instrumentedPage: page }) => {
    test.skip(NESTED_COMMENTARY_ID === "REPLACE_ME", "Set E2E_NESTED_COMMENTARY_ID to run");
    await page.goto("/");
    await page.goto(`/commentary/${NESTED_COMMENTARY_ID}`);
    await waitForEvent(page, "initPageItem:callback");

    // After init, the URL should be /commentary/<id> (the popup's slug).
    await expect(page).toHaveURL(new RegExp(`/commentary/${NESTED_COMMENTARY_ID}$`));

    // One back should land on the underlying row URL (collapsed from N auto-clicks to 1).
    await page.goBack({ waitUntil: "commit" });
    const afterOne = page.url();
    expect(afterOne).toMatch(/\/[^/]+\/\d+$/);

    // Two backs should escape the deep-link entirely (back to "/" from the initial goto).
    await page.goBack({ waitUntil: "commit" });
    const afterTwo = page.url();
    expect(afterTwo).not.toMatch(/\/[^/]+\/\d+$/);
    expect(afterTwo).not.toMatch(new RegExp(`/commentary/${NESTED_COMMENTARY_ID}$`));
  });
});
