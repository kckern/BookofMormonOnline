import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PersonProfileTile from "../PersonProfileTile";
import PlaceProfileTile from "../PlaceProfileTile";
import MatterProfileTile from "../MatterProfileTile";

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

test("MatterProfileTile: deeplink hidden until the description is expanded", () => {
  const payload = {
    mattersConcept: [
      { slug: "oaths", name: "Oaths", subtitle: "Oaths in Nephite society",
        description: "A long concept description that overflows its lines.",
        xrels: [{ rel: "related", dst_type: "people", dst_slug: "nephi", dst_name: "Nephi" }] },
    ],
  };
  renderIn(<MatterProfileTile payload={payload} group="concept" matterIndex={0} />);
  expect(deep()).toBeNull();
  fireEvent.click(readMore());
  expect(deep().getAttribute("href")).toBe("/matters/oaths");
});

test("MatterProfileTile: does not render relationship chips", () => {
  const payload = {
    mattersConcept: [
      { slug: "oaths", name: "Oaths", description: "desc",
        xrels: [{ rel: "related", dst_type: "people", dst_slug: "nephi", dst_name: "Nephi" }] },
    ],
  };
  const { container } = renderIn(<MatterProfileTile payload={payload} group="concept" matterIndex={0} />);
  expect(screen.queryByText("Nephi")).toBeNull();
  expect(container.querySelector(".matterRelChip")).toBeNull();
});
