import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { ApiBaseUrl } from "src/models/BoMOnlineAPI";
import { determineLanguage } from "src/models/Utils";

// Cache by (query, text) so each phrase is fetched at most once per session.
const cache = new Map();
export function __clearHighlightCache() { cache.clear(); }

/** Fetch the semantic-highlight {start,end} range for one (query,text). Never throws; null on miss/error. */
export async function fetchHighlightRange(query, text) {
  if (!query || !text) return null;
  const cacheKey = query + " " + text;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const gql = `{ highlight(query: ${JSON.stringify(query)}, text: ${JSON.stringify(text)}) { start end } }`;
  try {
    const lang = determineLanguage();
    const res = await axios({
      method: "post",
      url: ApiBaseUrl + (lang ? "/" + lang : ""),
      headers: { "Content-Type": "application/json" },
      data: { query: gql },
    });
    const range = res?.data?.data?.highlight ?? null;
    cache.set(cacheKey, range);
    return range;
  } catch {
    return null;
  }
}

// Internal pointer so tests can replace fetchHighlightRange via jest.mock and have the
// hook pick up the replacement (babel-jest mock replaces the export binding, not the
// module-internal closure; this cell is re-read on each hook invocation).
export const _api = { fetchHighlightRange };

export function useHighlightRange(query, text, enabled) {
  const [range, setRange] = useState(null);
  const ref = useRef(null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !enabled || !text || !query) return undefined;
    const run = () => {
      if (done.current) return;
      done.current = true;
      _api.fetchHighlightRange(query, text).then((r) => { if (r) setRange(r); });
    };
    if (typeof IntersectionObserver === "undefined") { run(); return undefined; }
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { run(); io.disconnect(); }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [query, text, enabled]);
  return [range, ref];
}
