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
