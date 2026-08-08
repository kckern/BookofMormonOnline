import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WitnessTile from "../WitnessTile";

const data = [
  { principal: "Martin Harris", witnessSlug: "martin-harris", moneyQuote: "I saw the plates and the engravings thereon.", source: "Interview" },
];

const deep = () => screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });

// The read-more expander was removed (the quote is right-sized at the data
// level), so the deeplink is present immediately and no read-more pill renders.
test("outer element is a div; deeplink present immediately, no read-more pill", () => {
  const { container } = render(<MemoryRouter><WitnessTile data={data} /></MemoryRouter>);
  expect(container.querySelector(".witnessTile").tagName).toBe("DIV");
  expect(screen.getByText("Martin Harris")).toBeInTheDocument();
  expect(deep().getAttribute("href")).toBe("/history/witnesses/martin-harris");
  expect(screen.queryByRole("button", { name: (n, el) => el.classList.contains("readMorePill") })).toBeNull();
});
