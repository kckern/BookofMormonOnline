const { test, expect, getEvents, waitForEvent } = require("./fixtures");

const COMMENTARY_ID = process.env.E2E_COMMENTARY_ID || "REPLACE_ME";

test("scrollTo:callback fires on real scroll completion, not a fixed timer", async ({ instrumentedPage: page }) => {
  test.skip(COMMENTARY_ID === "REPLACE_ME", "Set E2E_COMMENTARY_ID to run");
  await page.goto(`/commentary/${COMMENTARY_ID}`);
  await waitForEvent(page, "initPageItem:callback");
  const events = await getEvents(page);

  const starts = events.filter(e => e.name === "scrollTo:start");
  const callbacks = events.filter(e => e.name === "scrollTo:callback");
  expect(starts.length).toBeGreaterThan(0);
  expect(callbacks.length).toBe(starts.length);

  // Ordering: each callback after its paired start.
  for (let i = 0; i < starts.length; i++) {
    expect(callbacks[i].t).toBeGreaterThanOrEqual(starts[i].t);
  }

  // Regression guard: in the old timer-based implementation, callback fired at exactly
  // start + 1000ms (regardless of actual scroll). The new scrollend-based implementation
  // fires faster than 1000ms for typical short scrolls on a desktop browser. Assert at
  // least one paired event resolves in well under 1000ms — this fails the moment anyone
  // reintroduces the fixed-timer pattern.
  const durations = starts.map((s, i) => callbacks[i].t - s.t);
  const min = Math.min(...durations);
  expect(min).toBeLessThan(1000);
});
