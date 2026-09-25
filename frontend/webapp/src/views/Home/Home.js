import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { isMobile } from "src/models/Utils";
import { isMessengerEnabled } from "src/models/featureFlags";
import HomeTabs, { activeTabFor } from "./HomeTabs";
import Sampler from "./Sampler";
import Community from "./Community";
import User from "../User/User";
import PublicBotProfile from "../User/PublicBotProfile";

// Unified Home shell (spec: docs/specs/2026-07-17-unified-tabbed-home.md).
// Owns the desktop tab bar + an inner Routes that renders the existing Sampler /
// Community / User views as pure content. Param names are preserved so those
// components keep reading their own useParams/useRouteMatch. The shell does not
// remount when tabs change — only the matched child swaps.
/**
 * v5 used <Route render={({ match }) => <Redirect ... />} />. v7 has no `render`
 * prop, so the redirect is a component that reads the param itself.
 */
function LegacyChannelRedirect() {
  const { legacyChannelId } = useParams();
  return <Navigate to={`/home/community/${legacyChannelId}`} replace />;
}

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

  // /home/feed is the unlisted beta entry point, so it must not be indexed.
  // Restored from 50c521a0; ac6a8fe6's rewrite of this file dropped the effect
  // while keeping `unlistedBeta` itself, so the route silently lost its
  // noindex. The Next front door already answers crawler user-agents with
  // 404 + noindex, which is why nothing broke visibly — this covers the case
  // that misses: a scraper presenting a browser UA and executing JS, which is
  // served the CRA shell instead. The cleanup restores whatever was there
  // before, so leaving /home/feed cannot strip another view's robots tag.
  useEffect(() => {
    if (!unlistedBeta) return undefined;
    let robots = document.querySelector('meta[name="robots"]');
    const created = !robots;
    const previous = robots?.getAttribute('content');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex,nofollow,noarchive');
    return () => {
      if (created) robots.remove();
      else if (previous == null) robots.removeAttribute('content');
      else robots.setAttribute('content', previous);
    };
  }, [unlistedBeta]);

  return (
    // `--tabs` modifier (desktop only) lets the stylesheet own the fixed-header
    // clearance + tab-bar offset without affecting the mobile layout.
    <div className={shellClass}>
      {!mobile && !unlistedBeta && <HomeTabs />}
      <Routes>
        <Route path="profile/:userId" element={<PublicBotProfile />} />
        <Route path="user/:value?" element={<User />} />

        {/* v7 has no regex params, so the numeric :messageId is a plain segment
            now. Community looks the id up and falls back to the channel when it
            is not a real message, so the constraint was belt-and-braces. */}
        <Route path="feed/:channelId/:messageId" element={<Community unlistedBeta />} />
        <Route path="feed/:channelId" element={<Community unlistedBeta />} />
        <Route path="feed" element={<Community unlistedBeta />} />

        {useMessenger ? (
          <Route path="community/:channelId/:messageId" element={<Community />} />
        ) : null}
        {useMessenger ? (
          <Route path="community/:channelId" element={<Community />} />
        ) : null}
        {useMessenger ? (
          <Route path="community" element={<Community />} />
        ) : (
          // Two routes, not one: v5's non-exact <Route path="community">
          // also swallowed /home/community/<channel>, but v7 matches that path
          // exactly, so a deep link would fall through to the page catch-all
          // instead of redirecting when messenger is off.
          <>
            <Route path="community" element={<Navigate to="/home" replace />} />
            <Route path="community/*" element={<Navigate to="/home" replace />} />
          </>
        )}

        {/* /home itself. `index` is v7's way to say "the parent path". */}
        <Route index element={<Sampler />} />

        {/* Legacy bare /home/:channelId deep links -> community tab. v7 dropped
            the `render` prop, so the redirect reads its own param. */}
        <Route path=":legacyChannelId" element={<LegacyChannelRedirect />} />
      </Routes>
    </div>
  );
}
