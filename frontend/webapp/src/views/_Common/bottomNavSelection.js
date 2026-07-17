// Pure resolver for the mobile bottom-nav's active index. Extracted from
// BottomNav.determineSelection so it can be unit-tested. Numeric returns match
// the original exactly; the only new behavior is the /home/user split so the
// User item (not the Home item) highlights on the unified Home's user tab.
export function resolveBottomSelection(pathname, useMessenger) {
  const seg = (pathname || "/").split("/").filter(Boolean);
  const root = seg[0] || "";
  const sub = seg[1] || "";

  if (["groups", "group", "invite"].includes(root)) return useMessenger ? 0 : -1;
  if (root === "home" && sub === "user") return useMessenger ? 3 : 2; // User item
  if (root === "home") return useMessenger ? 1 : -1; // Home item
  if (root === "user") return useMessenger ? 3 : 2; // legacy /user*
  if (root === "mobilemenu") return useMessenger ? 4 : 3;
  return useMessenger ? 2 : 1; // study / default
}
