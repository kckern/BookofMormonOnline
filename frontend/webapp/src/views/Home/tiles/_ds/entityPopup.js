// A tile's link to a person/place/matter opens the entity POPUP over Home (the
// popup has a Maximize button for the full page), instead of switching the whole
// view to the entity page — whose back control used to drop readers out of
// Discover (prod 2026-10-20). One delegated handler on the Sampler root covers
// every tile in every class; the <a href> stays real for new-tab, copy and SEO.
const ENTITY = /^\/(people|places|matters)\/([^/?#]+)\/?$/;

// /matters/<group> are index routes (Models/Routes.js), not single matters.
const MATTER_GROUPS = new Set(["narrative", "material", "concepts"]);

/** { type, slug } for an in-app entity URL, else null. */
export function entityTarget(href) {
  const m = ENTITY.exec(href || "");
  if (!m) return null;
  let slug = m[2];
  try { slug = decodeURIComponent(slug); } catch { /* keep raw */ }
  if (m[1] === "matters" && MATTER_GROUPS.has(slug)) return null;
  return { type: m[1], slug };
}

/** Click handler: opens the popup and swallows the navigation. True if it handled the click. */
export function openEntityPopupOnClick(e, appController) {
  if (!appController?.functions?.setPopUp) return false;
  if (e.defaultPrevented || (e.button ?? 0) !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = e.target?.closest?.("a[href]");
  if (!a || (a.getAttribute("target") && a.getAttribute("target") !== "_self") || a.hasAttribute("download")) return false;
  const t = entityTarget(a.getAttribute("href"));
  if (!t) return false;
  e.preventDefault();
  e.stopPropagation();
  appController.functions.setPopUp({
    type: t.type,
    ids: [t.slug],
    underSlug: window.location.pathname.replace(/^\/+/, ""),
  });
  return true;
}
