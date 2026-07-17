import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { GroupPopUp } from "../PopUp";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

jest.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: jest.fn(), assetUrl: "" }));
// react-markdown is ESM-only; CRA's jest doesn't transform node_modules.
jest.mock("react-markdown", () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock("src/models/Utils", () => ({
  label: (k) => k, isMobile: () => false, determineLanguage: () => "en",
  processName: (n) => n, replaceNumbers: (n) => n, snapSelectionToWord: () => {}, log: () => {},
}));

const mockController = {
  states: { popUp: { open: true, type: "group", ids: ["nephites"], activeId: "nephites", top: 0, left: 0 } },
  functions: { setPopUp: jest.fn(), closePopUp: jest.fn() },
  popUpData: {},
};
jest.mock("src/contexts/AppControllerContext", () => ({
  useAppController: () => mockController,
}));

const groupData = {
  slug: "nephites", name: "Nephites",
  xrels: [{ rel: "kept-by", dst_type: "object", dst_slug: "plates", dst_name: "Plates", direction: "dst" }],
};

describe("GroupPopUp", () => {
  beforeEach(() => {
    mockController.popUpData = {};
    mockController.functions.setPopUp = jest.fn();
    mockController.functions.closePopUp = jest.fn();
    BoMOnlineAPI.mockImplementation(() =>
      Promise.resolve({ group: { nephites: groupData } })
    );
  });

  test("fetches and renders name plus xrel rows", async () => {
    const { rerender } = render(<GroupPopUp />);
    // Data undefined on first render: the component fires the fetch and shows Loading.
    await waitFor(() => expect(BoMOnlineAPI).toHaveBeenCalledWith(
      expect.objectContaining({ group: ["nephites"] }),
      expect.anything()
    ));
    // The component must store the fetched group keyed by slug.
    await waitFor(() => expect(mockController.functions.setPopUp).toHaveBeenCalledWith(
      expect.objectContaining({
        popUpData: { nephites: expect.objectContaining({ slug: "nephites" }) },
      })
    ));
    // The mocked setPopUp doesn't store data, so store it manually and rerender.
    mockController.popUpData = { nephites: groupData };
    rerender(<GroupPopUp />);
    await waitFor(() => expect(screen.getByText("Nephites")).toBeInTheDocument());
    expect(screen.getByText("Plates")).toBeInTheDocument();
    expect(screen.getByText("kept-by")).toBeInTheDocument();
  });

  test("unknown slug is pinned to null and renders a closable not-found card", async () => {
    // Backend filters unknown slugs out entirely: empty result set.
    BoMOnlineAPI.mockImplementation(() => Promise.resolve({ group: {} }));
    const { rerender } = render(<GroupPopUp />);
    // The missing slug must be stored as null (undefined would refetch forever).
    await waitFor(() => expect(mockController.functions.setPopUp).toHaveBeenCalledWith(
      expect.objectContaining({ popUpData: { nephites: null } })
    ));
    mockController.popUpData = { nephites: null };
    rerender(<GroupPopUp />);
    // Not-found card with a working close button, not an invisible popup.
    expect(screen.getByText("Group not found")).toBeInTheDocument();
    expect(screen.getByText("×")).toBeInTheDocument();
    // Loop regression guard: the null entry must not re-trigger the fetch.
    expect(BoMOnlineAPI).toHaveBeenCalledTimes(1);
  });
});
