import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";

/**
 * The default reading-plan program and its preview segments — the bubble grid
 * the reading-plan tile shows guests (and signed-in readers with no plan).
 *
 * It took two chained requests (programs → preview) before the grid could
 * render, so the grid popped in 1-3s after first paint and shoved the whole
 * page down. The data is static per program, so cache it: in memory (one fetch
 * per page load, shared by concurrent callers) and in localStorage (a returning
 * reader paints the final grid on the first render).
 */
const KEY = "bom:planPreview:v1";
export const PLAN_PREVIEW_TTL_MS = 24 * 3600 * 1000;

let inflight = null;

export function _resetForTests() {
  inflight = null;
}

function store() {
  try {
    return typeof window === "undefined" ? null : window.localStorage || null;
  } catch {
    return null;
  }
}

/** Cached { title, durationLabel, segments } synchronously, or null. */
export function readPlanPreview(nowMs = Date.now()) {
  try {
    const entry = JSON.parse(store()?.getItem(KEY) || "null");
    if (!entry?.preview || nowMs - entry.savedAt > PLAN_PREVIEW_TTL_MS) return null;
    return entry.preview;
  } catch {
    return null;
  }
}

async function fetchPlanPreview() {
  const r = await BoMOnlineAPI({ readingplanprograms: null });
  const prog = Object.values(r?.readingplanprograms || {})[0] || null;
  if (!prog) return null;
  const pv = await BoMOnlineAPI({ readingplanpreview: { config: prog.config } }, { useCache: false });
  const raw = pv?.readingplanpreview;
  // key:0 queries resolve to the object itself; array/keyed shapes are fallbacks.
  const p = raw?.segments || raw?.parts !== undefined ? raw
    : Array.isArray(raw) ? raw[0] : Object.values(raw || {})[0];
  return { title: prog.title, durationLabel: prog.durationLabel, segments: (p?.segments || []).map((s) => ({ ref: s.ref })) };
}

/** Fetch (once per page load) and cache the preview. Resolves null on failure. */
export function loadPlanPreview() {
  if (!inflight) {
    inflight = fetchPlanPreview()
      .then((preview) => {
        if (preview?.segments?.length) {
          try {
            store()?.setItem(KEY, JSON.stringify({ preview, savedAt: Date.now() }));
          } catch {
            /* quota / disabled storage — memory copy still serves this load */
          }
        }
        return preview;
      })
      .catch((e) => {
        console.warn("planPreview:", e?.message || e);
        inflight = null; // let a later caller retry
        return null;
      });
  }
  return inflight;
}
