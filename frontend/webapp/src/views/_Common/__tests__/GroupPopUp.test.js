/* eslint-disable testing-library/no-container, testing-library/no-node-access */
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
    // The mocked setPopUp doesn't store data, so store it manually and rerender.
    mockController.popUpData = { nephites: groupData };
    rerender(<GroupPopUp />);
    await waitFor(() => expect(screen.getByText("Nephites")).toBeInTheDocument());
    expect(screen.getByText("Plates")).toBeInTheDocument();
    expect(screen.getByText("kept-by")).toBeInTheDocument();
  });
});
