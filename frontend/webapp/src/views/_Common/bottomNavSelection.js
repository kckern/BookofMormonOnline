// Pure resolver for the mobile bottom-nav's active index. Extracted from
// BottomNav.determineSelection so it can be unit-tested. Numeric returns match
// the original exactly; the only new behavior is the /home/user split so the
// User item (not the Home item) highlights on the unified Home's user tab.
// Sections you reach only through the More menu: the More item stays lit while you are in
// them, instead of the Study fallback claiming People, Places, Theater... as "Study".
const MORE_ROOTS = new Set([
  "people", "place", "places", "matters", "map", "maps", "timeline", "theater",
  "history", "analysis", "theology", "relationships", "fax", "about", "contents",
]);

export function resolveBottomSelection(pathname, useMessenger) {
  const seg = (pathname || "/").split("/").filter(Boolean);
  const root = seg[0] || "";
  const sub = seg[1] || "";

  if (["groups", "group", "invite"].includes(root)) return useMessenger ? 0 : -1;
  if (root === "home" && sub === "user") return useMessenger ? 3 : 2; // User item
  if (root === "home") return useMessenger ? 1 : 0; // Discover item (always shown, messenger or not)
  if (root === "user") return useMessenger ? 3 : 2; // legacy /user*
  if (root === "mobilemenu" || MORE_ROOTS.has(root)) return useMessenger ? 4 : 3;
  return useMessenger ? 2 : 1; // study / default
}
