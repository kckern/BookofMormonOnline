import React from "react";
import { Link } from "react-router-dom";
import { label, breakCache } from "src/models/Utils";

/** Compact relative age: "3h" / "5d" / "7w" / "2y". */
const shortAgo = (ms) => {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  if (s < 86400 * 365) return `${Math.floor(s / (86400 * 7))}w`;
  return `${Math.floor(s / (86400 * 365))}y`;
};

// Membership system events ("x joined.") arrive authored by whoever triggered
// them — rendering them as chat misattributes; skip them.
const isSystemMsg = (msg) => /\b(joined|left)\.?\s*$/i.test((msg || "").trim());

/** The freshest few community messages — a feed with a pulse, not one stale row. */
export default function ActivityTile({ data }) {
  const items = (Array.isArray(data) ? data : data ? [data] : []).filter((m) => !isSystemMsg(m.msg));
  if (!items.length) return null;
  return (
    <div className="samplerTileInner activityTile">
      <h3 className="tileHeading">
        <Link to="/community">{label("latest_activity")}</Link>
      </h3>
      {items.map((m) => {
        const text = (m.msg || "")
          .replace(/<[^>]*>/gi, "")
          .replace(/^•$/, label("highlight_msg"));
        return (
          <Link key={`${m.channel}-${m.id}`} to={`/community/${m.channel}/${m.id}`} className="activityTileMsg">
            <img src={m.user?.picture} alt="" onError={breakCache} />
            <div>
              <div className="activityTileUser">
                {m.user?.nickname}
                {m.timestamp ? (
                  <span className="activityTileTime">{shortAgo(m.timestamp)}</span>
                ) : null}
              </div>
              <p>{text}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
