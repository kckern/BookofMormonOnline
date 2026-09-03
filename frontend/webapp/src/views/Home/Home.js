import React, { useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "react-router-dom";
import { isMobile } from "src/models/Utils";
import { isMessengerEnabled } from "src/models/featureFlags";
import HomeTabs, { activeTabFor } from "./HomeTabs";
import Sampler from "./Sampler";
import Community from "./Community";
import User from "../User/User";

// Unified Home shell (spec: docs/specs/2026-07-17-unified-tabbed-home.md).
// Owns the desktop tab bar + an inner Switch that renders the existing Sampler /
// Community / User views as pure content. Param names are preserved so those
// components keep reading their own useParams/useRouteMatch. The shell does not
// remount when tabs change — only the matched child swaps.
export default function Home() {
  const useMessenger = isMessengerEnabled();
  const mobile = isMobile();
  const location = useLocation();
  const activeTab = activeTabFor(location.pathname);
  const unlistedBeta = location.pathname === "/home/feed" || location.pathname.startsWith("/home/feed/");

  const shellClass =
    "home-shell" +
    (mobile ? "" : " home-shell--tabs") +
    // Community-only layout: tab bar caps to the left column, right feed runs
    // flush to the top, left column doesn't scroll (see HomeTabs.css).
    (!mobile && activeTab === "community" ? " home-shell--community" : "");

  // Drop the main panel's right gutter while Community is active so the feed
  // reaches the window edge (CSS can't select the ancestor #main-panel).
  useEffect(() => {
    const isCommunity = !mobile && activeTab === "community";
    document.body.classList.toggle("community-view", isCommunity);
    return () => document.body.classList.remove("community-view");
  }, [mobile, activeTab]);

  return (
    // `--tabs` modifier (desktop only) lets the stylesheet own the fixed-header
    // clearance + tab-bar offset without affecting the mobile layout.
    <div className={shellClass}>
      {!mobile && !unlistedBeta && <HomeTabs />}
      <Switch>
        <Route path="/home/user/:value?"><User /></Route>

        <Route path="/home/feed/:channelId/:messageId(\d+)"><Community unlistedBeta /></Route>
        <Route path="/home/feed/:channelId"><Community unlistedBeta /></Route>
        <Route exact path="/home/feed"><Community unlistedBeta /></Route>

        {useMessenger ? (
          <Route path="/home/community/:channelId/:messageId(\d+)"><Community /></Route>
        ) : null}
        {useMessenger ? (
          <Route path="/home/community/:channelId"><Community /></Route>
        ) : null}
        {useMessenger ? (
          <Route exact path="/home/community"><Community /></Route>
        ) : (
          <Route path="/home/community"><Redirect to="/home" /></Route>
        )}

        <Route exact path="/home"><Sampler /></Route>

        {/* Legacy bare /home/:channelId messenger deep links → community tab. */}
        <Route
          path="/home/:legacyChannelId"
          render={({ match }) => (
            <Redirect to={`/home/community/${match.params.legacyChannelId}`} />
          )}
        />
      </Switch>
    </div>
  );
}
