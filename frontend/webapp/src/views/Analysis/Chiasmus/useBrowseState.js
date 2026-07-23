import { useCallback, useMemo } from "react";
import { useHistory, useLocation } from "react-router-dom/cjs/react-router-dom.min";

export const DEFAULTS = {
  q: "",            // search text (legacy — no UI, kept so the URL/selector stay valid)
  group: "none",    // book | speaker | depth | type | none — flat list is the default now
  sort: "canonical",// canonical | depth | length | title
  dir: "asc",
  depths: [],       // inclusion list; empty = all
  type: null,       // null | simple | compound | biblical
  speaker: null,    // person_slug of the voice filter; null = all voices
};

// Browse state encoded in the URL query string: shareable, restorable,
// back-button-safe. Values equal to DEFAULTS are omitted for clean URLs.
export default function useBrowseState() {
  const { search, pathname } = useLocation();
  const { replace } = useHistory();

  const state = useMemo(() => {
    const p = new URLSearchParams(search);
    return {
      q: p.get("q") || DEFAULTS.q,
      group: p.get("group") || DEFAULTS.group,
      sort: p.get("sort") || DEFAULTS.sort,
      dir: p.get("dir") || DEFAULTS.dir,
      depths: p.get("d") ? p.get("d").split(",") : DEFAULTS.depths,
      type: p.get("type") || DEFAULTS.type,
      speaker: p.get("sp") || DEFAULTS.speaker,
    };
  }, [search]);

  const set = useCallback(
    (patch) => {
      const next = { ...state, ...patch };
      const p = new URLSearchParams();
      if (next.q) p.set("q", next.q);
      if (next.group !== DEFAULTS.group) p.set("group", next.group);
      if (next.sort !== DEFAULTS.sort) p.set("sort", next.sort);
      if (next.dir !== DEFAULTS.dir) p.set("dir", next.dir);
      if (next.depths.length) p.set("d", next.depths.join(","));
      if (next.type) p.set("type", next.type);
      if (next.speaker) p.set("sp", next.speaker);
      const qs = p.toString();
      // replace, not push — filter browsing must not spam history
      replace(pathname + (qs ? `?${qs}` : ""));
    },
    [state, pathname, replace]
  );

  return { state, set };
}
