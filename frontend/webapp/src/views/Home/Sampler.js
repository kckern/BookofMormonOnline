import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import Masonry from "react-masonry-css";
import { tileRegistry } from "./tiles/registry";
import PersonProfileTile from "./tiles/PersonProfileTile";
import PlaceProfileTile from "./tiles/PlaceProfileTile";
import WitnessTile from "./tiles/WitnessTile";
import ImageArtTile from "./tiles/ImageArtTile";
import ChiasmusTile from "./tiles/ChiasmusTile";
import MapTile from "./tiles/MapTile";
import "./Sampler.css";
import "./Sampler.m.css";

// Reserve tiles: NOT rendered by default. The balancer measures the left rail
// against the masonry and inserts reserves onto the shorter side until the two
// bottom out together. Cheap/relevant tiles first; the map (heavy, lazy) last
// and always into the masonry (below the fold). `data` names a payload field
// the tile reads via its `data` prop; profiles/art read the whole payload.
const RESERVE_POOL = [
  { key: "personProfile", component: PersonProfileTile, isReady: (p) => (p?.people?.length || 0) > 14 },
  { key: "witness",       component: WitnessTile,       dataKey: "witnesses", isReady: (p) => (p?.witnesses?.length || 0) > 0 },
  { key: "placeProfile",  component: PlaceProfileTile,  isReady: (p) => (p?.places?.length || 0) > 11 },
  { key: "artFill1",      component: ImageArtTile,      props: { artIndex: 1 }, isReady: (p) => (p?.art?.length || 0) > 1 },
  { key: "chiasmus2",     component: ChiasmusTile,      props: { seed: 0 }, seedOffset: 97, isReady: () => true },
  { key: "artFill2",      component: ImageArtTile,      props: { artIndex: 2 }, isReady: (p) => (p?.art?.length || 0) > 2 },
  { key: "map",           component: MapTile,           isReady: () => true, mainOnly: true },
];
const MAX_RESERVES = 5;

/** Session-stable seed: same page on refresh/back, new sample next session. */
const getSessionSeed = () => {
  let seed = parseInt(sessionStorage.getItem("samplerSeed"), 10);
  if (!(seed > 0)) {
    seed = Math.floor(Math.random() * (2 ** 31 - 1)) + 1;
    sessionStorage.setItem("samplerSeed", String(seed));
  }
  return seed;
};

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

/** Merge the compound API response into one payload keyed by registry tile key. */
export const assemblePayload = (r) => {
  const sampler = r?.homesampler?.[0] || {};
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
  // ONE merged community payload (design review): liveliest groups first,
  // fresh messages under group chips, one finisher row. Membership system
  // events are filtered; stale timestamps degrade to reading-progress rows.
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
  const community = sorted.length || finishers.length
    ? { groups: sorted.slice(0, 3), moreGroups: Math.max(0, sorted.length - 3), messages, reading, finishers }
    : null;
  // three commentary tiles, one payload field each (registry keys are 1:1)
  const [commentary, commentary2, commentary3] = sampler.commentaries || [];
  return { ...sampler, community, commentary, commentary2, commentary3 };
};

export default function Sampler() {
  const appController = useAppController();
  const token = appController.states.user.token;
  const [payload, setPayload] = useState(null);
  const [failed, setFailed] = useState(false);
  const [seed, setSeed] = useState(getSessionSeed);
  const [variableTiles, setVariableTiles] = useState(() =>
    shuffle(tileRegistry.filter((t) => !FIXED_LEFT.includes(t.key) && !FIXED_TOP.includes(t.key))),
  );
  // Reserve tiles activated by the balancer: [{ key, side: "rail"|"main" }].
  const [reserves, setReserves] = useState([]);
  // Bumped a few times after load so the balancer re-measures once async
  // content (images, lazy tiles) has reflowed the columns.
  const [settleTick, setSettleTick] = useState(0);
  const railRef = useRef(null);
  const mainRef = useRef(null);

  // Break the session-stable seed on demand: fresh content + refitted variables.
  const resample = () => {
    const next = Math.floor(Math.random() * (2 ** 31 - 1)) + 1;
    sessionStorage.setItem("samplerSeed", String(next));
    setPayload(null);
    setFailed(false);
    setReserves([]);
    setVariableTiles(shuffle(tileRegistry.filter((t) => !FIXED_LEFT.includes(t.key) && !FIXED_TOP.includes(t.key))));
    setSeed(next);
  };

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
    const next = RESERVE_POOL.find(
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
    const def = RESERVE_POOL.find((r) => r.key === key);
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

  useEffect(() => {
    document.title = label("home_title");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = (attempt) =>
      BoMOnlineAPI(
        { homesampler: { seed, token }, homegroups: { token }, leaderboard: { token } },
        { useCache: false },
      )
        .then((r) => {
          if (cancelled) return;
          // BoMOnlineAPI does not reject on request timeout — it resolves the
          // {error} sentinel (BoMOnlineAPI.js:43). Treat that, or any response
          // missing the homesampler singleton, as a failure so it routes
          // through the same retry-then-fallback path as a hard rejection.
          if (r?.error || !Array.isArray(r?.homesampler)) {
            throw new Error("homesampler unavailable");
          }
          setPayload(assemblePayload(r));
        })
        .catch(() => {
          if (cancelled) return;
          if (attempt < 1) load(attempt + 1);
          else setFailed(true);
        });
    load(0);
    return () => {
      cancelled = true;
    };
  }, [token, seed]);

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
      case "community": return 8 + (payload.community?.groups?.length || 0) * 4 + (payload.community?.messages?.length || 0) * 2.5;
      case "biblephrases": return 20;
      case "chiasmus": return 20;
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

  return (
    <div className="sampler container">
      <div className="samplerBar noselect">
        <button
          className="samplerResample"
          onClick={resample}
          title={label("resample")}
          aria-label={label("resample")}
        >
          ↻ <span>{label("resample")}</span>
        </button>
      </div>
      <div className="samplerColumns">
        <div className="samplerLeftRail" ref={railRef}>
          {leftTiles.map((t) => renderTile(t))}
          {railExtra.map((t) => renderTile(t))}
          {reserves.filter((r) => r.side === "rail").map(renderReserve)}
        </div>
        {/* three top-level panels: rail | people (fixed) | masonry of the rest.
            Masonry frees tile heights from each other — no row-matching voids.
            Balancer reserves land on the shorter side; the map goes here, low. */}
        <div className="samplerMain" ref={mainRef}>
          {topTiles.map((t) => renderTile(t))}
          <Masonry
            breakpointCols={{ default: 2, 800: 1 }}
            className="samplerMasonry"
            columnClassName="samplerMasonryCol"
          >
            {[
              ...orderedGrid.map((t) => renderTile(t)),
              ...reserves.filter((r) => r.side === "main").map(renderReserve),
            ].filter(Boolean)}
          </Masonry>
        </div>
      </div>
    </div>
  );
}

/** Whole-query failure: never render a blank homepage. */
export function SamplerFooter() {
  const links = [
    ["contents", "/contents"],
    ["people", "/people"],
    ["places", "/places"],
    ["community", "/community"],
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
