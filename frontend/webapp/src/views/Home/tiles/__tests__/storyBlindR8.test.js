import "@testing-library/jest-dom";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import CommunityTile from "../CommunityTile";
import { inlineCase } from "../_ds/labelOr";
import { displayPlaceName } from "../textUtils";
import { legsOf, stopsOf } from "../mapStoryPath";
import CommunityBack, { communityBackTarget } from "../../CommunityBack";

const css = (rel) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");
const sampler = css("../../Sampler.css");

describe("community tile (blind R8)", () => {
  test("A3: a title-case table noun reads lowercase mid-phrase; other scripts untouched", () => {
    expect(inlineCase("Members")).toBe("members");
    expect(inlineCase("Member")).toBe("member");
    expect(inlineCase("DVD")).toBe("DVD");
    expect(inlineCase("명")).toBe("명");
    expect(inlineCase("")).toBe("");
  });

  test("M2: a failing avatar becomes the neutral disc, not a retried broken image", () => {
    const { container } = render(
      <MemoryRouter>
        <CommunityTile data={{ groups: [{ url: "g1", name: "G", picture: "https://x/g.png", members: [{ user_id: 1, picture: "https://x/a.png" }] }] }} />
      </MemoryRouter>,
    );
    const imgs = [...container.querySelectorAll(".communityFacepile img")];
    expect(imgs.length).toBe(1);
    fireEvent.error(imgs[0]);
    expect(container.querySelector(".communityFacepile img")).toBeNull();
    expect(container.querySelector(".communityFacepile .communityAvatarBlank")).not.toBeNull();
  });

  test("C1: the pull quote gets a hover wash like the group rows", () => {
    const rule = sampler.match(/\.communityQuote:hover\s*\{([^}]*)\}/);
    expect(rule && rule[1]).toMatch(/background/);
  });
});

describe("community destinations (blind R8 D3/D5)", () => {
  test("back target falls back to the parent level when there is no in-app history", () => {
    expect(communityBackTarget({ base: "/home/community", channel: "g1", message: "7" })).toBe("/home/community/g1");
    expect(communityBackTarget({ base: "/home/community", channel: "g1" })).toBe("/home/community");
    expect(communityBackTarget({ base: "/home/community" })).toBe("/home");
  });

  const Where = () => <div data-testid="where">{useLocation().pathname}</div>;
  test("D3: a top back control returns to Home when Home was the referrer", () => {
    render(
      <MemoryRouter initialEntries={["/home", "/home/community/g1/7"]} initialIndex={1}>
        <Routes>
          <Route path="*" element={<><CommunityBack channel="g1" message="7" /><Where /></>} />
        </Routes>
      </MemoryRouter>,
    );
    const btn = screen.getByRole("button", { name: /back/i });
    fireEvent.click(btn);
    expect(screen.getByTestId("where").textContent).toBe("/home");
  });

  test("D3: a cold deeplink climbs to the parent level", () => {
    render(
      <MemoryRouter initialEntries={["/home/community/g1/7"]}>
        <Routes>
          <Route path="*" element={<><CommunityBack channel="g1" message="7" /><Where /></>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByTestId("where").textContent).toBe("/home/community/g1");
  });

  test("D5: the signed-out group CTA is not an <a> (group cards are already links)", () => {
    const src = css("../../Community.js");
    const fn = src.slice(src.indexOf("export function GroupCallToAction"), src.indexOf("export function groupToolTipHtml"));
    const signedOut = fn.slice(fn.indexOf("if (!myId)"), fn.indexOf("membership_policy"));
    expect(signedOut).not.toMatch(/<Link\b/);
  });

  test("D5: the feed header's group avatar is a fixed small square, not the raw cover size", () => {
    const home = css("../../Home.css");
    const rule = home.match(/img\.groupAvatar\s*\{([^}]*)\}/);
    expect(rule[1]).toMatch(/width:\s*3rem/);
    expect(rule[1]).toMatch(/height:\s*3rem/);
    expect(rule[1]).toMatch(/object-fit:\s*cover/);
  });
});

describe("map story (blind R8 P2s)", () => {
  test("A7: malformed 'City of and Land of2 Shem' displays as 'City and Land of Shem²'", () => {
    expect(displayPlaceName("City of and Land of2 Shem")).toBe("City and Land of Shem²");
    expect(displayPlaceName("Land of Nephi")).toBe("Land of Nephi");
    expect(displayPlaceName("Jershon2")).toBe("Jershon²");
    const moves = [{ seq: 1, start: "a", startName: "City of and Land of2 Shem", end: "b", endName: "City of Desolation" }];
    expect(legsOf(moves)[0].from.name).toBe("City and Land of Shem²");
    expect(stopsOf(moves)[0].name).toBe("City and Land of Shem²");
  });

  test("L3: the dark primary control has its own hover colour", () => {
    expect(sampler).toMatch(/html\[data-theme="dark"\] \.mapStoryControlButton\.isPrimary:hover:not\(:disabled\)\s*\{[^}]*background:\s*#fff/);
  });

  test("F2: cluster buttons get a 44px touch hit", () => {
    expect(sampler).toMatch(/\.mapStoryCluster::after\s*\{[^}]*inset:\s*-(6|8)px 0/); // -8 since blind 2026-10-20 F2 (measured 38-43 at -6)
  });
});
