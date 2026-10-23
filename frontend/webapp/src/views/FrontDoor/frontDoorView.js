// Which view the site root (/) renders. Spec: docs/specs/2026-10-23-front-door-user-journeys.md §4.
//   signed in (real account) -> "read" (resumes; a Continue surface comes later)
//   has read before      -> "read" (Read resumes the last chapter)
//   first visit          -> "discover"
// A visitor who only looked at Discover stays "first visit" until they read something
// (Read writes localStorage.chapterRef), so a reload does not strand them on 1 Nephi 1.
export function frontDoorView({ enabled, signedIn, chapterRef }) {
  if (!enabled) return "read";
  if (signedIn) return "read";
  if (chapterRef && String(chapterRef).trim()) return "read";
  return "discover";
}

// Storage can throw (private window, blocked site data): treat that as a first visit.
// NOTE: `localStorage.token` is NOT a sign-in signal: guests are issued one on first
// load. "Signed in" comes from the app's own user state (appController.states.user.user).
export function readChapterRef(storage) {
  try { return storage.getItem("chapterRef"); } catch (e) { return null; }
}
