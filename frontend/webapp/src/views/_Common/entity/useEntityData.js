import { useEffect, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

// Query key + response key per entity type. These are the same keys the popup
// bodies use (BoMOnlineAPI({ person: [...] }) → response.person), so the page
// and the modal read identically shaped records.
const QUERY = {
  people: { key: "person", cache: ["person"] },
  places: { key: "places", cache: [] },
  matters: { key: "matter", cache: ["matter"] },
  history: { key: "history", cache: [] },
};

/**
 * Page-mode data fetch. Deliberately keeps its result in LOCAL state rather
 * than appController.popUpData: writing popUpData goes through setPopUp, which
 * would open the modal. Costs one extra request when a visitor opens a modal
 * for the same entity they already viewed as a page; buys complete isolation
 * from the click path.
 */
export default function useEntityData(type, slug) {
  const [state, setState] = useState({ data: null, status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const spec = QUERY[type];
    if (!spec || !slug) {
      setState({ data: null, status: "missing" });
      return undefined;
    }
    setState({ data: null, status: "loading" });
    const opts = spec.cache.length ? { useCache: spec.cache } : undefined;
    BoMOnlineAPI({ [spec.key]: [slug] }, opts).then((response) => {
      if (cancelled) return;
      const record = response?.[spec.key]?.[slug] ?? null;
      setState({ data: record, status: record ? "ready" : "missing" });
    });
    return () => {
      cancelled = true;
    };
  }, [type, slug]);

  return state;
}
