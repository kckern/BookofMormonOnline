import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CommunityTile, { quoteText, relativeTime } from "../CommunityTile";

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

  test("shows two group rows and folds the rest into a visible +N row", () => {
    const { container } = renderC({ ...data, groups: [g(1), g(2), g(3), g(4)], moreGroups: 3 });
    expect(container.querySelectorAll(".communityGroupCard").length).toBe(2);
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
    expect(css).not.toMatch(/\.communityMoreCard\s*\{\s*display:\s*none/);
    expect(css).toMatch(/\.communityGroupCard:focus-visible/);
    expect(css).toMatch(/\.communityMessage:focus-visible/);
  });

  test("the freshest message leads as an attributed quote with a relative time (audit I2)", () => {
    const ts = Date.now() - 3 * 86400e3;
    const { container } = renderC({
      ...data,
      messages: [
        { channel: "g1", id: 7, fresh: true, groupName: "Circle", timestamp: ts, msg: "first words", user: { nickname: "N" } },
        { channel: "g2", id: 8, fresh: true, groupName: "Other", timestamp: ts, msg: "second", user: { nickname: "M" } },
      ],
    });
    const quote = container.querySelector(".communityQuote");
    expect(quote.getAttribute("href")).toBe("/home/community/g1/7");
    expect(quote.textContent).toMatch(/first words/);
    expect(quote.textContent).toMatch(/in Circle/);
    expect(quote.querySelector("time").textContent).toMatch(/3 days ago/);
    // one quote, not a feed of chips
    expect(container.querySelectorAll(".communityQuote").length).toBe(1);
    expect(container.querySelector(".communityGroupChip")).toBeNull();
  });

  test("group names are never line-clamped and rows are 44px targets (audit H3/beauty)", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");
    const rule = css.slice(css.indexOf(".communityGroupName {"), css.indexOf("}", css.indexOf(".communityGroupName {")));
    expect(rule).not.toMatch(/line-clamp/);
    const card = css.slice(css.indexOf(".communityGroupCard {"), css.indexOf("}", css.indexOf(".communityGroupCard {")));
    expect(card).toMatch(/min-height:\s*44px/);
  });

  test("quote text clamps on a word boundary", () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const out = quoteText({ msg: long });
    expect(out.split(" ").length).toBeLessThanOrEqual(29);
    expect(out).toMatch(/word\d+…?$/);
  });

  test("relativeTime is empty for missing timestamps", () => {
    expect(relativeTime(undefined)).toBe("");
    expect(relativeTime(Date.now() - 2 * 3600e3)).toMatch(/2 hours ago/);
  });
});
