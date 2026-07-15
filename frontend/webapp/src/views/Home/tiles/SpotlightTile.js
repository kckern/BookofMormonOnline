import React from "react";
import { Link } from "react-router-dom";
import { label, breakCache } from "src/models/Utils";

/** Featured group AND a (deduped) member list together — community with a pulse. */
export default function SpotlightTile({ data }) {
  if (!data) return null;
  const { group, users = [], usersLabel } = data;
  return (
    <Link to="/community" className="samplerTileInner spotlightTile">
      <h3 className="tileHeading">{label("community")}</h3>
      {group ? (
        <div className="spotlightGroup">
          <img src={group.picture} alt="" onError={breakCache} />
          <div>
            <div className="spotlightGroupName">{group.name}</div>
            <div className="spotlightGroupMeta">
              {(group.members || []).length}{" "}
              {label((group.members || []).length === 1 ? "member" : "members")}
            </div>
          </div>
        </div>
      ) : null}
      {users.length ? (
        <div className="spotlightUsers">
          <h4>{label(usersLabel)}</h4>
          {users.map((u, i) => (
            <div key={u.nickname || i} className="spotlightUser">
              <img src={u.picture} alt="" onError={breakCache} />
              <span>{u.nickname}</span>
              {u.progress != null && (
                <span className="spotlightProgress">{u.progress}%</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
