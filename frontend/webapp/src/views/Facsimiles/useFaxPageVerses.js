import { useEffect, useState } from "react";
import { lookupReference } from "scripture-guide";
import BoMOnlineAPI, { renderBaseUrl } from "src/models/BoMOnlineAPI";
import {
  chunkIds, mergeBoxes, chapterRefsForVerseIds, indexReadByVerse, hydrateVerses,
} from "./faxVerseData";

// Per-page verse cache, shared across every mounted row so scrolling back over a
// page never refetches. Keyed by `${version}:${imagePage}`.
const pageCache = new Map();

/**
 * Verse hotspot boxes + text for ONE leaf's page, fetched lazily when the row
 * mounts (the mobile scroll viewer windows its rows, so only near-viewport pages
 * ever fetch). Mirrors useFaxVerses' hydration but for a single page.
 *
 * @returns { verses: Array<verse>, pageScale } — verse = { verse_id, ref, boxes, text, person_slug, voice }
 */
const EMPTY = { verses: [], pageScale: 700 };

export function useFaxPageVerses(version, leaf) {
  const page = leaf?.pageNumInt ?? null;
  const ref = leaf?.pageReference || null;
  const key = version && page != null && ref ? `${version}:${page}` : "";
  const [state, setState] = useState(() => (key && pageCache.has(key) ? pageCache.get(key) : EMPTY));

  useEffect(() => {
    if (!key) { setState(EMPTY); return undefined; }
    if (pageCache.has(key)) { setState(pageCache.get(key)); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const ids = (lookupReference(ref)?.verse_ids) || [];
        if (!ids.length) { pageCache.set(key, EMPTY); if (!cancelled) setState(EMPTY); return; }
        const boxResponses = await Promise.all(
          chunkIds(ids).map((chunk) =>
            fetch(`${renderBaseUrl}/fax/boxes/${version}/ids/${chunk.join("-")}`)
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
        const verses = hydrateVerses(byPageVerse, textByVerse, null).get(page) || [];
        const result = { verses, pageScale: pageScale || 700 };
        pageCache.set(key, result);
        if (!cancelled) setState(result);
      } catch {
        if (!cancelled) setState(EMPTY);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
