import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import labelOr from "./tiles/_ds/labelOr";

/**
 * Where Back goes when there is no in-app history to pop (a cold deeplink):
 * one level up — message → its group → the community index → Home.
 */
export function communityBackTarget({ base = "/home/community", channel, message } = {}) {
  if (channel && message) return `${base}/${channel}`;
  if (channel) return base;
  return "/home";
}

/**
 * Top-left return control for the community destinations (message, group,
 * index) — the same ⬅ idiom as the map story page. A reader who arrived from
 * Home (or anywhere in-app) goes straight back there with their scroll intact;
 * a cold deeplink climbs one level instead of leaving the site.
 */
export default function CommunityBack({ channel, message, base = "/home/community", placement = "pane" }) {
  const location = useLocation();
  const navigate = useNavigate();
  // react-router keys the first entry of a session "default": nothing in-app to pop.
  const hasHistory = location.key && location.key !== "default";
  if (!channel && !message && !hasHistory) return null;
  const back = () => (hasHistory ? navigate(-1) : navigate(communityBackTarget({ base, channel, message })));
  return (
    <div className={`communityBackBar communityBackBar--${placement}`}>
      <button type="button" className="communityBack" onClick={back}>
        <span className="communityBackIcon" aria-hidden="true">⬅</span>
        <span>{labelOr("back", "Back")}</span>
      </button>
    </div>
  );
}
