import React from "react";
import { Link, useLocation } from "react-router-dom";
import { label } from "src/models/Utils";
import { isMessengerEnabled } from "src/models/featureFlags";
import "./HomeTabs.css";

// The Sampler/explore tab has no dictionary key yet; fall back to "Explore"
// until `home_tab_explore` is added to the label dictionary (backend).
const exploreLabel = () => {
  const t = label("home_tab_explore");
  return t && t !== "home_tab_explore" ? t : "Explore";
};

// Active tab from the pathname: /home/user → user, /home/community → community,
// anything else under /home → explore.
export const activeTabFor = (pathname) => {
  if (/^\/home\/user/.test(pathname)) return "user";
  if (/^\/home\/community/.test(pathname)) return "community";
  return "explore";
};

export default function HomeTabs() {
  const { pathname } = useLocation();
  const active = activeTabFor(pathname);
  const useMessenger = isMessengerEnabled();

  const tabs = [
    { key: "explore", to: "/home", text: exploreLabel() },
    ...(useMessenger ? [{ key: "community", to: "/home/community", text: label("menu_community") }] : []),
    { key: "user", to: "/home/user", text: label("user") },
  ];

  return (
    <nav className="home-tabs" aria-label="Home sections">
      {tabs.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          aria-current={active === t.key ? "page" : undefined}
          className={"home-tab" + (active === t.key ? " active" : "")}
        >
          {t.text}
        </Link>
      ))}
      {active === "explore" && (
        <button
          type="button"
          className="home-tabs-reload"
          title={label("resample")}
          aria-label={label("resample")}
          onClick={() => window.dispatchEvent(new Event("home:resample"))}
        >
          ↻
        </button>
      )}
    </nav>
  );
}
