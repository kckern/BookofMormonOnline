// Pure sidebar-menu visibility filter. Extracted from Sidebar.loadMenu so the
// gating rules (messenger / dev / language / cutover hidden-flags) can be
// unit-tested without importing the full Sidebar (crypto/svg/context imports).
//
// Operates on the RAW menuConfig items — which still carry `hiddenFlag` — so a
// prop-stripping map in loadMenu can never silently disable the hidden gate.
export function filterMenu(items, { hiddenFlags = {}, isDev, lang, useMessenger }) {
  return (items || []).filter((i) => {
    if (i.requiresMessenger && !useMessenger) return false;
    if (i.dev && !isDev) return false;
    if (i.lang && !i.lang.includes(lang)) return false;
    if (i.langNot && i.langNot.includes(lang)) return false;
    if (i.hiddenFlag && hiddenFlags[i.hiddenFlag]) return false;
    return true;
  });
}
