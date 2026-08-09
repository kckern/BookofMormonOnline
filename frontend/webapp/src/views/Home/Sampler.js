import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import Masonry from "react-masonry-css";
import { tileRegistry, reservePool, batchTiles } from "./tiles/registry";
import { read as readCache, write as writeCache, isFresh as cacheIsFresh } from "./tiles/homeSamplerCache";
import "./Sampler.css";
import "./Sampler.m.css";

const MAX_RESERVES = 5;

/** Fresh random seed for a manual refresh (explicit → server-fresh, uncached). */
const randomSeed = () => Math.floor(Math.random() * (2 ** 31 - 1)) + 1;

/** Fisher–Yates: the VARIABLE tiles refit randomly each load (fixed ones don't). */
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// FIXED tiles hold anchored slots: the left rail (reading plan → narration →
// contents) and people at the top of the main grid. Everything else is
// VARIABLE — shuffled per load and bin-packed by grid-auto-flow: dense.
const FIXED_LEFT = ["readingplan", "section", "contents"];
const FIXED_TOP = ["people"];
// FIXED_TAIL renders once at the END of the first-batch masonry — the feature
// tile slot (map-story). Below the fold, never repeated by the infinite feed.
const FIXED_TAIL = ["mapstory"];

// ---- infinite scroll -------------------------------------------------------
// The fixed panels (rail: reading plan → narration → contents → community; top:
// people) and the first tile batch render once. Past that, the page grows by
// appending fresh batches under new seeds. The repeatable tile types are
// `batchTiles`, imported from the registry.
const MAX_BATCHES = 30; // backstop against a runaway fetch loop; effectively infinite for a reader
const nextBatchSeed = (s) => ((s + 1013904223) % 2147483647) || 1;

/**
 * The cacheable content tiles. Public, seeded server-side — this is what the
 * client cache stores and paints instantly. `commentaries` maps to three 1:1
 * registry keys.
 */
export const assembleSampler = (r) => {
  const sampler = r?.homesampler?.[0] || {};
  const [commentary, commentary2, commentary3] = sampler.commentaries || [];
  return { ...sampler, commentary, commentary2, commentary3 };
};

/**
 * The live community payload (never cached): liveliest groups first, fresh
 * messages under group chips, one finisher row. Membership system events are
 * filtered; stale timestamps degrade to reading-progress rows. Returns null when
 * there is nothing to show.
 */
