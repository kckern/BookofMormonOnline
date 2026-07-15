import React from "react";
import { Link } from "react-router-dom";
import { label, breakCache, timeAgoString } from "src/models/Utils";

/** The freshest few community messages — a feed with a pulse, not one stale row. */
export default function ActivityTile({ data }) {
  const items = Array.isArray(data) ? data : data ? [data] : [];
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
                  // latest.timestamp is milliseconds (see Feed.js); timeAgoString expects seconds.
                  <span className="activityTileTime">{timeAgoString(m.timestamp / 1000)}</span>
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
