import routes, { CommunityRedirect, UserRedirect } from "../Routes";

const byPath = (p) => routes.find((r) => r.path === p);
const paths = routes.map((r) => r.path);

describe("routes shape after Home unification", () => {
  test("has a non-exact /home entry", () => {
    const home = byPath("/home");
    expect(home).toBeTruthy();
    expect(home.exact).toBeFalsy();
  });

  test("bare /community and /user now redirect (not standalone views)", () => {
    expect(byPath("/community")).toBeTruthy();
    expect(byPath("/community").component).toBe(CommunityRedirect);
    expect(byPath("/user")).toBeTruthy();
    expect(byPath("/user").component).toBe(UserRedirect);
  });

  test("legacy /user/signup entry is removed (covered by /user/:value)", () => {
    expect(paths).not.toContain("/user/signup");
  });

  test("param redirect entries exist for community + user", () => {
    expect(byPath("/community/:channelId/:messageId(\\d+)").component).toBe(CommunityRedirect);
    expect(byPath("/community/:channelId").component).toBe(CommunityRedirect);
    expect(byPath("/user/:value").component).toBe(UserRedirect);
  });
});
