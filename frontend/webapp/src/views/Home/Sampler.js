import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import { tileRegistry } from "./tiles/registry";
import ScripturePopup from "./tiles/ScripturePopup";
import "./Sampler.css";
import "./Sampler.m.css";

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
  return { ...sampler, community };
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

  // Break the session-stable seed on demand: fresh content + refitted variables.
  const resample = () => {
    const next = Math.floor(Math.random() * (2 ** 31 - 1)) + 1;
    sessionStorage.setItem("samplerSeed", String(next));
    setPayload(null);
    setFailed(false);
    setVariableTiles(shuffle(tileRegistry.filter((t) => !FIXED_LEFT.includes(t.key) && !FIXED_TOP.includes(t.key))));
    setSeed(next);
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
      case "people": return 46;
      case "text": return 20;
      case "commentary": return 18;
      case "history": return 16;
      case "fax": return 15;
      case "places": return 17;
      case "community": return 8 + (payload.community?.groups?.length || 0) * 4 + (payload.community?.messages?.length || 0) * 2.5;
      default: return 14;
    }
  };
  const leftTiles = FIXED_LEFT.map((k) => tileRegistry.find((t) => t.key === k)).filter(Boolean);
  const railExtra = [];
  const gridVars = [];
  let leftH = leftTiles.reduce((a, t) => a + est(t.key), 0);
  let rightH = est("people");
  for (const t of variableTiles) {
    if (!payload || !t.isReady(payload)) { gridVars.push(t); continue; }
    const e = est(t.key);
    // The text tile is designed for width — never strand it in the narrow rail
    // (round-6 review: a rail-binned scripture tile ended the page on a
    // viewport-scale void). Rail assignment is strict: only when the rail
    // stays at or below the grid even after adding the full tile.
    if (t.key !== "text" && leftH + e <= rightH) { railExtra.push(t); leftH += e; }
    else { gridVars.push(t); rightH += e / 2; }
  }
  // Correction pass: if the rail overshot the grid anyway, pull tiles back
  // until the column-end delta is within one small tile (~12rem).
  while (railExtra.length && leftH > rightH + 12) {
    const t = railExtra.pop();
    leftH -= est(t.key);
    gridVars.push(t);
    rightH += est(t.key) / 2;
  }
  // The text tile CLOSES the grid as a full-width row — a wide final band
  // absorbs sub-column height rag so the page never ends on a corner hole.
  const textSpan = "tile-text";
  const orderedGrid = [
    ...gridVars.filter((t) => t.key !== "text"),
    ...gridVars.filter((t) => t.key === "text"),
  ];
  const mainTiles = [
    ...FIXED_TOP.map((k) => tileRegistry.find((t) => t.key === k)).filter(Boolean),
    ...orderedGrid,
  ];

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
        <div className="samplerLeftRail">
          {leftTiles.map((t) => renderTile(t))}
          {railExtra.map((t) => renderTile(t))}
        </div>
        <div className="samplerGrid">
          {mainTiles.map((t) => renderTile(t, t.key === "text" ? textSpan : undefined))}
        </div>
      </div>
      <ScripturePopup />
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
