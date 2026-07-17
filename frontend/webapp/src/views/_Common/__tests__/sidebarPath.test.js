import { resolveActivePath } from "../sidebarPath";

const SLUGS = ["home", "contents", "study", "read", "timeline", "people", "places", "map", "about"];

describe("resolveActivePath", () => {
  test("/home stays /home", () => {
    expect(resolveActivePath("/home", SLUGS)).toBe("/home");
  });
  test("/home/community keeps full path", () => {
    expect(resolveActivePath("/home/community", SLUGS)).toBe("/home/community");
  });
  test("/home/community/:channelId keeps full path", () => {
    expect(resolveActivePath("/home/community/abc123", SLUGS)).toBe("/home/community/abc123");
  });
  test("/home/user resolves to /home/user", () => {
    expect(resolveActivePath("/home/user", SLUGS)).toBe("/home/user");
  });
  test("legacy /user resolves to /home/user", () => {
    expect(resolveActivePath("/user", SLUGS)).toBe("/home/user");
  });
  test("legacy /user/history resolves to /home/user", () => {
    expect(resolveActivePath("/user/history", SLUGS)).toBe("/home/user");
  });
  test("/search/foo resolves to /search", () => {
    expect(resolveActivePath("/search/foo", SLUGS)).toBe("/search");
  });
  test("empty root resolves to /home", () => {
    expect(resolveActivePath("/", SLUGS)).toBe("/home");
  });
  test("studyedition resolves to /특별반", () => {
    expect(resolveActivePath("/studyedition", SLUGS)).toBe("/특별반");
  });
  test("a real menu slug returns its own path", () => {
    expect(resolveActivePath("/read/1-nephi/1", SLUGS)).toBe("/read/1-nephi/1");
  });
  test("unknown root falls back to /study", () => {
    expect(resolveActivePath("/nope", SLUGS)).toBe("/study");
  });
  test("/home/user/* deep sub-paths collapse to /home/user", () => {
    expect(resolveActivePath("/home/user/settings", SLUGS)).toBe("/home/user");
    expect(resolveActivePath("/home/user/history", SLUGS)).toBe("/home/user");
  });
  test("undefined pathname resolves to /home", () => {
    expect(resolveActivePath(undefined, SLUGS)).toBe("/home");
  });
});
