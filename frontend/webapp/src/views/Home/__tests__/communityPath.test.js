import { isCommunityPath } from "../Community";

describe("isCommunityPath", () => {
  test("new nested base", () => expect(isCommunityPath("/home/community")).toBe(true));
  test("new nested with channel", () => expect(isCommunityPath("/home/community/abc")).toBe(true));
  test("legacy base", () => expect(isCommunityPath("/community/abc")).toBe(true));
  test("unlisted feed", () => expect(isCommunityPath("/home/feed/abc")).toBe(true));
  test("plain home is not community", () => expect(isCommunityPath("/home")).toBe(false));
  test("user tab is not community", () => expect(isCommunityPath("/home/user")).toBe(false));
  test("substring guard: communityish", () => expect(isCommunityPath("/home/communityhall")).toBe(false));
});

import { shouldFitGroups, defaultGroupFor } from "../Community";

// Blind R9 community-D5: "View all" / "+N more groups" landed a guest on the
// community index trimmed to ONE group (phone) beside a blank feed pane (desktop).
describe("community index shows every group", () => {
  test("the height-fit trim applies only with a group open, on a wide screen, unfiltered", () => {
    expect(shouldFitGroups({ isFiltered: false, activeGroup: "g1", narrow: false })).toBe(true);
    expect(shouldFitGroups({ isFiltered: false, activeGroup: null, narrow: false })).toBe(false); // index
    expect(shouldFitGroups({ isFiltered: false, activeGroup: "g1", narrow: true })).toBe(false); // phone
    expect(shouldFitGroups({ isFiltered: true, activeGroup: "g1", narrow: false })).toBe(false); // see more
  });
  test("desktop index opens the first group's feed instead of a blank pane; phone keeps the list", () => {
    const groups = [{ url: "a" }, { url: "b" }];
    expect(defaultGroupFor({ activeGroup: null, narrow: false, groups })).toBe("a");
    expect(defaultGroupFor({ activeGroup: null, narrow: true, groups })).toBeNull();
    expect(defaultGroupFor({ activeGroup: "b", narrow: false, groups })).toBeNull();
    expect(defaultGroupFor({ activeGroup: null, narrow: false, groups: [] })).toBeNull();
  });
});
