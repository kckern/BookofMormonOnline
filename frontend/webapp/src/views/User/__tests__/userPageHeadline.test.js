import { userPageTitleKey, hasProgressFigures } from "../userPageHeadline";

// Blind rail audit readingplan-D5: Home's guest "Sign in" CTA landed on a page
// titled "Study progress for Guest" whose header read "% Completed • % Started"
// with no numbers.
test("a guest's /home/user is titled as the sign-in page; a member's as their progress", () => {
  expect(userPageTitleKey(null)).toBe("sign_in");
  expect(userPageTitleKey(undefined)).toBe("sign_in");
  expect(userPageTitleKey({ nickname: "Ammon" })).toBe("study_progress_for_x");
});

test("the progress figures render only when there are figures (loading -1 counts)", () => {
  expect(hasProgressFigures(undefined, undefined)).toBe(false);
  expect(hasProgressFigures(null, null)).toBe(false);
  expect(hasProgressFigures(-1, -1)).toBe(true);
  expect(hasProgressFigures(12, 0)).toBe(true);
});
