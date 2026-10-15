import { createAutoClickTracker } from "../autoClickTracker";

// A deeplink campaign marks a row as auto-opened and then clicks it in the same
// tick. The mark has to be visible to that click synchronously; reading it from
// reducer state raced, so the campaign's open was treated as a user click and
// pushed a history entry (audit R2.2 E1: Back from a commentary tile looped).
describe("createAutoClickTracker", () => {
  test("a mark is visible immediately, before any re-render", () => {
    const t = createAutoClickTracker();
    t.mark("alma/32/21");
    expect(t.has("alma/32/21")).toBe(true);
  });

  test("consume reports and clears the mark, so a later user click on the same row pushes", () => {
    const t = createAutoClickTracker();
    t.mark("alma/32/21");
    expect(t.consume("alma/32/21")).toBe(true);
    expect(t.has("alma/32/21")).toBe(false);
    expect(t.consume("alma/32/21")).toBe(false);
  });

  test("unmarked rows are user clicks", () => {
    expect(createAutoClickTracker().consume("x")).toBe(false);
  });
});
