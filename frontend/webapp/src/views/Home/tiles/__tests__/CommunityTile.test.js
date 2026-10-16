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

import fs from "node:fs";
import path from "node:path";

const renderC = (d) => render(<MemoryRouter><CommunityTile data={d} /></MemoryRouter>);
const g = (n) => ({ url: `g${n}`, name: `Group ${n}`, picture: `p${n}`, members: [{ user_id: n, picture: "a" }] });

describe("CommunityTile — Task 10h", () => {
  test("null collapses; an empty payload degrades to the invitation with no undefined or broken images", () => {
    const { container: c0 } = renderC(null);
    expect(c0.firstChild).toBeNull();
    const { container } = renderC({});
    expect(container.textContent).not.toMatch(/undefined|NaN|null/);
    container.querySelectorAll("img").forEach((img) => expect(img.getAttribute("src")).toBeTruthy());
  });

  test("missing pictures render no <img> (no broken image)", () => {
    const { container } = renderC({
      groups: [{ url: "g1", name: "G", members: [{ user_id: 1 }] }],
      messages: [{ channel: "g1", id: 1, fresh: true, groupName: "G", msg: "hi there", user: { nickname: "N" } }],
      finishers: [{ nickname: "F" }],
    });
    container.querySelectorAll("img").forEach((img) => expect(img.getAttribute("src")).toBeTruthy());
    expect(container.textContent).not.toMatch(/undefined/);
  });

  test("the Layer-2 CTA uses the TileCTA viewAll verb", () => {
    const { container } = renderC(data);
    const cta = container.querySelector(".tileCTA.tileMoreLink");
    expect(cta.textContent.trim()).toBe("View all");
    expect(cta.getAttribute("href")).toBe("/home/community");
  });

  test("shows two group cards and folds the rest into a visible +N card", () => {
    const { container } = renderC({ ...data, groups: [g(1), g(2), g(3), g(4)], moreGroups: 3 });
    expect(container.querySelectorAll(".communityGroupCard:not(.communityMoreCard)").length).toBe(2);
    const more = container.querySelector(".communityMoreCard");
    expect(more.textContent).toMatch(/\+5/);
    expect(more.getAttribute("href")).toBe("/home/community");
  });

  test("message text is rendered (not width-hidden) and labels carry no emoji", () => {
    const { container } = renderC({
      ...data,
      messages: [{ channel: "g1", id: 7, fresh: true, groupName: "G", msg: "<p>words here</p>", user: { nickname: "N", picture: "x" } }],
      finishers: [{ nickname: "F", picture: "f" }],
    });
    expect(container.querySelector(".communityMsgText").textContent).toBe("words here");
    expect(container.querySelector(".communityFinisherLabel").textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  test("CSS never hides message text or the more-card by container width; cards get a focus style", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");
    expect(css).not.toMatch(/\.communityMsgText\s*\{\s*display:\s*none/);
    expect(css).not.toMatch(/\.communityGroupCard:nth-child\(n \+ 3\)\s*\{\s*display:\s*none/);
    expect(css).toMatch(/\.communityGroupCard:focus-visible/);
    expect(css).toMatch(/\.communityMessage:focus-visible/);
  });
});
