import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";

/**
 * Types that may be promoted from modal to standalone page.
 *
 * ALLOWLIST, not a denylist, and deliberately so:
 *  - 'commentary' must NEVER render full-page. Commentary is licensed for
 *    in-context display only, so it stays inside the chapter that frames it.
 *  - 'victory' is a session summary, not an addressable entity — it has no page.
 * Adding a type here without a route that renders it as a page produces a dead
 * button. See docs/specs/2026-09-24-entity-url-presentation-model.md.
 */
const PAGE_ELIGIBLE = new Set(["people", "places", "place", "matters", "history"]);

// label() returns " " before global.dictionary loads and echoes the key when the
// dictionary lacks it (models/Utils.js:99-101), so `label(k) || fallback` never
// falls back.
function text(key, fallback) {
  const value = label(key);
  if (!value || !String(value).trim() || value === key) return fallback;
  return value;
}

export default function MaximizeButton({ type }) {
  const navigate = useNavigate();
  const appController = useAppController();
  if (!PAGE_ELIGIBLE.has(type)) return null;

  // The address bar already holds the entity URL — setPopUp pushed it through
  // models/routeHistory.js, an instance the Router never hears from. So this
  // only needs to let the Router catch up, which mounts the item route and
  // renders EntityPage. `replace` keeps the URL identical and adds no history
  // entry. Read from window.location, not the Router's location, because the
  // Router's own location is still whatever was behind the modal.
  const maximize = () => {
    const target = window.location.pathname + window.location.search;
    // keepSlug: closePopUp otherwise calls setSlug(underSlug), which would
    // rewrite the address bar back to the index — the one thing maximize must
    // not do, since the page it reveals is identified by this very URL.
    appController.functions.closePopUp({ keepSlug: true });
    navigate(target, { replace: true });
  };

  return (
    <li
      className="maximize"
      title={text("view_full_page", "View full page")}
      onClick={maximize}
    >
      ⤢
    </li>
  );
}
