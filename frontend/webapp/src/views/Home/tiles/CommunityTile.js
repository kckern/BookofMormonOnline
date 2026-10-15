import React from "react";
import { Link } from "react-router-dom";
import { label, breakCache } from "src/models/Utils";
import { clampWords } from "./textUtils";
import TileDeepLink from "./_ds/TileDeepLink";
import labelOr from "./_ds/labelOr";

// The tile is never wider than ~445px, so two group cards is the honest
// maximum; the rest fold into the visible "+N groups" card.
const SHOWN_GROUPS = 2;

/**
 * User avatars are external profile URLs (not media-CDN paths), so they can't
 * go through TileImage's variant srcset. Missing picture → a neutral disc,
 * never a broken <img>.
 */
const Avatar = ({ src, className = "", title }) =>
  src ? (
    <img className={className} src={src} alt="" title={title} loading="lazy" decoding="async" onError={breakCache} />
  ) : (
    <span className={`communityAvatarBlank ${className}`.trim()} title={title} aria-hidden="true" />
  );

const messageText = (m) =>
  clampWords((m.msg || "").replace(/<[^>]*>/gi, " ").replace(/\s+/g, " ").trim().replace(/^•$/, label("highlight_msg")), 24);

/**
 * ONE community tile (merged community + activity, per design review):
 *   1. group strip — liveliest groups first, facepiles prove occupancy
 *   2. recent messages under their group's name chip (what was actually said)
 *   3. one finisher congratulation row
 * Degrades conversation → activity → invitation; never renders as dead rows.
 */
export default function CommunityTile({ data }) {
  if (!data) return null;
  const { groups = [], moreGroups = 0, messages = [], reading = [], finishers = [] } = data;
  const freshMessages = messages.filter((m) => m?.fresh);
  const shownGroups = groups.slice(0, SHOWN_GROUPS);
  const hiddenCount = Math.max(0, groups.length - shownGroups.length) + (Number(moreGroups) || 0);
  return (
    <div className="samplerTileInner communityTile">
      <h3 className="tileHeading">
        <Link to="/home/community">{labelOr("community", "Community")}</Link>
      </h3>

      {shownGroups.length ? (
        <div className="communityGroupStrip">
          {shownGroups.map((g) => {
            const members = g.members || [];
            const one = members.length === 1;
            const memberText = `${members.length} ${labelOr(one ? "member" : "members", one ? "member" : "members")}`;
            return (
              <Link key={g.url} to={`/home/community/${g.url}`} className="communityGroupCard">
                <Avatar className="communityGroupAvatar" src={g.picture} />
                <div className="communityGroupBody">
                  <div className="communityGroupName">{g.name}</div>
                  <div className="communityGroupMeta">
                    <span className="communityFacepile">
                      {members.slice(0, 3).map((m, i) => (
                        <Avatar key={m.user_id || i} src={m.picture} />
                      ))}
                    </span>
                    {/* Count beside the faces; the word lives in the accessible
                        name (a 130px card can't fit "11 members" + faces). */}
                    <span
                      className="communityMemberCount"
                      title={memberText}
                      aria-label={memberText}
                    >
                      {members.length}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
          {hiddenCount > 0 ? (
            <Link to="/home/community" className="communityGroupCard communityMoreCard">
              <strong>+{hiddenCount}</strong>
              <span>{labelOr("groups", "groups")}</span>
            </Link>
          ) : null}
        </div>
      ) : (
        <Link to="/home/community" className="communityInvite">{labelOr("start_group", "Start a study group")}</Link>
      )}

      {freshMessages.length >= 1 ? (
        <div className="communityMessages">
          {freshMessages.map((m) => (
            <Link key={`${m.channel}-${m.id}`} to={`/home/community/${m.channel}/${m.id}`} className="communityMessage">
              <span className="communityMsgHead">
                <Avatar src={m.user?.picture} />
                <span className="communityMsgUser">{m.user?.nickname || ""}</span>
                {m.groupName ? <span className="communityGroupChip">{m.groupName}</span> : null}
              </span>
              <span className="communityMsgText">{messageText(m)}</span>
            </Link>
          ))}
        </div>
      ) : reading.length ? (
        // no fresh conversation → show live STATE instead (progress never rots)
        <div className="communityReadingNow">
          {reading.map((u, i) => (
            <span key={u.nickname || i} className="communityReader">
              <Avatar src={u.picture} />
              {u.nickname}
              {u.progress != null ? <b> {u.progress}%</b> : null}
            </span>
          ))}
        </div>
      ) : null}

      {finishers.length ? (
        <div className="communityFinishers">
          <span className="communityFinisherLabel">{labelOr("recent_finishers", "Recent finishers")}</span>
          <span className="communityFacepile">
            {finishers.slice(0, 5).map((u, i) => (
              <Avatar key={u.nickname || i} src={u.picture} title={u.nickname} />
            ))}
          </span>
          <span className="communityFinisherNames">
            {finishers.slice(0, 2).map((u) => u.nickname).filter(Boolean).join(", ")}
            {finishers.length > 2 ? ` +${finishers.length - 2}` : ""}
          </span>
        </div>
      ) : null}
      <TileDeepLink to="/home/community" always verb="viewAll" />
    </div>
  );
}
