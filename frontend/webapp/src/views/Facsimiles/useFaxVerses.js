import { useEffect, useState } from "react";
import BoMOnlineAPI, { renderBaseUrl } from "src/models/BoMOnlineAPI";
import {
  chunkIds, mergeBoxes, chapterRefsForVerseIds, indexReadByVerse,
  hydrateVerses, spreadVerseIds,
} from "./faxVerseData";

const EMPTY = { versesByPage: new Map(), pageScale: 700 };
// Wait for the spread to settle after a turn before hydrating, so riffling
// doesn't queue a fetch per intermediate spread.
const SETTLE_MS = 150;

/**
 * Verse boxes + text for the visible spread, grouped by scan page.
 * @returns { versesByPage: Map<imagePage, Array<verse>>, pageScale }
 */
export function useFaxVerses(version, leftLeaf, rightLeaf) {
  const [state, setState] = useState(EMPTY);
  const ids = spreadVerseIds(leftLeaf, rightLeaf);
  // Effect identity: refetch only when version or the id set changes.
  const key = version ? `${version}:${ids.join("-")}` : "";

  useEffect(() => {
    if (!version || ids.length === 0) { setState(EMPTY); return undefined; }
    let cancelled = false;
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const boxResponses = await Promise.all(
          chunkIds(ids).map((chunk) =>
            fetch(`${renderBaseUrl}/fax/boxes/${version}/ids/${chunk.join("-")}`, { signal: ac.signal })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null))
        );
        const { pageScale, byPageVerse } = mergeBoxes(boxResponses.filter(Boolean));
        const chapters = await Promise.all(
          chapterRefsForVerseIds(ids).map((ch) =>
            Promise.resolve(BoMOnlineAPI({ read: [ch] }))
              .then((r) => (r && r.read && r.read[ch]) || null)
              .catch(() => null))
        );
        const textByVerse = indexReadByVerse(chapters.filter(Boolean));
        if (!cancelled) setState({ pageScale, versesByPage: hydrateVerses(byPageVerse, textByVerse) });
      } catch {
        if (!cancelled) setState(EMPTY);
      }
    }, SETTLE_MS);
    return () => { cancelled = true; ac.abort(); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
