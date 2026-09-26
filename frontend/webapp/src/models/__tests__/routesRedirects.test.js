import "@testing-library/jest-dom";
import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { CommunityRedirect, UserRedirect } from "../Routes";

// v7 dropped the `render` prop, so the landing location is observed by a
// component using useLocation. It sits OUTSIDE <Routes> so it reports the
// location whatever matched — including after a <Navigate> has redirected.
function LocationProbe({ onChange }) {
  onChange(useLocation());
  return null;
}

const landAt = (entries, routeEls) => {
  let loc;
  render(
    <MemoryRouter initialEntries={entries}>
      <Routes>{routeEls}</Routes>
      <LocationProbe onChange={(l) => { loc = l; }} />
    </MemoryRouter>
  );
  return () => loc;
};

describe("legacy path redirects", () => {
  test("/community → /home/community", () => {
    const get = landAt(["/community"], [
      <Route key="c" path="/community" element={<CommunityRedirect />} />,
    ]);
    expect(get().pathname).toBe("/home/community");
  });
  test("/community/:channelId → /home/community/:channelId", () => {
    const get = landAt(["/community/abc"], [
      <Route key="c" path="/community/:channelId" element={<CommunityRedirect />} />,
    ]);
    expect(get().pathname).toBe("/home/community/abc");
  });
  test("/community/:channelId/:messageId → nested", () => {
    const get = landAt(["/community/abc/42"], [
      <Route key="c" path="/community/:channelId/:messageId" element={<CommunityRedirect />} />,
    ]);
    expect(get().pathname).toBe("/home/community/abc/42");
  });
  test("/user → /home/user", () => {
    const get = landAt(["/user"], [
      <Route key="u" path="/user" element={<UserRedirect />} />,
    ]);
    expect(get().pathname).toBe("/home/user");
  });
  test("/user/history → /home/user/history", () => {
    const get = landAt(["/user/history"], [
      <Route key="u" path="/user/:value" element={<UserRedirect />} />,
    ]);
    expect(get().pathname).toBe("/home/user/history");
  });
});
