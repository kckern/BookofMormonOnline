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
  // activity: the freshest few messages across groups (a one-item feed reads
  // as a dead community — see the adversarial home review). Membership system
  // events ("x joined.") are filtered HERE so isReady stays truthful.
  const activity = groups
    .filter((g) => g?.latest?.timestamp && !/\b(joined|left)\.?\s*$/i.test((g.latest.msg || "").trim()))
    .sort((a, b) => b.latest.timestamp - a.latest.timestamp)
    .slice(0, 3)
    .map((g) => ({ ...g.latest, channel: g.url, groupName: g.name }));
  // spotlight: featured group AND a deduped user list together.
  const dedupe = (users) => {
    const seen = new Set();
    return (users || []).filter((u) => {
      const k = u?.nickname;
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const finishers = dedupe(board.recentFinishers);
  const leaders = dedupe(board.currentProgress);
  const group = groups.length ? groups[Math.floor(Math.random() * groups.length)] : null;
  const users = finishers.length >= 2 ? finishers : leaders;
  const spotlight = group || users.length
    ? { group, users: users.slice(0, 4), usersLabel: finishers.length >= 2 ? "recent_finishers" : "leader_board" }
    : null;
  return {
    ...sampler,
    activity: activity.length ? activity : null,
    spotlight,
  };
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

  const renderTile = ({ key, component: Tile, span, isReady }) => {
    if (!payload) return <div key={key} className={`tile skeleton ${span}`} />;
    if (!isReady(payload)) return null;
    return (
      <div key={key} className={`tile ${span}`}>
        <Tile data={payload[key]} next={payload[`${key}Next`]} seed={payload.seed} />
      </div>
    );
  };

  // Fixed left rail (registry order) + fixed top (people) + shuffled variables.
  const leftTiles = FIXED_LEFT.map((k) => tileRegistry.find((t) => t.key === k)).filter(Boolean);
  const mainTiles = [
    ...FIXED_TOP.map((k) => tileRegistry.find((t) => t.key === k)).filter(Boolean),
    ...variableTiles,
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
        <div className="samplerLeftRail">{leftTiles.map(renderTile)}</div>
        <div className="samplerGrid">{mainTiles.map(renderTile)}</div>
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
