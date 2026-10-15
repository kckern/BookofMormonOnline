import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
        <Routes>
          <Route path="/people/:personName" element={<EntityPage type="people" />} />
        </Routes>
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
    const links = screen.getAllByRole("link", { name: /people/i });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((a) => expect(a).toHaveAttribute("href", "/people"));
  });

  describe("page layout (Task 9)", () => {
    // label() returns " " until a dictionary loads, which would make every
    // heading assertion below pass vacuously.
    beforeAll(() => { global.dictionary = { relationships: "Relationships", references: "References" }; });
    afterAll(() => { delete global.dictionary; });
    const ALMA = {
      slug: "alma2",
      name: "Alma2",
      title: "Chief judge and high priest",
      description: "Alma the younger was converted by an angel.",
      index: Array.from({ length: 30 }, (_, i) => ({ ref: `Alma ${i + 1}:1`, text: `Alma ${i + 1}:1` })),
      relations: [
        { relation: "son of $1", person: { slug: "alma1", name: "Alma1", title: "High priest" } },
        { relation: "father of $1", person: { slug: "helaman2", name: "Helaman2", title: "Prophet" } },
      ],
      xrels: [],
    };

    test("(a) a back link to the index appears before the h1", async () => {
      BoMOnlineAPI.mockResolvedValue({ person: { alma2: ALMA } });
      renderAt("/people/alma2");
      const h1 = await screen.findByRole("heading", { level: 1 });
      const back = screen.getAllByRole("link", { name: /people/i })[0];
      expect(back).toHaveAttribute("href", "/people");
      // DOCUMENT_POSITION_FOLLOWING: h1 comes after the back link.
      expect(back.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    test("(b) the h1 text is the entity name", async () => {
      BoMOnlineAPI.mockResolvedValue({ person: { alma2: ALMA } });
      renderAt("/people/alma2");
      const h1 = await screen.findByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent(/^Alma/);
      expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
    });

    test("(c) no Relationships or References heading when the lists are empty", async () => {
      BoMOnlineAPI.mockResolvedValue({ person: { noah2: NOAH } });
      renderAt("/people/noah2");
      await screen.findByRole("heading", { level: 1 });
      expect(screen.queryByRole("heading", { name: /relationships/i })).toBeNull();
      expect(screen.queryByRole("heading", { name: /references/i })).toBeNull();
    });

    test("(d) 30 references show 12 plus a 'Show all 30' button that expands", async () => {
      BoMOnlineAPI.mockResolvedValue({ person: { alma2: ALMA } });
      const { container } = renderAt("/people/alma2");
      await screen.findByRole("heading", { level: 1 });
      expect(container.querySelectorAll("ol.reference-list li")).toHaveLength(12);
      const more = screen.getByRole("button", { name: "Show all 30" });
      fireEvent.click(more);
      expect(container.querySelectorAll("ol.reference-list li")).toHaveLength(30);
      expect(screen.queryByRole("button", { name: "Show all 30" })).toBeNull();
    });

    test("references are buttons, not href-less anchors", async () => {
      BoMOnlineAPI.mockResolvedValue({ person: { alma2: ALMA } });
      const { container } = renderAt("/people/alma2");
      await screen.findByRole("heading", { level: 1 });
      expect(container.querySelectorAll("a:not([href])")).toHaveLength(0);
      expect(container.querySelectorAll("ol.reference-list li > button.ppref")).toHaveLength(12);
    });

    test("(e) relationship rows are links with an href", async () => {
      BoMOnlineAPI.mockResolvedValue({ person: { alma2: ALMA } });
      renderAt("/people/alma2");
      await screen.findByRole("heading", { level: 1 });
      expect(screen.getByRole("heading", { name: /relationships/i })).toBeInTheDocument();
      const rows = document.querySelectorAll(".related_people a.related_row");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveAttribute("href", "/people/alma1");
      expect(rows[1]).toHaveAttribute("href", "/people/helaman2");
    });
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
