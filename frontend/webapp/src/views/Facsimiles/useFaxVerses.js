import { useEffect, useState } from "react";
import BoMOnlineAPI, { renderBaseUrl } from "src/models/BoMOnlineAPI";
import {
  chunkIds, mergeBoxes, chapterRefsForVerseIds, indexReadByVerse,
  hydrateVerses, spreadVerseIds,
} from "./faxVerseData";

// `ready` reports whether the boxes for THE CURRENT spread have resolved — it's
// derived by matching the loaded data's `forKey` to the live key, so stale-but-
// resolved data from the previous spread never reads ready during a page/verse
// change. A deep-link uses it to tell "still loading" from "loaded, but this verse
// has no hotspot here" (a URL-hacked / unindexed verse) and give up cleanly.
const EMPTY = { versesByPage: new Map(), pageScale: 700, ready: false, forKey: null };
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
    if (!version || ids.length === 0) { setState({ ...EMPTY, ready: true, forKey: key }); return undefined; }
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
        const [chapters, locList] = await Promise.all([
          Promise.all(
            chapterRefsForVerseIds(ids).map((ch) =>
              Promise.resolve(BoMOnlineAPI({ read: [ch] }))
                .then((r) => (r && r.read && r.read[ch]) || null)
                .catch(() => null))
          ),
          // Study page + section (title + slug) per verse, for the "Page > Section" links.
          Promise.resolve(BoMOnlineAPI({ faxVerseLocations: ids }))
            .then((r) => (r && r.faxVerseLocations) || [])
            .catch(() => []),
        ]);
        const textByVerse = indexReadByVerse(chapters.filter(Boolean));
        const locByVerse = new Map();
        for (const l of locList) {
          if (l && l.verse_id != null) locByVerse.set(l.verse_id, { page: l.page || null, section: l.section || null });
        }
        if (!cancelled) setState({ pageScale, versesByPage: hydrateVerses(byPageVerse, textByVerse, locByVerse), ready: true, forKey: key });
      } catch {
        if (!cancelled) setState({ ...EMPTY, ready: true, forKey: key });
      }
    }, SETTLE_MS);
    return () => { cancelled = true; ac.abort(); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // ready is true only when the resolved data is for the CURRENT key — stale data
  // from the spread we just left reads as not-ready, so the deep-link fallback can't
  // misfire on it mid-transition.
  return { versesByPage: state.versesByPage, pageScale: state.pageScale, ready: state.ready && state.forKey === key };
}
