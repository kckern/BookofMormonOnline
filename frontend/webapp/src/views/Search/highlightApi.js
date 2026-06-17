import axios from "axios";
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
