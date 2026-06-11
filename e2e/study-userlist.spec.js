/**
 * Regression: the Study components fetch group-member presence through the
 * SendBird-compat shim's createApplicationUserListQuery. That API was missed
 * in the SendBird → MessengerController port, so any logged-in user whose
 * active study group has ≠1 members hit
 * "appController.sendbird.sb.createApplicationUserListQuery is not a function"
 * ~100ms after StudyGroupBar mounted (StudyGroupBar.js:230; also
 * StudyHall.js:137, StudyGroupCall.js:44).
 *
 * This test logs in as the staff/test account, lands on a content page, and
 * asserts (a) the shim path actually runs — a messengerUsers GraphQL request
 * fires — and (b) no createApplicationUserListQuery error surfaces.
 *
 * Credentials come from TEST_USER/TEST_PASS env (Infisical runtime env);
 * never hardcode them here — this repo is public.
 *
 * Run:
 *   set -a; . <(grep -E '^(TEST_USER|TEST_PASS)=' "$XDG_RUNTIME_DIR/bom-dev.env"); set +a
 *   npx playwright test --config e2e/playwright.config.js study-userlist
 */
const { test, expect } = require("@playwright/test");

const USER = process.env.TEST_USER;
const PASS = process.env.TEST_PASS;

test("study user-list query works after staff login (SendBird port)", async ({ page }) => {
  test.skip(!USER || !PASS, "TEST_USER/TEST_PASS not set in env");
  test.setTimeout(90_000);

  const userListErrors = [];
  let messengerUsersRequests = 0;
  page.on("pageerror", (e) => {
    if (/createApplicationUserListQuery/.test(e.message)) userListErrors.push(e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error" && /createApplicationUserListQuery/.test(m.text())) userListErrors.push(m.text());
  });
  page.on("request", (req) => {
    if (req.method() === "POST" && /messengerUsers/.test(req.postData() || "")) messengerUsersRequests++;
  });

  await page.goto("/user");
  await page.fill("#username", USER);
  await page.fill("#password", PASS);
  const signinResponse = page.waitForResponse(
    (res) => res.request().method() === "POST" && /signin/.test(res.request().postData() || ""),
    { timeout: 20_000 }
  );
  await page.press("#password", "Enter");
  await signinResponse;
  await page.waitForTimeout(1500); // let processSignIn persist the token

  // Content page: Header + StudyGroupBar mount; the group-member fetch fires
  // ~100ms after the active study group loads. (The /user Profile view has an
  // unrelated "Invalid language tag" crash for this account, so don't idle there.)
  await page.goto("/lehites");

  // (a) the ported code path actually runs...
  await expect
    .poll(() => messengerUsersRequests, { timeout: 45_000, message: "expected a messengerUsers GraphQL request from the ported user-list query" })
    .toBeGreaterThan(0);

  // ...give any fallout a moment to surface, then (b) no compat error.
  await page.waitForTimeout(3000);
  expect(userListErrors, `unexpected shim errors:\n${userListErrors.join("\n")}`).toHaveLength(0);
});
