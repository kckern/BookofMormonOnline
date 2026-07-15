import React from "react";
import { Link } from "react-router-dom";
import { label, breakCache } from "src/models/Utils";

export default function SpotlightTile({ data }) {
  if (!data?.flavor) return null;
  return (
    <Link to="/community" className="samplerTileInner spotlightTile">
      <h3 className="tileHeading">{label("community")}</h3>
      {data.flavor === "group" ? (
        <div className="spotlightGroup">
          <img src={data.group?.picture} alt="" onError={breakCache} />
          <div className="spotlightGroupName">{data.group?.name}</div>
          <div className="spotlightGroupMeta">
            {(data.group?.members || []).length} {label("members")}
          </div>
        </div>
      ) : (
        <div className="spotlightUsers">
          <h4>
            {label(data.flavor === "finishers" ? "recent_finishers" : "leader_board")}
          </h4>
          {(data.users || []).slice(0, 5).map((u, i) => (
            <div key={i} className="spotlightUser">
              <img src={u.picture} alt="" onError={breakCache} />
              <span>{u.nickname}</span>
              {u.progress != null && (
                <span className="spotlightProgress">{u.progress}%</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
