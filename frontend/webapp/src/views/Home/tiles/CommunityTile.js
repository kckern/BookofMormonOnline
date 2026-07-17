import React from "react";
import { Link } from "react-router-dom";
import { label, breakCache } from "src/models/Utils";
import { clampWords } from "./textUtils";

/**
 * ONE community tile (merged community + activity, per design review):
 *   1. group strip — liveliest groups first, facepiles prove occupancy
 *   2. recent messages under their group's name chip
 *   3. one finisher congratulation row
 * Degrades conversation → activity → invitation; never renders as dead rows.
 */
export default function CommunityTile({ data }) {
  if (!data) return null;
  const { groups = [], moreGroups = 0, messages = [], reading = [], finishers = [] } = data;
  const freshMessages = messages.filter((m) => m.fresh);
  return (
    <div className="samplerTileInner communityTile">
      <h3 className="tileHeading">
        <Link to="/home/community">{label("community")}</Link>
      </h3>

      {groups.length ? (
        <div className="communityGroupStrip">
          {groups.map((g) => (
            <Link key={g.url} to={`/home/community/${g.url}`} className="communityGroupCard">
              <img className="communityGroupAvatar" src={g.picture} alt="" onError={breakCache} />
              <div className="communityGroupBody">
                <div className="communityGroupName">{g.name}</div>
                <div className="communityGroupMeta">
                  <span className="communityFacepile">
                    {(g.members || []).slice(0, 4).map((m, i) => (
                      <img key={m.user_id || i} src={m.picture} alt="" onError={breakCache} />
                    ))}
                  </span>
                  {(g.members || []).length}{" "}
                  {label((g.members || []).length === 1 ? "member" : "members")}
                </div>
              </div>
            </Link>
          ))}
          {moreGroups > 0 ? (
            <Link to="/home/community" className="communityGroupCard communityMoreCard">
              +{moreGroups} {label("groups")}
            </Link>
          ) : null}
        </div>
      ) : (
        <Link to="/home/community" className="communityInvite">{label("start_group")}</Link>
      )}

      {freshMessages.length >= 1 ? (
        <div className="communityMessages">
          {freshMessages.map((m) => (
            <Link key={`${m.channel}-${m.id}`} to={`/home/community/${m.channel}/${m.id}`} className="communityMessage">
              <span className="communityGroupChip">{m.groupName}</span>
              <img src={m.user?.picture} alt="" onError={breakCache} />
              <span className="communityMsgUser">{m.user?.nickname}</span>
              <span className="communityMsgText">
                {clampWords((m.msg || "").replace(/<[^>]*>/gi, "").replace(/^•$/, label("highlight_msg")), 16)}
              </span>
            </Link>
          ))}
        </div>
      ) : reading.length ? (
        // no fresh conversation → show live STATE instead (progress never rots)
        <div className="communityReadingNow">
          {reading.map((u, i) => (
            <span key={u.nickname || i} className="communityReader">
              <img src={u.picture} alt="" onError={breakCache} />
              {u.nickname}
              {u.progress != null ? <b> {u.progress}%</b> : null}
            </span>
          ))}
        </div>
      ) : null}

      {finishers.length ? (
        <div className="communityFinishers">
          <span className="communityFinisherLabel">🎉 {label("recent_finishers")}:</span>
          <span className="communityFacepile">
            {finishers.map((u, i) => (
              <img key={u.nickname || i} src={u.picture} alt="" title={u.nickname} onError={breakCache} />
            ))}
          </span>
          <span className="communityFinisherNames">
            {finishers.slice(0, 2).map((u) => u.nickname).join(", ")}
            {finishers.length > 2 ? ` +${finishers.length - 2}` : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
