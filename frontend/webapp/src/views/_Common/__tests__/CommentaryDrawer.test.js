// Phone commentary drawer (R6 commentary-D3): a /commentary/:id deeplink opens
// it as an 85vw right-hand sheet with no visible way out — only the 59px
// backdrop sliver or browser Back. It now carries the desktop modal's ×.
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommentaryDrawer } from "../Drawer";

vi.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: vi.fn(() => new Promise(() => {})), assetUrl: "" }));
vi.mock("react-markdown", () => ({ __esModule: true, default: ({ children }) => children }));

const DATA = {
  id: "1558901101",
  title: "Search These Things Diligently",
  reference: "3 Nephi 23:1",
  text: "<p>Search the scriptures.</p>",
  publication: { source_id: "12", source_title: "Student Manual", source_name: "CES", source_year: "1996", source_publisher: "CES" },
};
const mockController = {
  states: { popUp: { open: true, type: "commentary", ids: [DATA.id], activeId: DATA.id }, preferences: {}, user: {} },
  functions: { setPopUp: vi.fn(), closePopUp: vi.fn(), clearPopUp: vi.fn() },
  popUpData: { [DATA.id]: DATA },
};
vi.mock("src/contexts/AppControllerContext", () => ({ useAppController: () => mockController }));

describe("CommentaryDrawer", () => {
  test("has a visible, labelled close control that closes the drawer", () => {
    const onClose = vi.fn();
    render(<CommentaryDrawer onClose={onClose} />);
    const btn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalled();
  });
});

// Blind r8 commentary-D5: on phone, "See in context" for a textual-variants
// (ATV) commentary opened this drawer with the apparatus as raw sigla
// ("having [NULLthat1|thatABCDEFGHIJKLMNOPQRS prayed > …") in a broken
// four-column layout (the drawer's own `.source` header flex rule hit the
// apparatus' `.source`). It renders through ATVHeader like the tile and popup.
describe("CommentaryDrawer with a textual-variants commentary", () => {
  const ATV = {
    ...DATA,
    id: "1253516301",
    reference: "Alma 2:28",
    title: "Alma 2:28 Textual Variants",
    text:
      "<div class='source'>\n  <em>having prayed mightily to him</em> " +
      "[NULL &gt; <em>that</em> 1|<em>that</em> ABCDEFGHIJKLMNOPQRST] he would deliver them\n</div>" +
      "<div class='analysis'><p>Elsewhere there are " +
      "[<em>that</em> 01A| BCDEFGHIJKLMNOPQRST] examples, as in 1 Nephi 2:11.</p></div>",
  };
  beforeEach(() => {
    mockController.states.popUp.ids = [ATV.id];
    mockController.states.popUp.activeId = ATV.id;
    mockController.popUpData = { [ATV.id]: ATV };
  });

  test("the apparatus renders as pills, never raw sigla", () => {
    const { container } = render(<CommentaryDrawer onClose={() => {}} />);
    expect(container.querySelector(".atv .source")).not.toBeNull();
    expect(container.querySelectorAll(".atv-string").length).toBeGreaterThan(0);
    expect(container.querySelector(".atv-apparatus.atv-inline")).not.toBeNull();
    const body = container.querySelector("#bodytext").textContent;
    expect(body).not.toMatch(/NULL|\||\[/);
    // the scripture citation in the analysis is still a link
    expect(container.querySelector("#bodytext .scripture_link")).not.toBeNull();
  });

  test("the drawer's publication header is not the apparatus' .source", () => {
    const { container } = render(<CommentaryDrawer onClose={() => {}} />);
    expect(container.querySelector(".commentaryDrawerSource")).not.toBeNull();
    expect(container.querySelector(".atv .commentaryDrawerSource")).toBeNull();
  });
});
