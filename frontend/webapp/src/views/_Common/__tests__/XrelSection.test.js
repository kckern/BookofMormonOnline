/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import XrelSection from "../XrelSection";

const mockSetPopUp = jest.fn();
jest.mock("src/contexts/AppControllerContext", () => ({
  useAppController: () => ({ functions: { setPopUp: (...args) => mockSetPopUp(...args) } }),
}));

jest.mock("src/models/Utils", () => ({
  label: (key) => key,
}));

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "https://cdn.test",
}));

// The thumbnail is covered by EntityThumb.test.js; here it only needs to prove
// which asset path each dst_type resolves to — and must contribute no text of
// its own, so card textContent assertions stay about the card.
jest.mock("../EntityThumb", () => (props) => {
  const R = require("react");
  return R.createElement("div", {
    className: "thumb-mock",
    "data-type": props.type,
    "data-slug": props.slug,
    "data-size": props.size,
  });
});

const srcRow = {
  rel: "held-by",
  dst_type: "people",
  dst_slug: "nephi",
  dst_name: "Nephi",
  dst_title: "Son of Lehi",
  note: null,
  direction: "src",
};
const dstRow = {
  rel: "taught-by",
  dst_type: "matter",
  dst_slug: "synagogues",
  dst_name: "Synagogues",
  dst_title: null,
  note: "Taught boldly (Alma 21:4)",
  direction: "dst",
};

describe("XrelSection", () => {
  beforeEach(() => mockSetPopUp.mockClear());

  test("renders nothing when empty and showEmpty is off", () => {
    const { container } = render(<XrelSection xrels={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("renders the empty message when showEmpty is set", () => {
    render(<XrelSection xrels={[]} showEmpty />);
    expect(screen.getByText("no_relationships")).toBeInTheDocument();
  });

  test("src groups read plainly; dst groups mark the reversed reading", () => {
    render(<XrelSection xrels={[srcRow, dstRow]} />);
    const heads = [...document.querySelectorAll(".xrel-group-head")];
    expect(heads[0].textContent).toBe("held by");
    expect(heads[0].classList.contains("reverse")).toBe(false);
    expect(heads[1].textContent).toContain("taught by");
    expect(heads[1].classList.contains("reverse")).toBe(true);
    // the reversed head is marked as such rather than reading like a forward one
    expect(heads[1].textContent).not.toBe("taught by");
  });

  test("notes render beneath the row", () => {
    render(<XrelSection xrels={[dstRow]} />);
    expect(screen.getByText(/Taught boldly/)).toBeInTheDocument();
  });

  test("clicking a row opens the destination popup by type", () => {
    render(<XrelSection xrels={[srcRow, dstRow]} />);
    fireEvent.click(screen.getByText("Nephi"));
    expect(mockSetPopUp).toHaveBeenCalledWith({ type: "people", ids: ["nephi"], underSlug: "people" });
    fireEvent.click(screen.getByText("Synagogues"));
    expect(mockSetPopUp).toHaveBeenCalledWith({ type: "matters", ids: ["synagogues"], underSlug: "matters" });
  });

  test("place rows route to the places popup", () => {
    render(<XrelSection xrels={[{ ...srcRow, dst_type: "place", dst_slug: "zarahemla", dst_name: "Zarahemla" }]} />);
    fireEvent.click(document.querySelector(".xrel"));
    expect(mockSetPopUp).toHaveBeenCalledWith({ type: "places", ids: ["zarahemla"], underSlug: "places" });
  });

  test("group rows are not clickable", () => {
    render(<XrelSection xrels={[{ ...srcRow, dst_type: "group", dst_name: "Nephites" }]} />);
    fireEvent.click(screen.getByText("Nephites"));
    expect(mockSetPopUp).not.toHaveBeenCalled();
  });

  test("noHeading suppresses the section heading", () => {
    render(<XrelSection xrels={[srcRow]} noHeading />);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  test("the title is a tooltip, not inline text", () => {
    render(<XrelSection xrels={[srcRow]} />);
    const card = document.querySelector(".xrel");
    expect(card).toHaveAttribute("data-tip", "Son of Lehi");
    expect(card.textContent).not.toContain("Son of Lehi");
  });

  test("the whole card is clickable, not just the name", () => {
    render(<XrelSection xrels={[srcRow]} />);
    fireEvent.click(document.querySelector(".xrel"));
    expect(mockSetPopUp).toHaveBeenCalledWith({ type: "people", ids: ["nephi"], underSlug: "people" });
  });

  test("group rows render as a tag rather than a dead link", () => {
    render(<XrelSection xrels={[{ ...srcRow, dst_type: "group", dst_name: "lamanites" }]} />);
    expect(document.querySelector(".xrel a")).toBeNull();
    expect(document.querySelector(".xrel-tag")).toBeInTheDocument();
  });

  test("rows are grouped by relation verb with a count", () => {
    render(<XrelSection xrels={[srcRow, { ...srcRow, dst_slug: "lehi", dst_name: "Lehi" }, dstRow]} />);
    const heads = [...document.querySelectorAll(".xrel-group-head")].map((h) => h.textContent);
    expect(heads.some((h) => h.includes("held by") && h.includes("2"))).toBe(true);
  });

  test("groups keep first-appearance order and gather later members of an earlier verb", () => {
    render(
      <XrelSection
        xrels={[
          srcRow,
          dstRow,
          { ...srcRow, dst_slug: "lehi", dst_name: "Lehi" },
        ]}
      />
    );
    const heads = [...document.querySelectorAll(".xrel-group-head")];
    expect(heads).toHaveLength(2);
    expect(heads[0].textContent).toContain("held by");
    const cards = [...document.querySelectorAll(".xrels > *")].map((n) => n.className);
    // held-by head, its two cards, then the reversed group
    expect(cards.slice(0, 3)).toEqual(["xrel-group-head", "xrel xrel-people clickable", "xrel xrel-people clickable"]);
  });

  test("verbs render human-readable, not hyphenated", () => {
    render(<XrelSection xrels={[srcRow]} />);
    expect(document.body.textContent).toContain("held by");
    expect(document.body.textContent).not.toContain("held-by");
  });

  test("mounts its own tooltip instance, so titles work outside the person popup", () => {
    // ReactTooltip id="relToolTip" lives inside PopUp.js's Relationships
    // component, which renders on person popups only. A matter popup renders
    // XrelSection alone, so it must carry its own instance.
    render(<XrelSection xrels={[srcRow]} />);
    const id = document.querySelector(".xrel").getAttribute("data-for");
    expect(id).toBeTruthy();
    expect(id).not.toBe("relToolTip");
    const tip = document.getElementById(id);
    expect(tip).toBeInTheDocument();
    expect(tip).toHaveClass("__react_component_tooltip");
  });

  test("each dst_type resolves to its asset folder, and groups get no thumbnail", () => {
    render(
      <XrelSection
        xrels={[
          srcRow,
          { ...srcRow, dst_type: "place", dst_slug: "zarahemla", dst_name: "Zarahemla" },
          { ...srcRow, dst_type: "matter", dst_slug: "swords", dst_name: "Swords" },
          { ...srcRow, dst_type: "group", dst_slug: "lamanites", dst_name: "lamanites" },
        ]}
      />
    );
    const thumbs = [...document.querySelectorAll(".thumb-mock")].map((t) => t.getAttribute("data-type"));
    expect(thumbs).toEqual(["people", "places", "matters"]);
    expect(document.querySelector(".xrel-group .thumb-mock")).toBeNull();
  });
});
