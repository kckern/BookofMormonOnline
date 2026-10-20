import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigationType } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import Masonry from "react-masonry-css";
import { tileRegistry, reservePool, batchTiles } from "./tiles/registry";
import { arrangeArchives, featuredArchiveKeys } from "./tiles/archiveFeed";
import { featuredPlaceSlugs, rankPlaces, withoutSeenPlaces } from "./tiles/PlacesTile";
import { featuredMatterSlugs, withoutSeenMatters } from "./tiles/MattersGroupTile";
import { read as readCache, write as writeCache, isFresh as cacheIsFresh } from "./tiles/homeSamplerCache";
import { readSession, writeSession, clearSession, readAnchor, writeAnchor } from "./tiles/samplerSession";
import { findAnchor, findLink, pinAnchor, trackAnchor } from "./tiles/scrollAnchor";
import { singleColumnOrder, canGrowReserves, placeBatchTiles, spaceAcrossColumns } from "./tiles/samplerLayout";
import TileBoundary from "./tiles/_ds/TileBoundary";
import BoundedTile from "./tiles/_ds/BoundedTile";
import { TileIdentity } from "./tiles/_ds/tileIdentity";
import { skeletonHeight } from "./tiles/_ds/skeletonHeights";
import labelOr from "./tiles/_ds/labelOr";
import { isMessengerEnabled } from "src/models/featureFlags";
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
const BATCH_RETRY_MS = 1500;

// Below this width the rail + masonry stack into one column (Sampler.m.css uses
// the app's 900px breakpoint), so the sampler switches to a single curated order.
const SINGLE_COLUMN_QUERY = "(max-width: 900px)";
// In the single column the long fixtures get a VISIBLE height bound (fade +
// Read more ⇄ Show less, tiles/_ds/BoundedTile) instead of a silent clip.
const BOUNDED_SPANS = new Set(["tile-narration", "tile-contents"]);
const singleColumnMql = () =>
  typeof window !== "undefined" && window.matchMedia ? window.matchMedia(SINGLE_COLUMN_QUERY) : null;
