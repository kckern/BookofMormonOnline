import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CommunityTile from "../CommunityTile";

const data = {
  groups: [{ url: "g1", name: "Group One", picture: "p", members: [{ user_id: 1, picture: "a" }] }],
  moreGroups: 0,
  messages: [],
  reading: [{ nickname: "Reader", picture: "r", progress: 40 }],
  finishers: [],
};

test("live activity stays visible and an always-on deeplink into /home/community renders", () => {
  render(<MemoryRouter><CommunityTile data={data} /></MemoryRouter>);
  // Reading-now is visible with no interaction (messages empty → reading shows).
  expect(screen.getByText("Reader")).toBeInTheDocument();
  const deep = screen.getByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });
  expect(deep.getAttribute("href")).toBe("/home/community");
});
