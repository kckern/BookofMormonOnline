/**
 * samplerSession — per-tab snapshot of the Home layout the reader is looking at.
 *
 * The sampler shuffles its variable tiles on every mount and keeps revealed
 * infinite-scroll batches in component state, so leaving Home (a tile link, a
 * tab switch) and coming Back used to rebuild a DIFFERENT page: new order, no
 * batches, and nothing for the route scroll-restore to land on. This snapshot
 * lets the next mount rebuild the same page instead.
 *
 * Keyed by the sampler seed: a new 6h window or a manual resample is a new
 * seed, so a stale snapshot is simply ignored. sessionStorage, not
 * localStorage — it's "where I was in this tab", not a preference.
 *
 * Shape: { seed, order: [variable tile keys], reserves: [{ key, side }],
 *          batches: [{ payload, tiles: [batch tile keys] }], batchSeed }
 *
 * Every access is guarded and never throws (disabled storage, SSR, quota).
 */

const KEY = "bom:homeSession:v1";
// A batch payload is ~95KB; cap what we persist so a long scroll can't blow the
// ~5MB quota. Batches past the cap are re-fetched as the reader scrolls on.
export const MAX_STORED_BATCHES = 8;

function store() {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage || null;
  } catch {
    return null;
  }
}

/** The snapshot for `seed`, or null when there is none for that seed. */
export function readSession(seed) {
  const ss = store();
  if (!ss || !seed) return null;
  try {
    const snap = JSON.parse(ss.getItem(KEY) || "null");
    if (!snap || snap.seed !== seed || !Array.isArray(snap.order)) return null;
    return snap;
  } catch {
    return null;
  }
}

/** Best-effort save; on quota errors, drop the batches and keep the layout. */
export function writeSession(snapshot) {
  const ss = store();
  if (!ss) return;
  const full = { ...snapshot, batches: (snapshot.batches || []).slice(0, MAX_STORED_BATCHES) };
  try {
    ss.setItem(KEY, JSON.stringify(full));
  } catch {
    try {
      ss.setItem(KEY, JSON.stringify({ ...full, batches: [] }));
    } catch {
      /* storage unavailable — the page just won't be restorable */
    }
  }
}

export function clearSession() {
  try {
    store()?.removeItem(KEY);
    store()?.removeItem(ANCHOR_KEY);
    store()?.removeItem(EXPANDED_KEY);
  } catch {
    /* ignore */
  }
}

// The tile the reader was looking at (scrollAnchor.captureAnchor), saved on
// scroll. Kept apart from the snapshot so a scroll never re-serialises batches.
const ANCHOR_KEY = "bom:homeAnchor:v1";

export function writeAnchor(seed, anchor) {
  try {
    if (seed && anchor) store()?.setItem(ANCHOR_KEY, JSON.stringify({ seed, ...anchor }));
  } catch {
    /* quota / disabled storage — Back falls back to the shell's scrollY restore */
  }
}

export function readAnchor(seed) {
  try {
    const a = JSON.parse(store()?.getItem(ANCHOR_KEY) || "null");
    if (!a || !seed || a.seed !== seed || !Number.isInteger(a.index)) return null;
    return { index: a.index, cls: a.cls, offset: a.offset };
  } catch {
    return null;
  }
}

// Layer-1 reveals the reader opened (ExpandableText persistKey), so Back lands
// on the same, still-expanded tile rather than a shorter collapsed one whose
// Layer-2 link has vanished. Cleared with the snapshot on a resample.
const EXPANDED_KEY = "bom:homeExpanded:v1";

const readExpandedSet = () => {
  try {
    const a = JSON.parse(store()?.getItem(EXPANDED_KEY) || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

export function readExpanded(key) {
  return !!key && readExpandedSet().includes(key);
}

export function writeExpanded(key, open) {
  if (!key) return;
  try {
    const set = readExpandedSet().filter((k) => k !== key);
    if (open) set.push(key);
    store()?.setItem(EXPANDED_KEY, JSON.stringify(set.slice(-50)));
  } catch {
    /* storage unavailable — the reveal just won't survive a Back */
  }
}