function useSingleColumn() {
  const [single, setSingle] = useState(() => !!singleColumnMql()?.matches);
  useEffect(() => {
    const m = singleColumnMql();
    if (!m) return undefined;
    const on = () => setSingle(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return single;
}

const VARIABLE_DEFAULT = () =>
  tileRegistry.filter((t) => !FIXED_LEFT.includes(t.key) && !FIXED_TOP.includes(t.key) && !FIXED_TAIL.includes(t.key));
/** Registry entries for saved keys, dropping any that no longer exist. */
const fromKeys = (keys, pool) => keys.map((k) => pool.find((t) => t.key === k)).filter(Boolean);

/**
 * The cacheable content tiles. Public, seeded server-side — this is what the
 * client cache stores and paints instantly. `commentaries` maps to three 1:1
 * registry keys; `places` is ranked so the Places cards get real hooks.
 */
export const assembleSampler = (r) => {
  const sampler = r?.homesampler?.[0] || {};
  // distinct ids only: two slots never repeat one commentary (audit r4 H4)
  const seenCom = new Set();
  const [commentary, commentary2, commentary3] = (sampler.commentaries || []).filter(
    (c) => c && !seenCom.has(c.id) && seenCom.add(c.id),
  );
  // strongest card hooks first (tiles/PlacesTile rankPlaces, audit r4 places-H1)
  const places = Array.isArray(sampler.places) ? { places: rankPlaces(sampler.places) } : {};
  return { ...sampler, ...places, commentary, commentary2, commentary3 };
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
  // fresh = within 90 days; the tile now prints each post's age (audit I2)
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

// The last live community payload, kept in memory (never persisted: it is
// real user content) per auth token. Coming Back to Home remounts the Sampler;
// starting from this instead of "pending" keeps the tile in place while the
// refetch runs, so the content-anchored Back has nothing re-inserting above it.
let communityMemo = null; // { token, value }
export const __resetCommunityMemo = () => { communityMemo = null; };
const memoFor = (token) => (communityMemo && communityMemo.token === token ? communityMemo.value : undefined);

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
  // undefined = live fetch pending (a skeleton holds the slot); null = nothing
  // to show (or messenger off) → no tile.
  const [community, setCommunity] = useState(() => (isMessengerEnabled() ? memoFor(token) : null));
  const [failed, setFailed] = useState(false);
  const payload = useMemo(
    () => (samplerPayload ? { ...samplerPayload, community } : null),
    [samplerPayload, community],
  );
  // Seed of the current sampler payload — drives infinite-scroll batch seeds.
  const seed = samplerPayload?.seed || 0;
  // Coming back to Home (Back, a tab round-trip) rebuilds the SAME page: the
  // snapshot for this seed carries the shuffle, the balancer's reserves and the
  // revealed batches, so the route scroll-restore has the old page to land on.
  const sessionRef = useRef(readSession(cachedRef.current?.payload?.seed));
  const single = useSingleColumn();
  // The tile's outer card: bounded (visible fade + toggle) for the long
  // fixtures in the single column, a plain div everywhere else. A plain
  // function (not a component defined in render) so React never remounts it.
  // data-tile-id is the tile's identity for the Back anchor (tiles/scrollAnchor).
  // TileIdentity ("<seed>|<id>") keys every reveal inside the tile for the
  // session, so a Back remounts each one as the reader left it (systemic E2).
  const tileShell = (span, className, child, id) => (
    <TileIdentity value={`${seed}|${id}`}>
      {single && BOUNDED_SPANS.has(span) ? (
        <BoundedTile className={className} tileId={id}>{child}</BoundedTile>
      ) : (
        <div className={className} data-tile-id={id}>{child}</div>
      )}
    </TileIdentity>
  );
  const [variableTiles, setVariableTiles] = useState(() => {
    const saved = sessionRef.current?.order;
    return saved ? fromKeys(saved, VARIABLE_DEFAULT()) : shuffle(VARIABLE_DEFAULT());
  });
  // Reserve tiles activated by the balancer: [{ key, side: "rail"|"main" }].
  const [reserves, setReserves] = useState(() => sessionRef.current?.reserves || []);
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
  const [extraBatches, setExtraBatches] = useState(() =>
    (sessionRef.current?.batches || []).map((b) => ({ payload: b.payload, tiles: fromKeys(b.tiles, batchTiles) })),
  );
  const [loadingMore, setLoadingMore] = useState(false);
  // Feed terminus: null while the feed can grow, "error" after a batch fetch
  // failed twice (offers a retry), "max" at MAX_BATCHES.
  const [feedEnd, setFeedEnd] = useState(null);
  const reserveRef = useRef(null);      // { payload, tiles } prefetched, not yet shown
  const fetchingRef = useRef(false);
  const atBottomRef = useRef(false);
  const batchSeedRef = useRef(sessionRef.current?.batchSeed || 0);
  const sentinelRef = useRef(null);
  const loadMoreRef = useRef(() => {}); // latest maybeLoadMore, for the observer
  const mountedRef = useRef(true);
  const genRef = useRef(0); // sampler generation — see fetchSampler
  // payloads on the page (first + revealed batches), for batch de-duplication
  const shownPayloadsRef = useRef([]);
  shownPayloadsRef.current = [samplerPayload, ...extraBatches.map((b) => b.payload)].filter(Boolean);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Community stream — always live, never cached. Fills its own tile when it
  // lands; a failure just leaves the community tile empty (non-fatal).
  // Messenger off on this host → /home/community redirects to Home, so the tile
  // (all links into it) is never fetched or shown (audit community L5).
  const fetchCommunity = () => {
    if (!isMessengerEnabled()) return;
    const gen = genRef.current;
    const release = () => {
      if (mountedRef.current && gen === genRef.current) setCommunity((c) => (c === undefined ? null : c));
    };
    BoMOnlineAPI({ homegroups: { token }, leaderboard: { token } }, { useCache: false })
      .then((r) => {
        if (!mountedRef.current || gen !== genRef.current) return;
        if (r?.error) return release();
        const value = assembleCommunity(r);
        communityMemo = { token, value };
        setCommunity(value);
      })
      .catch(release);
  };

  // Sampler stream. `explicitSeed` null → front-door (server picks the shared
  // window seed, cacheable). `swap` → paint the result (cold load / manual
  // refresh); when false (stale revalidate) we only refresh the cache so the
  // fresh sample applies on the NEXT load without disturbing the current view.
  // Latest-request-wins: every sampler generation (mount, each resample) bumps
  // genRef; a response — or a failure's same-seed retry — from an older
  // generation is dropped, so a slow superseded fetch can never repaint the
  // page the reader is already looking at (audit B2).
  const fetchSampler = (explicitSeed, swap, attempt = 0, gen = genRef.current) => {
    const input = { homesampler: explicitSeed ? { seed: explicitSeed } : {} };
    const stale = () => !mountedRef.current || gen !== genRef.current;
    BoMOnlineAPI(input, { useCache: false })
      .then((r) => {
        if (stale()) return;
        if (r?.error || !Array.isArray(r?.homesampler)) throw new Error("homesampler unavailable");
        const sp = assembleSampler(r);
        writeCache(sp, sp.seed);
        cachedRef.current = { payload: sp, seed: sp.seed };
        if (swap) setSamplerPayload(sp);
      })
      .catch(() => {
        if (stale()) return;
        if (attempt < 1) fetchSampler(explicitSeed, swap, attempt + 1, gen);
        // Only fall back to the empty-state footer when there is nothing to show.
        else if (swap && !samplerPayload) setFailed(true);
      });
  };

  // Manual refresh: a fresh random seed → server-fresh sample, swap the view
  // (explicit action), overwrite the cache. Refitted variables + a fresh feed.
  const resample = () => {
    genRef.current += 1; // supersede every in-flight sampler/batch/community fetch
    clearSession();
    sessionRef.current = null;
    setFeedEnd(null);
    setSamplerPayload(null);
    setFailed(false);
    setReserves([]);
    setVariableTiles(shuffle(VARIABLE_DEFAULT()));
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
    if (!payload || single) return;
    if (!canGrowReserves({ reserves: reserves.length, max: MAX_RESERVES, batches: extraBatches.length })) return;
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
  }, [payload, reserves, settleTick, single, extraBatches.length]);

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
      <TileBoundary key={`reserve-${key}`} tileKey={key}>
        {/* def.span: a reserve copy of a family tile shares its family CSS
            (e.g. the tile-art / tile-chiasmus :empty collapse). */}
        <TileIdentity value={`${seed}|reserve:${key}`}>
          <div className={`tile tile-${key}${def.span ? ` ${def.span}` : ""}`} data-tile-id={`reserve:${key}`}>
            <Tile {...props} />
          </div>
        </TileIdentity>
      </TileBoundary>
    );
  };

  // ---- infinite scroll: prefetch + reveal ---------------------------------
  // Fetch the next batch (homesampler only — community/leaderboard don't repeat)
  // into reserveRef. If the reader is already waiting at the bottom when it
  // lands, reveal it immediately.
  const prefetchBatch = (attempt = 0) => {
    if (fetchingRef.current || reserveRef.current || extraBatches.length >= MAX_BATCHES) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    // a retry re-requests the same seed; only a fresh attempt advances it
    const bs = attempt ? batchSeedRef.current : (batchSeedRef.current = nextBatchSeed(batchSeedRef.current || seed));
    const gen = genRef.current;
    // a batch for a superseded sample: resample already reset the feed refs
    const stale = () => !mountedRef.current || gen !== genRef.current;
    const fail = () => {
      if (stale()) return;
      fetchingRef.current = false;
      if (attempt < 1) {
        // skeletons stay up through the one retry
        setTimeout(() => !stale() && prefetchBatch(attempt + 1), BATCH_RETRY_MS);
        return;
      }
      setLoadingMore(false);
      setFeedEnd("error");
    };
    BoMOnlineAPI({ homesampler: { seed: bs, token } }, { useCache: false })
      .then((r) => {
        if (stale()) return;
        if (r?.error || !Array.isArray(r?.homesampler)) return fail();
        fetchingRef.current = false;
        setLoadingMore(false);
        // places already featured up the feed don't come back as cards/profile
        const seen = new Set();
        shownPayloadsRef.current.forEach((sp) => featuredPlaceSlugs(sp).forEach((x) => seen.add(x)));
        // …and the witness / Joseph Smith tiles don't repeat a statement either
        const archives = featuredArchiveKeys(shownPayloadsRef.current);
        // …nor a matter card / the matter profile (R7 concept-H4)
        const seenMatters = new Set();
        shownPayloadsRef.current.forEach((sp) => featuredMatterSlugs(sp).forEach((x) => seenMatters.add(x)));
        reserveRef.current = {
          payload: arrangeArchives(withoutSeenMatters(withoutSeenPlaces(assembleSampler(r), seen), seenMatters), archives),
          tiles: shuffle(batchTiles),
        };
        // the latest closure: this one may predate a Retry that cleared feedEnd
        if (atBottomRef.current) loadMoreRef.current();
      })
      .catch(fail);
  };

  // Reveal the prefetched batch (appending it) and queue the next; or, if none
  // is ready yet, kick off the fetch so it arrives. One batch per API round
  // trip — the fetch guard paces it, so a reader parked at the bottom pulls in
  // batches steadily without a runaway loop.
  function maybeLoadMore() {
    if (!payload || feedEnd) return;
    if (extraBatches.length >= MAX_BATCHES) { setFeedEnd("max"); return; }
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
    // the sentinel node is re-created when the layout flips or the feed ends/resumes
  }, [payload, single, feedEnd]);

  const renderBatchTile = (bp, def, idx) => {
    if (!def.isReady(bp)) return null;
    const Tile = def.component;
    const data = def.dataKey ? bp[def.dataKey] : bp[def.key];
    return (
      <TileBoundary key={`${def.key}-${idx}`} tileKey={def.key}>
        {tileShell(
          def.span,
          `tile infiniteTile ${def.span}`,
          <Tile data={data} next={bp[`${def.key}Next`]} seed={bp.seed} payload={bp} {...(def.props || {})} />,
          `b${idx.split("-")[0]}:${def.key}:${idx.split("-")[1]}`,
        )}
      </TileBoundary>
    );
  };

  useEffect(() => {
    document.title = label("home_title");
    // Scroll is the shell's job (scroll/routeScrollReset): top on a push from
    // another page, the saved offset on Back. Forcing top here undid the restore.
  }, []);

  // Keep the session snapshot current so leaving and coming back rebuilds this
  // exact page (see sessionRef above).
  useEffect(() => {
    if (!seed) return;
    writeSession({
      seed,
      order: variableTiles.map((t) => t.key),
      reserves,
      batches: extraBatches.map((b) => ({ payload: b.payload, tiles: b.tiles.map((t) => t.key) })),
      batchSeed: batchSeedRef.current,
    });
  }, [seed, variableTiles, reserves, extraBatches]);

  // Content-anchored Back (tiles/scrollAnchor.js): remember the tile the reader
  // is looking at; on Back into a restored layout, pin it while tiles above
  // settle. scrollY alone landed on the wrong content.
  const navigationType = useNavigationType();
  const tileNodes = () => [...document.querySelectorAll(".sampler .tile")];
  // While the Back pin holds the page, its own scrolls (and the shell's scrollY
  // restore) must not overwrite the saved anchor with a mid-settle position;
  // once it lets go, the settled view is captured once (audit R4 analysis E1).
  const pinningRef = useRef(false);
  useEffect(() => {
    if (!seed) return undefined;
    return trackAnchor(tileNodes, (anchor) => writeAnchor(seed, anchor), { paused: () => pinningRef.current });
  }, [seed]);
  useEffect(() => {
    if (navigationType !== "POP" || !sessionRef.current) return undefined;
    const seedAtBack = sessionRef.current.seed;
    const anchor = readAnchor(seedAtBack);
    if (!anchor) return undefined;
    const homePath = window.location.pathname;
    pinningRef.current = true;
    return pinAnchor(tileNodes, anchor, {
      timeoutMs: 3500,
      onStop: () => {
        pinningRef.current = false;
        // still on Home (not unmounting into a link): keep the pinned tile as
        // the anchor at its settled offset
        if (window.location.pathname !== homePath) return;
        const el = findAnchor(tileNodes(), anchor);
        if (!el) return;
        // re-capture tile AND link at their settled offsets, so the next
        // (chained) Back holds the same place
        const a = findLink(el, anchor.link);
        writeAnchor(seedAtBack, {
          ...anchor,
          offset: Math.round(el.getBoundingClientRect().top),
          ...(a ? { link: { ...anchor.link, offset: Math.round(a.getBoundingClientRect().top) } } : {}),
        });
      },
    });
    // once per mount: only the arrival is a Back
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Skeletons reserve each span's measured footprint (tiles/_ds/skeletonHeights).
  const skeleton = (key, span) => (
    <div key={key} className={`tile skeleton ${span}`} style={{ minHeight: skeletonHeight(span, single) }} />
  );

  // Each tile renders inside its own error boundary: a throw drops that tile
  // (shell included) and the rest of the grid survives.
  const renderTile = ({ key, component: Tile, span, isReady, pending }, spanOverride) => {
    if (!payload) return skeleton(key, span);
    // A live tile whose own stream is still in flight keeps its slot, so its
    // arrival never re-flows the masonry (audit community B2).
    if (pending?.(payload)) return skeleton(key, span);
    if (!isReady(payload)) return null;
    return (
      <TileBoundary key={key} tileKey={key}>
        {tileShell(
          spanOverride || span,
          `tile ${spanOverride || span}`,
          <Tile data={payload[key]} next={payload[`${key}Next`]} seed={payload.seed} payload={payload} />,
          key,
        )}
      </TileBoundary>
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
      case "people": return 51; // 810px: 5-up face strip (2026-10-15)
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
      case "community": return 25; // ~395px editorial layout, constant while pending (2026-10-16)
      case "biblephrases": return 20;
      case "chiasmus": return 20;
      case "notes": return 24;
      case "faxVerse": return 30;
      case "mapstory": return 40;
      default: return 14;
    }
  };
  // takes a slot: ready, or a live tile still fetching (renders its skeleton)
  const shows = (t) => t.isReady(payload) || Boolean(t.pending?.(payload));
  const leftTiles = FIXED_LEFT.map((k) => tileRegistry.find((t) => t.key === k)).filter(Boolean);
  // Totals FIRST, then move tiles: the old greedy pass compared each tile
  // against a not-yet-grown grid estimate and never railed anything.
  const railExtra = [];
  const gridVars = [...variableTiles];
  let leftH = leftTiles.reduce((a, t) => a + est(t.key), 0);
  // masonry is 2-up: each variable tile costs half its height in column terms
  let rightH =
    est("people") +
    gridVars.reduce((a, t) => (payload && shows(t) ? a + est(t.key) / 2 : a), 0);
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
      if (t.key === "text" || !payload || !shows(t)) return;
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
  const renderable = gridVars.filter((t) => !payload || shows(t));
  // Even spacing, never at index 0, and alternating masonry columns
  // (tiles/samplerLayout spaceAcrossColumns).
  const orderedGrid = spaceAcrossColumns(
    renderable.filter((t) => !isCommentary(t)),
    renderable.filter(isCommentary),
    2,
  );

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
  // The main masonry's fixed items (grid, tail, main reserves), rendered once
  // here so the batch placement below knows exactly how many precede the
  // batch tiles (masonry column = index % 2) and what each column ends with.
  const mainBase = [
    ...orderedGrid.map((t) => [t.key, renderTile(t)]),
    ...FIXED_TAIL.map((k) => tileRegistry.find((t) => t.key === k))
      .filter(Boolean)
      .map((t) => [t.key, renderTile(t)]),
    ...reserves.filter((r) => r.side === "main").map((r) => [r.key, renderReserve(r)]),
  ].filter(([, node]) => node);
  const railKeys = [
    ...leftTiles.map((t) => t.key),
    ...railExtra.map((t) => t.key),
    ...reserves.filter((r) => r.side === "rail").map((r) => r.key),
  ];
  const lastIn = (col) => mainBase.filter((_, i) => i % 2 === col).map(([k]) => k).at(-1) ?? null;
  const familyKey = (k) => k.replace(/Fill\d*$|\d+$|B$/, ""); // commentary2 / artB / chiasmus2 read as their family
  const batchEntries = [];
  extraBatches.forEach((b, bi) => {
    b.tiles.forEach((def, ti) => {
      const node = renderBatchTile(b.payload, def, `${bi}-${ti}`);
      if (node) batchEntries.push({ node, key: familyKey(def.key), e: estBatch(def.key) });
    });
  });
  const sides = placeBatchTiles({
    railH: leftH,
    mainColH: rightH,
    mainCount: mainBase.length,
    last: { rail: familyKey(railKeys.at(-1) || ""), main: [lastIn(0), lastIn(1)].map((k) => (k ? familyKey(k) : null)) },
    tiles: batchEntries,
  });
  const railInfinite = batchEntries.filter((_, i) => sides[i] === "rail").map((x) => x.node);
  const mainInfinite = batchEntries.filter((_, i) => sides[i] === "main").map((x) => x.node);
  let railH = leftH + batchEntries.reduce((a, x, i) => (sides[i] === "rail" ? a + x.e : a), 0);
  let mainColH = rightH + batchEntries.reduce((a, x, i) => (sides[i] === "main" ? a + x.e / 2 : a), 0);
  // Skeleton loaders while the next batch is in flight — same 3-column
  // balancing so they appear right at the growing edge.
  if (!single && loadingMore && extraBatches.length < MAX_BATCHES) {
    ["tile-art", "tile-commentary", "tile-history"].forEach((span, i) => {
      const node = skeleton(`sk-${extraBatches.length}-${i}`, span);
      if (railH <= mainColH) { railInfinite.push(node); railH += 12; }
      else { mainInfinite.push(node); mainColH += 6; }
    });
  }

  // End of the feed: a quiet terminus instead of skeletons that never resolve.
  const retryFeed = () => { setFeedEnd(null); prefetchBatch(); };
  const feedTerminus = feedEnd ? (
    <div className="samplerFeedEnd" role="status">
      {feedEnd === "error" ? (
        <>
          <span>{labelOr("home_feed_error", "Couldn’t load more right now.")}</span>
          <button type="button" className="samplerFeedEndAction" onClick={retryFeed}>{label("rp_retry")}</button>
        </>
      ) : (
        <>
          <span>{labelOr("home_feed_end", "You’ve reached the end of this sample.")}</span>
          <button type="button" className="samplerFeedEndAction" onClick={() => window.dispatchEvent(new Event("home:resample"))}>
            {label("resample")}
          </button>
        </>
      )}
    </div>
  ) : null;
  const sentinel = payload && !feedEnd ? (
    <div ref={sentinelRef} className="samplerSentinel" aria-hidden="true" />
  ) : null;

  // ---- single column (phone / narrow) --------------------------------------
  // One curated order (samplerLayout.singleColumnOrder); no balancer, no rail.
  // Commentary is spaced out as in the masonry, and batches append at the end.
  if (single) {
    const vars = variableTiles.filter((t) => !payload || shows(t));
    const others = spaceAcrossColumns(vars.filter((t) => !isCommentary(t)), vars.filter(isCommentary), 1);
    const byKey = (k) => tileRegistry.find((t) => t.key === k);
    const order = singleColumnOrder(others.map((t) => t.key)).map(byKey).filter(Boolean);
    const batchNodes = extraBatches.flatMap((b, bi) => b.tiles.map((def, ti) => renderBatchTile(b.payload, def, `${bi}-${ti}`)));
    return (
      <div className="sampler container">
        <div className="samplerSingle">
          {order.map((t) => renderTile(t))}
          {batchNodes}
          {loadingMore && extraBatches.length < MAX_BATCHES
            ? ["tile-art", "tile-commentary"].map((span, i) => skeleton(`sk-${extraBatches.length}-${i}`, span))
            : null}
        </div>
        {feedTerminus}
        {sentinel}
      </div>
    );
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
            {[...mainBase.map(([, node]) => node), ...mainInfinite]}
          </Masonry>
        </div>
      </div>

      {/* Sentinel sits below the three columns; nearing it reveals the next
          prefetched batch and queues another. Skeletons above (inside the
          columns) cover the wait. */}
      {feedTerminus}
      {sentinel}
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
