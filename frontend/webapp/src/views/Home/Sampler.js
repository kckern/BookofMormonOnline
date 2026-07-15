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

/** Merge the compound API response into one payload keyed by registry tile key. */
export const assemblePayload = (r) => {
  const sampler = r?.homesampler?.[0] || {};
  const groups = r?.homegroups || [];
  const board = r?.leaderboard?.[0] || {};
  const latestGroup = groups
    .filter((g) => g?.latest?.timestamp)
    .sort((a, b) => b.latest.timestamp - a.latest.timestamp)[0];
  const flavors = [
    groups.length && { flavor: "group", group: groups[Math.floor(Math.random() * groups.length)] },
    board.recentFinishers?.length && { flavor: "finishers", users: board.recentFinishers },
    board.currentProgress?.length && { flavor: "leaders", users: board.currentProgress },
  ].filter(Boolean);
  // activity & spotlight are intentionally per-visit ("what's happening now"),
  // NOT seed-stable like the sampler slices — they resample every mount.
  return {
    ...sampler,
    activity: latestGroup ? { ...latestGroup.latest, channel: latestGroup.url } : null,
    spotlight: flavors.length ? flavors[Math.floor(Math.random() * flavors.length)] : null,
  };
};

export default function Sampler() {
  const appController = useAppController();
  const token = appController.states.user.token;
  const [payload, setPayload] = useState(null);
  const [failed, setFailed] = useState(false);
  const [seed] = useState(getSessionSeed);

  useEffect(() => {
    document.title = label("home_title");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = (attempt) =>
      BoMOnlineAPI(
        { homesampler: { seed }, homegroups: { token }, leaderboard: { token } },
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
      <div className="samplerGrid">
        {tileRegistry.map(({ key, component: Tile, span, isReady }) => {
          if (!payload) return <div key={key} className={`tile skeleton ${span}`} />;
          if (!isReady(payload)) return null;
          return (
            <div key={key} className={`tile ${span}`}>
              <Tile data={payload[key]} seed={payload.seed} />
            </div>
          );
        })}
      </div>
      <SamplerFooter />
    </div>
  );
}

/** Static nav rail — the page's bounded "pick your path" ending. */
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

/** Whole-query failure: never render a blank homepage. */
function SamplerFallback() {
  return (
    <div className="sampler container">
      <div className="samplerFallback">
        <SamplerFooter />
      </div>
    </div>
  );
}
