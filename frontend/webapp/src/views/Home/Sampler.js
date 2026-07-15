import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import { tileRegistry } from "./tiles/registry";
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

/** Fisher–Yates; fresh arrangement every mount (content stays seed-stable). */
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Merge the compound API response into one payload keyed by registry tile key. */
export const assemblePayload = (r) => {
  const sampler = r?.homesampler?.[0] || {};
  const groups = r?.homegroups || [];
  const board = r?.leaderboard?.[0] || {};
  // activity: the freshest few messages across groups (a one-item feed reads
  // as a dead community — see the adversarial home review).
  const activity = groups
    .filter((g) => g?.latest?.timestamp)
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
  // Order randomizes every load; grid-auto-flow:dense packs the mixed spans.
  const [tiles, setTiles] = useState(() => shuffle(tileRegistry));

  // Break the session-stable seed on demand: fresh content + fresh arrangement.
  const resample = () => {
    const next = Math.floor(Math.random() * (2 ** 31 - 1)) + 1;
    sessionStorage.setItem("samplerSeed", String(next));
    setPayload(null);
    setFailed(false);
    setTiles(shuffle(tileRegistry));
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

  return (
    <div className="sampler container">
      <button
        className="samplerResample noselect"
        onClick={resample}
        title={label("resample")}
        aria-label={label("resample")}
      >
        ↻
      </button>
      <div className="samplerGrid">
        {tiles.map(({ key, component: Tile, span, isReady }) => {
          if (!payload) return <div key={key} className={`tile skeleton ${span}`} />;
          if (!isReady(payload)) return null;
          return (
            <div key={key} className={`tile ${span}`}>
              <Tile data={payload[key]} next={payload[`${key}Next`]} seed={payload.seed} />
            </div>
          );
        })}
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