export const assembleCommunity = (r) => {
  const groups = r?.homegroups || [];
  const board = r?.leaderboard?.[0] || {};
  const dedupe = (users) => {
    const seen = new Set();
    return (users || []).filter((u) => {
      const k = u?.nickname;
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const FRESH_MS = 90 * 86400 * 1000;
  const sorted = groups
    .filter((g) => g?.url)
    .sort((a, b) => (b.latest?.timestamp || 0) - (a.latest?.timestamp || 0));
  const messages = sorted
    .filter((g) => g.latest?.timestamp && !/\b(joined|left)\.?\s*$/i.test((g.latest.msg || "").trim()))
    .slice(0, 3)
    .map((g) => ({
      ...g.latest,
      channel: g.url,
      groupName: g.name,
      fresh: g.latest.timestamp > Date.now() - FRESH_MS,
    }));
  const finishers = dedupe(board.recentFinishers).slice(0, 4);
  const reading = dedupe(board.currentProgress).slice(0, 3);
  return sorted.length || finishers.length
    ? { groups: sorted.slice(0, 3), moreGroups: Math.max(0, sorted.length - 3), messages, reading, finishers }
    : null;
};

/** Compose both streams — kept for callers/tests that want the merged shape. */
export const assemblePayload = (r) => ({ ...assembleSampler(r), community: assembleCommunity(r) });

export default function Sampler() {
  const appController = useAppController();
  const token = appController.states.user.token;
  // Cache read is synchronous, so a warm entry paints on the FIRST render — no
  // skeleton flash. cachedRef survives re-renders and records freshness.
  const cachedRef = useRef(readCache());
  // Two independent streams. The render payload derives from the SAMPLER only, so
  // community landing first can never blank the page (it just fills its own tile).
  const [samplerPayload, setSamplerPayload] = useState(() => cachedRef.current?.payload ?? null);
  const [community, setCommunity] = useState(null);
  const [failed, setFailed] = useState(false);
  const payload = useMemo(
    () => (samplerPayload ? { ...samplerPayload, community } : null),
    [samplerPayload, community],
  );
  // Seed of the current sampler payload — drives infinite-scroll batch seeds.
  const seed = samplerPayload?.seed || 0;
  const [variableTiles, setVariableTiles] = useState(() =>
    shuffle(tileRegistry.filter((t) => !FIXED_LEFT.includes(t.key) && !FIXED_TOP.includes(t.key) && !FIXED_TAIL.includes(t.key))),
  );
  // Reserve tiles activated by the balancer: [{ key, side: "rail"|"main" }].
  const [reserves, setReserves] = useState([]);
  // Bumped a few times after load so the balancer re-measures once async
  // content (images, lazy tiles) has reflowed the columns.
  const [settleTick, setSettleTick] = useState(0);
  const railRef = useRef(null);
  const mainRef = useRef(null);

  // ---- infinite-scroll state ----------------------------------------------
  // extraBatches: revealed batches below the first, each { payload, tiles }.
  // A single batch is always prefetched into reserveRef ("reserve API call in
  // the background") so reveal is instant; refs hold the cross-callback state
  // so the IntersectionObserver never reads stale closures.
  const [extraBatches, setExtraBatches] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const reserveRef = useRef(null);      // { payload, tiles } prefetched, not yet shown
  const fetchingRef = useRef(false);
  const atBottomRef = useRef(false);
  const batchSeedRef = useRef(0);
  const sentinelRef = useRef(null);
  const loadMoreRef = useRef(() => {}); // latest maybeLoadMore, for the observer
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Community stream — always live, never cached. Fills its own tile when it
  // lands; a failure just leaves the community tile empty (non-fatal).
  const fetchCommunity = () => {
    BoMOnlineAPI({ homegroups: { token }, leaderboard: { token } }, { useCache: false })
      .then((r) => {
        if (!mountedRef.current || r?.error) return;
        setCommunity(assembleCommunity(r));
      })
      .catch(() => {});
  };

  // Sampler stream. `explicitSeed` null → front-door (server picks the shared
  // window seed, cacheable). `swap` → paint the result (cold load / manual
  // refresh); when false (stale revalidate) we only refresh the cache so the
  // fresh sample applies on the NEXT load without disturbing the current view.
  const fetchSampler = (explicitSeed, swap, attempt = 0) => {
    const input = { homesampler: explicitSeed ? { seed: explicitSeed } : {} };
    BoMOnlineAPI(input, { useCache: false })
      .then((r) => {
        if (!mountedRef.current) return;
        if (r?.error || !Array.isArray(r?.homesampler)) throw new Error("homesampler unavailable");
        const sp = assembleSampler(r);
        writeCache(sp, sp.seed);
        cachedRef.current = { payload: sp, seed: sp.seed };
        if (swap) setSamplerPayload(sp);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        if (attempt < 1) fetchSampler(explicitSeed, swap, attempt + 1);
        // Only fall back to the empty-state footer when there is nothing to show.
        else if (swap && !samplerPayload) setFailed(true);
      });
  };

  // Manual refresh: a fresh random seed → server-fresh sample, swap the view
  // (explicit action), overwrite the cache. Refitted variables + a fresh feed.
  const resample = () => {
    setSamplerPayload(null);
    setCommunity(null);
    setFailed(false);
    setReserves([]);
    setVariableTiles(shuffle(tileRegistry.filter((t) => !FIXED_LEFT.includes(t.key) && !FIXED_TOP.includes(t.key) && !FIXED_TAIL.includes(t.key))));
    // reset infinite-scroll accumulation so the fresh seed starts a fresh feed
    setExtraBatches([]);
    reserveRef.current = null;
    fetchingRef.current = false;
    batchSeedRef.current = 0;
    fetchSampler(randomSeed(), true);
    fetchCommunity();
  };

  // The reload control now lives on the Home tab bar (see HomeTabs); it fires a
  // window `home:resample` event. Bridge it to resample via a ref so the
  // once-bound listener always calls the latest closure.
  const resampleRef = useRef(resample);
  resampleRef.current = resample;
  useEffect(() => {
    const handler = () => resampleRef.current();
    window.addEventListener("home:resample", handler);
    return () => window.removeEventListener("home:resample", handler);
  }, []);

  // ---- reserve balancing ---------------------------------------------------
  // Measure the rail vs the masonry after each layout; if one column is
  // meaningfully shorter, pull in the next eligible reserve tile on that side
  // and re-measure. Converges when the columns bottom out together (or the
  // pool/cap is hit). The map is masonry-only, so it lands below the fold.
  useLayoutEffect(() => {
    if (!payload || reserves.length >= MAX_RESERVES) return;
    const railH = railRef.current?.offsetHeight || 0;
    const mainH = mainRef.current?.offsetHeight || 0;
    if (!railH || !mainH) return;
    const delta = mainH - railH; // >0 → masonry taller, rail is short
    const THRESHOLD = 160; // px; below this the columns read as balanced
    if (Math.abs(delta) < THRESHOLD) return;
    const shorter = delta > 0 ? "rail" : "main";
    const used = new Set(reserves.map((r) => r.key));
    const next = reservePool.find(
      (r) => !used.has(r.key) && r.isReady(payload) && !(r.mainOnly && shorter === "rail"),
    );
    if (!next) return;
    setReserves((prev) => [...prev, { key: next.key, side: next.mainOnly ? "main" : shorter }]);
  }, [payload, reserves, settleTick]);

  // Re-measure a few times after load: images and the lazy map change column
  // heights after the first paint, so a single measurement can converge early.
  useEffect(() => {
    if (!payload) return undefined;
    const timers = [400, 1200, 2600].map((ms) => setTimeout(() => setSettleTick((t) => t + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [payload]);

  const renderReserve = ({ key }) => {
    const def = reservePool.find((r) => r.key === key);
    if (!def || !payload) return null;
    const Tile = def.component;
    const props = { ...(def.props || {}), payload };
    if (def.dataKey) props.data = payload[def.dataKey];
    if (def.seedOffset) props.seed = (payload.seed || 0) + def.seedOffset;
    return (
      <div key={`reserve-${key}`} className={`tile tile-${key}`}>
        <Tile {...props} />
      </div>
    );
  };

  // ---- infinite scroll: prefetch + reveal ---------------------------------
  // Fetch the next batch (homesampler only — community/leaderboard don't repeat)
  // into reserveRef. If the reader is already waiting at the bottom when it
  // lands, reveal it immediately.
  const prefetchBatch = () => {
    if (fetchingRef.current || reserveRef.current || extraBatches.length >= MAX_BATCHES) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    const bs = (batchSeedRef.current = nextBatchSeed(batchSeedRef.current || seed));
    BoMOnlineAPI({ homesampler: { seed: bs, token } }, { useCache: false })
      .then((r) => {
        fetchingRef.current = false;
        if (!mountedRef.current) return;
        setLoadingMore(false);
        if (r?.error || !Array.isArray(r?.homesampler)) return;
        reserveRef.current = { payload: assembleSampler(r), tiles: shuffle(batchTiles) };
        if (atBottomRef.current) maybeLoadMore();
      })
      .catch(() => { fetchingRef.current = false; if (mountedRef.current) setLoadingMore(false); });
  };

  // Reveal the prefetched batch (appending it) and queue the next; or, if none
  // is ready yet, kick off the fetch so it arrives. One batch per API round
  // trip — the fetch guard paces it, so a reader parked at the bottom pulls in
  // batches steadily without a runaway loop.
  function maybeLoadMore() {
    if (!payload || extraBatches.length >= MAX_BATCHES) return;
    if (reserveRef.current) {
      const batch = reserveRef.current;
      reserveRef.current = null;
      setExtraBatches((prev) => [...prev, batch]);
      prefetchBatch();
    } else {
      prefetchBatch();
    }
  }
  loadMoreRef.current = maybeLoadMore;

  // Infinite-scroll prefetch is DEFERRED to scroll intent (no mount-time primer):
  // the observer below fires the first batch fetch as the reader nears the
  // bottom, so a warm instant-paint costs zero network until the reader scrolls.

  // Watch a sentinel below the feed; reveal/prefetch as it nears the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !payload || typeof IntersectionObserver === "undefined") return undefined;
    // Eager feed: keep ~2 viewport heights of content loaded ahead of the fold.
    // The sentinel "intersects" while still two screens below the viewport, so
    // each reveal grows the columns and re-fires the observer, cascading batches
    // in until the sentinel is finally >2vp away. The prefetch guard paces the
    // network round-trips so it never runs away.
    const eagerMargin = Math.max(1200, Math.round((window.innerHeight || 800) * 2));
    const io = new IntersectionObserver(
      (entries) => {
        atBottomRef.current = entries[0].isIntersecting;
        if (entries[0].isIntersecting) loadMoreRef.current();
      },
      { rootMargin: `${eagerMargin}px 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [payload]);

  const renderBatchTile = (bp, def, idx) => {
    if (!def.isReady(bp)) return null;
    const Tile = def.component;
    const data = def.dataKey ? bp[def.dataKey] : bp[def.key];
    return (
      <div key={`${def.key}-${idx}`} className={`tile infiniteTile ${def.span}`}>
        <Tile data={data} next={bp[`${def.key}Next`]} seed={bp.seed} payload={bp} {...(def.props || {})} />
      </div>
    );
  };

  useEffect(() => {
    document.title = label("home_title");
    // Always open the home sampler at the top — arriving from a scrolled-down
    // page (SPA nav preserves scroll) otherwise drops you mid-page.
    window.scrollTo(0, 0);
    const panel = document.getElementById("main-panel");
    if (panel) panel.scrollTop = 0;
  }, []);

  // Sampler stream — once on mount. A fresh cached entry already painted
  // synchronously, so skip the network entirely; a stale entry revalidates
  // behind the current view; a cold start fetches and paints.
  useEffect(() => {
    const entry = cachedRef.current;
    if (entry && cacheIsFresh(entry)) return; // fresh → instant paint, no fetch
    fetchSampler(null, /* swap */ !entry); // cold → swap in; stale → cache-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Community stream — always live; refetch when the auth token resolves/changes.
  useEffect(() => {
    fetchCommunity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (failed) return <SamplerFallback />;

  const renderTile = ({ key, component: Tile, span, isReady }, spanOverride) => {
    if (!payload) return <div key={key} className={`tile skeleton ${span}`} />;
    if (!isReady(payload)) return null;
    return (
      <div key={key} className={`tile ${spanOverride || span}`}>
        <Tile data={payload[key]} next={payload[`${key}Next`]} seed={payload.seed} payload={payload} />
      </div>
    );
  };

  // ---- balanced binning ---------------------------------------------------
  // Estimate each tile's height (rem) from the payload, then greedily assign
  // variable tiles to the currently-shorter side. Ragged bottoms are fine;
  // lopsided columns are not. Variable tiles may spill under contents.
  const est = (key) => {
    if (!payload) return 14;
    switch (key) {
      case "readingplan": return 15;
      case "section": {
        const beats = (payload.section?.rows || []).filter((r) => r?.narration).length;
        const nextBeats = beats < 6 ? (payload.sectionNext?.rows || []).length : 0;
        return 8 + (beats + nextBeats) * 2.4;
      }
      case "contents": return 12 + ((payload.contents?.pages || []).length || 5) * 2.6;
      // calibrated against measured render heights (2026-07-15, 1400px vp)
      case "people": return 46;
      case "text": return 16;
      case "commentary":
      case "commentary2":
      case "commentary3": return 23;
      case "history": return 30;
      case "fax": return 30; // natural-height pages + edition covers
      case "places": return 20;
      // matters grid tiles share the Places footprint
      case "mattersNarrative":
      case "mattersMaterial":
      case "mattersConcept": return 20;
      case "community": return 8 + (payload.community?.groups?.length || 0) * 4 + (payload.community?.messages?.length || 0) * 2.5;
      case "biblephrases": return 20;
      case "chiasmus": return 20;
      case "notes": return 24;
      case "faxVerse": return 30;
      case "mapstory": return 40;
      default: return 14;
    }
  };
  const leftTiles = FIXED_LEFT.map((k) => tileRegistry.find((t) => t.key === k)).filter(Boolean);
  // Totals FIRST, then move tiles: the old greedy pass compared each tile
  // against a not-yet-grown grid estimate and never railed anything.
  const railExtra = [];
  const gridVars = [...variableTiles];
  let leftH = leftTiles.reduce((a, t) => a + est(t.key), 0);
  // masonry is 2-up: each variable tile costs half its height in column terms
  let rightH =
    est("people") +
    gridVars.reduce((a, t) => (payload && t.isReady(payload) ? a + est(t.key) / 2 : a), 0);
  // While the rail runs short, pull the best-fitting tile over. The text tile
  // is designed for width — never strand it in the narrow rail (round-6
  // review: a rail-binned scripture tile ended the page on a viewport void).
  for (;;) {
    const deficit = rightH - leftH;
    if (deficit <= 12) break;
    // moving a tile of height e shifts the delta by 1.5e (rail +e, grid −e/2);
    // pick the move that lands the delta closest to zero, and only if it helps
    let best = -1;
    let bestAfter = deficit;
    gridVars.forEach((t, i) => {
      if (t.key === "text" || !payload || !t.isReady(payload)) return;
      const after = Math.abs(deficit - est(t.key) * 1.5);
      if (after < bestAfter) { bestAfter = after; best = i; }
    });
    if (best === -1) break;
    const [t] = gridVars.splice(best, 1);
    railExtra.push(t);
    leftH += est(t.key);
    rightH -= est(t.key) / 2;
  }
  const topTiles = FIXED_TOP.map((k) => tileRegistry.find((t) => t.key === k)).filter(Boolean);

  // Anti-stacking: the three commentary tiles must not read as a spam column.
  // react-masonry-css fills columns round-robin (item j → column j % cols), so
  // items an even distance apart share a column and stack. Interleave the
  // commentary tiles evenly among the OTHER tiles — but only among tiles that
  // will actually render (not-ready ones drop to null and shift every column),
  // so we filter to renderable first, then space commentary out.
  const isCommentary = (t) => /^commentary/.test(t.key);
  // During loading (no payload) keep every tile so its skeleton renders (no
  // layout shift); once loaded, keep only the ready ones.
  const renderable = gridVars.filter((t) => !payload || t.isReady(payload));
  const commentaryTiles = renderable.filter(isCommentary);
  const orderedGrid = renderable.filter((t) => !isCommentary(t));
  if (commentaryTiles.length) {
    // even fractional spacing, offset so the first isn't at index 0 (keeps a
    // non-commentary tile leading each column); re-inserting front-to-back
    // keeps later indices valid.
    const slots = orderedGrid.length + commentaryTiles.length;
    commentaryTiles.forEach((c, i) => {
      const at = Math.min(orderedGrid.length, Math.round(((i + 0.5) / commentaryTiles.length) * slots));
      orderedGrid.splice(at, 0, c);
    });
  }

  // ---- infinite tiles across the 3 live columns ---------------------------
  // Each incoming tile lands on the shortest of { rail, main-A, main-B }
  // (approximated by est) so it meets the bottom of whatever's already in that
  // column — real 3-column infinite scroll, no baseline reset. The rail is a
  // single column we fill directly; the two main columns are still spread by
  // react-masonry-css (round-robin by index), so we only decide rail-vs-main
  // here and let the masonry split the main share across its pair.
  const estBatch = (key) => {
    switch (key) {
      case "personProfile": return 24;
      case "placeProfile": return 22;
      case "matterProfile": return 22;
      case "witness": return 26;
      case "art":
      case "artB": return 24;
      default: return est(key);
    }
  };
  const railInfinite = [];
  const mainInfinite = [];
  let railH = leftH;      // approx current rail column height
  let mainColH = rightH;  // approx current per-column main height (incl people)
  extraBatches.forEach((b, bi) => {
    b.tiles.forEach((def, ti) => {
      const node = renderBatchTile(b.payload, def, `${bi}-${ti}`);
      if (!node) return;
      const e = estBatch(def.key);
      if (railH <= mainColH) { railInfinite.push(node); railH += e; }
      else { mainInfinite.push(node); mainColH += e / 2; }
    });
  });
  // Skeleton loaders while the next batch is in flight — same 3-column
  // balancing so they appear right at the growing edge.
  if (loadingMore && extraBatches.length < MAX_BATCHES) {
    ["tile-art", "tile-commentary", "tile-history"].forEach((span, i) => {
      const node = <div key={`sk-${extraBatches.length}-${i}`} className={`tile skeleton ${span}`} />;
      if (railH <= mainColH) { railInfinite.push(node); railH += 12; }
      else { mainInfinite.push(node); mainColH += 6; }
    });
  }

  return (
    <div className="sampler container">
      <div className="samplerColumns">
        <div className="samplerLeftRail" ref={railRef}>
          {leftTiles.map((t) => renderTile(t))}
          {railExtra.map((t) => renderTile(t))}
          {reserves.filter((r) => r.side === "rail").map(renderReserve)}
          {/* infinite-scroll tiles continue the rail's ragged bottom */}
          {railInfinite}
        </div>
        {/* three top-level panels: rail | people (fixed) | masonry of the rest.
            Masonry frees tile heights from each other — no row-matching voids.
            Balancer reserves land on the shorter side; the map goes here, low. */}
        <div className="samplerMain" ref={mainRef}>
          {topTiles.map((t) => renderTile(t))}
          {/* infinite-scroll tiles continue the two main columns' ragged bottom
              (react-masonry-css spreads them across its pair, appending) */}
          <Masonry
            breakpointCols={{ default: 2, 800: 1 }}
            className="samplerMasonry"
            columnClassName="samplerMasonryCol"
          >
            {[
              ...orderedGrid.map((t) => renderTile(t)),
              ...FIXED_TAIL.map((k) => tileRegistry.find((t) => t.key === k))
                .filter(Boolean)
                .map((t) => renderTile(t)),
              ...reserves.filter((r) => r.side === "main").map(renderReserve),
              ...mainInfinite,
            ].filter(Boolean)}
          </Masonry>
        </div>
      </div>

      {/* Sentinel sits below the three columns; nearing it reveals the next
          prefetched batch and queues another. Skeletons above (inside the
          columns) cover the wait. */}
      {payload ? (
        <div ref={sentinelRef} className="samplerSentinel" aria-hidden="true" />
      ) : null}
    </div>
  );
}

/** Whole-query failure: never render a blank homepage. */
export function SamplerFooter() {
  const links = [
    ["contents", "/contents"],
    ["people", "/people"],
    ["places", "/places"],
    ["community", "/home/community"],
    ["search", "/search"],
  ];
  return (
    <div className="samplerFooter noselect">
      {links.map(([key, to]) => (
        <Link key={key} to={to} className="samplerFooterLink">
          {label(key)}
        </Link>
      ))}
    </div>
  );
}

function SamplerFallback() {
  return (
    <div className="sampler container">
      <div className="samplerFallback">
        <SamplerFooter />
      </div>
    </div>
  );
}
