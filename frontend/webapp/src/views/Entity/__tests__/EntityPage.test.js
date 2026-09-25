import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import EntityPage from "../EntityPage";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.bookofmormon.online",
}));

const NOAH = {
  slug: "noah2",
  name: "Noah2",
  title: "Wicked king of the Nephites",
  description: "King Noah taxed his people one fifth of all they possessed.",
  index: [],
  relations: [],
  xrels: [],
};

// Minimal appController fixture — the provider's own docblock prescribes this
// pattern for tests. personList drives chooser resolution.
const fixture = {
  states: { popUp: { open: false, type: null, ids: [], activeId: null } },
  preLoad: {
    personList: [
      { slug: "noah1", name: "Noah1", title: "Son of Lamech" },
      { slug: "noah2", name: "Noah2", title: "Wicked king" },
      { slug: "noah3", name: "Noah3", title: "Jaredite" },
      { slug: "noahs-priests", name: "Noah's priests", title: null },
    ],
  },
  popUpData: {},
  functions: { setPopUp: vi.fn(), closePopUp: vi.fn() },
};

const renderAt = (path) =>
  render(
    <AppControllerProvider appController={fixture}>
      <MemoryRouter initialEntries={[path]}>
        <Route path="/people/:personName">
          <EntityPage type="people" />
        </Route>
      </MemoryRouter>
    </AppControllerProvider>,
  );

describe("EntityPage", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test("renders the entity as a page, with no modal chrome", async () => {
    BoMOnlineAPI.mockResolvedValue({ person: { noah2: NOAH } });
    const { container } = renderAt("/people/noah2");
    await waitFor(() => expect(screen.getByText(/Wicked king/)).toBeInTheDocument());
    expect(container.querySelector("#popUp")).toBeNull();
    expect(container.querySelector(".entity-page")).toBeInTheDocument();
  });

  test("does not open the modal", async () => {
    BoMOnlineAPI.mockResolvedValue({ person: { noah2: NOAH } });
    renderAt("/people/noah2");
    await waitFor(() => expect(screen.getByText(/Wicked king/)).toBeInTheDocument());
    expect(fixture.functions.setPopUp).not.toHaveBeenCalled();
  });

  test("shows a back link to the index", async () => {
    BoMOnlineAPI.mockResolvedValue({ person: { noah2: NOAH } });
    renderAt("/people/noah2");
    await waitFor(() => expect(screen.getByText(/Wicked king/)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /people/i })).toHaveAttribute("href", "/people");
  });

  test("an ambiguous bare slug renders the chooser, excluding loose matches", async () => {
    BoMOnlineAPI.mockResolvedValue({ person: { noah: null } });
    renderAt("/people/noah");
    await waitFor(() => expect(screen.getByText(/Son of Lamech/)).toBeInTheDocument());
    expect(screen.getByText(/Jaredite/)).toBeInTheDocument();
    expect(screen.queryByText(/Noah's priests/)).toBeNull();
  });

  test("an unresolvable slug renders a not-found state, not a crash", async () => {
    BoMOnlineAPI.mockResolvedValue({ person: { "king-noah": null } });
    renderAt("/people/king-noah");
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });
});
