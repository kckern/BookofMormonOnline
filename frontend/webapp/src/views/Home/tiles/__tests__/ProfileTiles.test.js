import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PersonProfileTile from "../PersonProfileTile";
import PlaceProfileTile from "../PlaceProfileTile";

// Force the ExpandableText bio/desc to truncate so the gate fires.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
});

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const deep = () => screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });
const readMore = () => screen.getByRole("button", { name: (n, el) => el.classList.contains("readMorePill") });

test("PersonProfileTile: deeplink hidden until the bio is expanded", () => {
  const payload = { people: [{ slug: "alma", name: "Alma", description: "A long bio that overflows." }] };
  renderIn(<PersonProfileTile payload={payload} personIndex={0} />);
  expect(deep()).toBeNull();
  fireEvent.click(readMore());
  expect(deep().getAttribute("href")).toBe("/people/alma");
});

test("PlaceProfileTile: deeplink hidden until the description is expanded", () => {
  const payload = { places: [{ slug: "nephi", name: "Land of Nephi", description: "A long place description." }] };
  renderIn(<PlaceProfileTile payload={payload} placeIndex={0} />);
  expect(deep()).toBeNull();
  fireEvent.click(readMore());
  expect(deep().getAttribute("href")).toBe("/places/nephi");
});
