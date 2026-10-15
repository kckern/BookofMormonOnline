import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import Matters from "../Matters";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(() => new Promise(() => {})),
  assetUrl: "https://media.example.test",
}));
// The filter chrome is not under test here and pulls in heavy shared UI.
vi.mock("../MattersFilter", () => ({
  MattersFilter: ({ resultCount }) => <div data-testid="filter">{resultCount}</div>,
}));

const matterList = [
  { slug: "battle-a", name: "Battle A", branch: "concrete", specificity: "instance", weight: 1 },
  { slug: "battle-b", name: "Battle B", branch: "concrete", specificity: "instance", weight: 2 },
  { slug: "sword", name: "Sword", branch: "concrete", specificity: "type", weight: 3 },
  { slug: "faith", name: "Faith", branch: "concepts", specificity: "type", weight: 4 },
];

const fixture = {
  states: { popUp: { open: false, type: null, ids: [], activeId: null } },
  preLoad: { matterList },
  popUpData: {},
  functions: { setPopUp: vi.fn(), closePopUp: vi.fn() },
};

const renderGroup = (group, path = "/matters") =>
  render(
    <AppControllerProvider appController={fixture}>
      <MemoryRouter initialEntries={[path]}>
        <Matters group={group} />
      </MemoryRouter>
    </AppControllerProvider>,
  );

const cardNames = () => screen.queryAllByRole("heading", { level: 5 }).map((h) => h.textContent);

describe("<Matters group>", () => {
  test("narrative shows only concrete instances, with heading and count", () => {
    renderGroup("narrative", "/matters/narrative");
    expect(cardNames()).toEqual(["Battle A", "Battle B"]);
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent(/Narrative/);
    expect(heading).toHaveTextContent(/2/);
  });

  test("material shows concrete non-instances", () => {
    renderGroup("material", "/matters/material");
    expect(cardNames()).toEqual(["Sword"]);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(/Material/);
  });

  test("concept (URL keyword concepts) shows the concepts branch", () => {
    renderGroup("concept", "/matters/concepts");
    expect(cardNames()).toEqual(["Faith"]);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(/Concepts/);
  });

  test("no group shows everything with no group qualifier", () => {
    renderGroup(undefined);
    expect(cardNames()).toHaveLength(4);
    expect(screen.queryByText(/Narrative/)).not.toBeInTheDocument();
  });
});
