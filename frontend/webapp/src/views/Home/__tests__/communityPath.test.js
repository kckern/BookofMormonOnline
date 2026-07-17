import { isCommunityPath } from "../Community";

describe("isCommunityPath", () => {
  test("new nested base", () => expect(isCommunityPath("/home/community")).toBe(true));
  test("new nested with channel", () => expect(isCommunityPath("/home/community/abc")).toBe(true));
  test("legacy base", () => expect(isCommunityPath("/community/abc")).toBe(true));
  test("plain home is not community", () => expect(isCommunityPath("/home")).toBe(false));
  test("user tab is not community", () => expect(isCommunityPath("/home/user")).toBe(false));
  test("substring guard: communityish", () => expect(isCommunityPath("/home/communityhall")).toBe(false));
});
