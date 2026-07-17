import "@testing-library/jest-dom";
import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Switch, Route } from "react-router-dom";
import { CommunityRedirect, UserRedirect } from "../Routes";

const landAt = (entries, routeEls) => {
  let loc;
  render(
    <MemoryRouter initialEntries={entries}>
      <Switch>
        {routeEls}
        <Route path="*" render={({ location }) => { loc = location; return null; }} />
      </Switch>
    </MemoryRouter>
  );
  return () => loc;
};

describe("legacy path redirects", () => {
  test("/community → /home/community", () => {
    const get = landAt(["/community"], [
      <Route key="c" exact path="/community" component={CommunityRedirect} />,
    ]);
    expect(get().pathname).toBe("/home/community");
  });
  test("/community/:channelId → /home/community/:channelId", () => {
    const get = landAt(["/community/abc"], [
      <Route key="c" path="/community/:channelId" component={CommunityRedirect} />,
    ]);
    expect(get().pathname).toBe("/home/community/abc");
  });
  test("/community/:channelId/:messageId → nested", () => {
    const get = landAt(["/community/abc/42"], [
      <Route key="c" path="/community/:channelId/:messageId" component={CommunityRedirect} />,
    ]);
    expect(get().pathname).toBe("/home/community/abc/42");
  });
  test("/user → /home/user", () => {
    const get = landAt(["/user"], [
      <Route key="u" exact path="/user" component={UserRedirect} />,
    ]);
    expect(get().pathname).toBe("/home/user");
  });
  test("/user/history → /home/user/history", () => {
    const get = landAt(["/user/history"], [
      <Route key="u" path="/user/:value" component={UserRedirect} />,
    ]);
    expect(get().pathname).toBe("/home/user/history");
  });
});
