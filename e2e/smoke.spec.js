const { test, expect, getEvents, waitForEvent } = require("./fixtures");

const COMMENTARY_ID = process.env.E2E_COMMENTARY_ID || "REPLACE_ME";

test("commentary deep-link emits the expected sequence", async ({ instrumentedPage: page }) => {
  test.skip(COMMENTARY_ID === "REPLACE_ME", "Set E2E_COMMENTARY_ID to run");
  await page.goto(`/commentary/${COMMENTARY_ID}`);
  await waitForEvent(page, "initPageItem:callback");
  const events = await getEvents(page);
  const names = events.map(e => e.name);
  expect(names).toContain("initPageItem:enter");
  expect(names).toContain("initPageItem:outerScrollDone");
  expect(names).toContain("initPageItem:callback");
});
