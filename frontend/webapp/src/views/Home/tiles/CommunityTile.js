import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import { clampWords } from "./textUtils";
import TileDeepLink from "./_ds/TileDeepLink";
import labelOr, { inlineCase } from "./_ds/labelOr";

// Two groups is the honest maximum beside a quote; the rest fold into the
// visible "+N more groups" row.
const SHOWN_GROUPS = 2;

/**
 * User avatars are external profile URLs (not media-CDN paths), so they can't
 * go through TileImage's variant srcset. Missing OR failing picture → a neutral
 * disc, never a broken <img> (an avatar-host outage used to retry into a
 * broken-image icon via breakCache). width/height keep the box stable.
 */
const Avatar = ({ src, className = "", title, size }) => {
  const [failed, setFailed] = React.useState(false);
  return src && !failed ? (
    <img className={className} src={src} alt="" title={title} width={size} height={size} loading="lazy" decoding="async" onError={() => setFailed(true)} />
  ) : (
    <span className={`communityAvatarBlank ${className}`.trim()} title={title} aria-hidden="true" />
  );
};

const plain = (m) =>
  (m?.msg || "").replace(/<[^>]*>/gi, " ").replace(/\s+/g, " ").trim().replace(/^•$/, label("highlight_msg"));

/** Word-boundary clamp (never "ministerin…"); the full text is one tap away. */
export const quoteText = (m) => clampWords(plain(m), 28);

const UNITS = [
  ["year", 365 * 86400e3],
  ["month", 30 * 86400e3],
  ["week", 7 * 86400e3],
  ["day", 86400e3],
  ["hour", 3600e3],
  ["minute", 60e3],
];
/**
 * Localized relative time ("3 days ago") for a ms timestamp, so a months-old
 * post never reads as a live conversation (audit community I2).
 */
export function relativeTime(ts, now = Date.now()) {
  const t = Number(ts);
  if (!Number.isFinite(t) || t <= 0) return "";
  const diff = t - now;
  const lang = (typeof document !== "undefined" && document.documentElement.lang) || undefined;
  let fmt;
  try {
    fmt = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  } catch {
    fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  }
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return fmt.format(Math.round(diff / ms), unit);
  }
  return fmt.format(0, "minute");
}

const When = ({ ts }) => {
  const text = relativeTime(ts);
  return text ? <time className="communityWhen" dateTime={new Date(Number(ts)).toISOString()}>{text}</time> : null;
};

/**
 * ONE community tile, editorial rather than dashboard:
 *   1. what was actually said — the freshest message set as a serif pull quote,
 *      attributed (who, where, when)
 *   2. the liveliest groups as full-width rows (whole names, member faces)
 *   3. one finisher congratulation row
 * Degrades conversation → reading-now → invitation; never renders dead rows.
 */
export default function CommunityTile({ data }) {
  if (!data) return null;
  const { groups = [], moreGroups = 0, messages = [], reading = [], finishers = [] } = data;
  const hero = messages.find((m) => m?.fresh);
  const shownGroups = groups.slice(0, SHOWN_GROUPS);
  const hiddenCount = Math.max(0, groups.length - shownGroups.length) + (Number(moreGroups) || 0);
  return (
    <div className="samplerTileInner communityTile">
      <h3 className="tileHeading">
        <Link to="/home/community">{labelOr("community", "Community")}</Link>
      </h3>

      {hero ? (
        <Link to={`/home/community/${hero.channel}/${hero.id}`} className="communityMessage communityQuote">
          <span className="communityMsgText">{quoteText(hero)}</span>
          <span className="communityQuoteBy">
            <Avatar src={hero.user?.picture} size={24} />
            <span className="communityQuoteWho">
              <span className="communityMsgUser">{hero.user?.nickname || ""}</span>
              {hero.groupName ? (
                <span className="communityQuoteWhere">
                  {" "}{labelOr("community_in_group", "in $1", [hero.groupName])}
                </span>
              ) : null}
              {" "}<When ts={hero.timestamp} />
            </span>
          </span>
        </Link>
      ) : null}

      {shownGroups.length ? (
        <ul className="communityGroupStrip">
          {shownGroups.map((g) => {
            const members = g.members || [];
            const one = members.length === 1;
            const memberText = `${members.length} ${inlineCase(labelOr(one ? "member" : "members", one ? "member" : "members"))}`;
            return (
              <li key={g.url}>
                <Link to={`/home/community/${g.url}`} className="communityGroupCard">
                  <Avatar className="communityGroupAvatar" src={g.picture} size={40} />
                  <span className="communityGroupBody">
                    <span className="communityGroupName">{g.name}</span>
                    <span className="communityGroupMeta">
                      {members.length ? (
                        <span className="communityFacepile" aria-hidden="true">
                          {members.slice(0, 3).map((m, i) => (
                            <Avatar key={m.user_id || i} src={m.picture} size={18} />
                          ))}
                        </span>
                      ) : null}
                      <span className="communityMemberCount">{memberText}</span>
                      {g.latest?.timestamp ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <When ts={g.latest.timestamp} />
                        </>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          {hiddenCount > 0 ? (
            <li>
              <Link to="/home/community" className="communityMoreCard">
                {labelOr("community_more_groups", "+$1 more groups", [hiddenCount])}
              </Link>
            </li>
          ) : null}
        </ul>
      ) : (
        <Link to="/home/community" className="communityInvite">{labelOr("start_group", "Start a study group")}</Link>
      )}

      {!hero && reading.length ? (
        // no fresh conversation → show live STATE instead (progress never rots)
        <div className="communityFinishers communityReadingNow">
          <span className="communityFinisherLabel">{labelOr("reading_now", "Reading now")}</span>
          {reading.map((u, i) => (
            <span key={u.nickname || i} className="communityReader">
              <Avatar src={u.picture} size={22} />
              {u.nickname}
              {u.progress != null ? <b> {Math.round(Number(u.progress))}%</b> : null}
            </span>
          ))}
        </div>
      ) : null}

      {finishers.length ? (
        <div className="communityFinishers">
          <span className="communityFinisherLabel">{labelOr("recent_finishers", "Recent finishers")}</span>
          <span className="communityFacepile">
            {finishers.slice(0, 5).map((u, i) => (
              <Avatar key={u.nickname || i} src={u.picture} title={u.nickname} size={18} />
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
