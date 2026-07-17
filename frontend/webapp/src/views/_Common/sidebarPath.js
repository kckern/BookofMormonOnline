// Pure resolver for the sidebar's "active" indicator. Extracted from
// Sidebar.determinePath so it can be unit-tested without loading the
// full Sidebar (crypto/svg imports, contexts). Under the unified Home,
// /user now lives at /home/user; legacy /user paths still resolve there.
export function resolveActivePath(pathname, slugs) {
  const seg = (pathname || "/").split("/");
  const root = seg[1] || "";
  const sub = seg[2] || "";

  // Collapse /home/user and any /home/user/* sub-page (history, preferences,
  // signup) to the single user tab — user sub-pages are not independently
  // highlighted in the sidebar.
  if (root === "home" && sub === "user") return "/home/user";
  if (["message", "", "invite"].includes(root)) return "/home";
  if (root === "search") return "/search";
  if (root === "user") return "/home/user"; // legacy /user* → unified user tab
  // "%ED%8A%B9%EB%B3%84%EB%B0%98" is percent-encoded "특별반".
  if (["%ED%8A%B9%EB%B3%84%EB%B0%98", "studyedition"].includes(root)) return "/특별반";
  if ((slugs || []).includes(root)) return pathname;
  return "/study";
}
