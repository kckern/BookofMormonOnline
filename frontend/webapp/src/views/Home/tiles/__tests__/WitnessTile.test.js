import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WitnessTile from "../WitnessTile";

// Force the ExpandableText quote to truncate so the gate fires.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
});

const data = [
  { principal: "Martin Harris", witnessSlug: "martin-harris", moneyQuote: "I saw the plates and the engravings thereon.", source: "Interview" },
];

const deep = () => screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });

test("outer element is a div and the deeplink is gated behind the quote expand", () => {
  const { container } = render(<MemoryRouter><WitnessTile data={data} /></MemoryRouter>);
  expect(container.querySelector(".witnessTile").tagName).toBe("DIV");
  expect(screen.getByText("Martin Harris")).toBeInTheDocument();
  expect(deep()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: (n, el) => el.classList.contains("readMorePill") }));
  expect(deep().getAttribute("href")).toBe("/history/witnesses/martin-harris");
});
