/**
 * /home/user for a guest is the sign-in page (the form is its only working
 * part; Home's "Sign in" CTAs land here), so it is titled that way rather than
 * "Study progress for Guest" (blind rail audit readingplan-D5).
 * @param social the signed-in user's social profile, absent for a guest
 */
export const userPageTitleKey = (social) => (social ? "study_progress_for_x" : "sign_in");

/** Progress figures exist (a number, -1 = still loading); a guest has none. */
export const hasProgressFigures = (completed, started) =>
  typeof completed === "number" || typeof started === "number";
