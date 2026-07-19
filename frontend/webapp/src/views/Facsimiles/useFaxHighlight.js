import { useEffect, useState } from "react";
import { lookupReference } from "scripture-guide";
import { renderBaseUrl } from "src/models/BoMOnlineAPI";

const EMPTY = { boxesByPage: new Map(), pageScale: 700, allPages: [], clamped: false };

/** Pure: fetch-JSON -> grouped highlight state. */
export function buildHighlightState(data) {
  const boxesByPage = new Map();
  for (const b of (data && data.boxes) || []) {
    const arr = boxesByPage.get(b.imagePage) || [];
    arr.push(b);
    boxesByPage.set(b.imagePage, arr);
  }
  return {
    boxesByPage,
    pageScale: (data && data.pageScale) || 700,
    allPages: [...boxesByPage.keys()].sort((a, z) => a - z),
    clamped: !!(data && data.clamped),
  };
}

/**
 * Fetch passage box coordinates for a fax edition + reference and group them by
 * scan page. `ref` is the viewer's URL reference (e.g. "mosiah.4.21"); resolved
 * to verse ids via scripture-guide, then fetched as an ids/ selector.
 */
export function useFaxHighlight(version, ref) {
  const [state, setState] = useState(EMPTY);
  useEffect(() => {
    if (!version || !ref) {
      setState(EMPTY);
      return;
    }
    const verseIds = (lookupReference(ref) || {}).verse_ids || [];
    if (!verseIds.length) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    fetch(`${renderBaseUrl}/fax/boxes/${version}/ids/${verseIds.join("-")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setState(buildHighlightState(data));
      })
      .catch(() => {
        if (!cancelled) setState(EMPTY);
      });
    return () => {
      cancelled = true;
    };
  }, [version, ref]);
  return state;
}
