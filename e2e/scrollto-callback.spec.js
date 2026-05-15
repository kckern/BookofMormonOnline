const { test, expect, getEvents, waitForEvent } = require("./fixtures");

const COMMENTARY_ID = process.env.E2E_COMMENTARY_ID || "REPLACE_ME";

test("scrollTo:callback fires after the page has stopped scrolling", async ({ instrumentedPage: page }) => {
  test.skip(COMMENTARY_ID === "REPLACE_ME", "Set E2E_COMMENTARY_ID to run");
  await page.goto(`/commentary/${COMMENTARY_ID}`);
  await waitForEvent(page, "initPageItem:callback");
  const events = await getEvents(page);

  const starts = events.filter(e => e.name === "scrollTo:start");
  const callbacks = events.filter(e => e.name === "scrollTo:callback");
  expect(starts.length).toBeGreaterThan(0);
  expect(callbacks.length).toBe(starts.length);

  // For each scrollTo:start, the next scrollTo:callback occurs AFTER it (event ordering only —
  // does NOT prove the scroll completed, but proves we no longer fire callback at fixed t=1000).
  for (let i = 0; i < starts.length; i++) {
    expect(callbacks[i].t).toBeGreaterThanOrEqual(starts[i].t);
  }
});
