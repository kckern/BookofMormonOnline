jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
jest.mock("../../../Home/tiles/ScripturePopup", () => ({
  __esModule: true,
  default: () => null,
  openScripture: jest.fn(),
}));

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { openScripture } from "../../../Home/tiles/ScripturePopup";
import Chiasm, { __clearChiasmCache } from "../Chiasm";

const fixture = {
  chiasmus_id: "x1",
  title: "Test Chiasm",
  reference: "Alma 36:1-30",
  scheme: "ABCBA",
  lines: [
    { line_key: "A", label: "1", line_text: "remember the _captivity_ of our fathers", highlights: '["captivity"]' },
    { line_key: "B", label: "2", line_text: "trust in _God_ and be delivered", highlights: '["God"]' },
    { line_key: "C", label: "3", line_text: "the turning _point_ of the whole", highlights: '["point"]' },
    { line_key: "B", label: "4", line_text: "put your trust in _God_", highlights: '["God"]' },
    { line_key: "A", label: "5", line_text: "the _captivity_ of the fathers, remembered", highlights: '["captivity"]' },
  ],
};

const renderChiasm = () =>
  render(
    <MemoryRouter initialEntries={["/analysis/chiasmus/x1"]}>
      <Chiasm chiasm_id="x1" setChiasmusId={jest.fn()} closeChiasm={jest.fn()} nextId={null} prevId={null} />
    </MemoryRouter>
  );

// pin buttons are the major-letter badges; two B lines → two "Pin the B pair"
const pinButton = (letter) => screen.getAllByRole("button", { name: `Pin the ${letter} pair` })[0];

describe("Chiasm detail panel", () => {
  beforeEach(() => {
    __clearChiasmCache();
    jest.clearAllMocks();
    BoMOnlineAPI.mockResolvedValue({ chiasm: { x1: fixture } });
  });

  test("renders all lines after fetch; exactly the deepest (C) line is the pivot", async () => {
    const { container } = renderChiasm();
    await screen.findByText("Test Chiasm");
    expect(container.querySelectorAll(".chiasmus_line")).toHaveLength(5);
    const pivots = container.querySelectorAll(".chiasmus_line.pivot");
    expect(pivots).toHaveLength(1);
    expect(pivots[0].textContent).toContain("the turning point of the whole");
  });

  test("clicking a badge pins its pair; clicking again unpins", async () => {
    const { container } = renderChiasm();
    await screen.findByText("Test Chiasm");

    fireEvent.click(pinButton("B"));
    const active = container.querySelectorAll(".chiasmus_line.active");
    const inactive = container.querySelectorAll(".chiasmus_line.inactive");
    expect(active).toHaveLength(2);
    expect(inactive).toHaveLength(3);
    active.forEach((el) => expect(el.textContent).toContain("God"));
    expect(pinButton("B")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(pinButton("B"));
    expect(container.querySelectorAll(".chiasmus_line.active")).toHaveLength(0);
    expect(container.querySelectorAll(".chiasmus_line.inactive")).toHaveLength(0);
    expect(pinButton("B")).toHaveAttribute("aria-pressed", "false");
  });

  test("pin survives mouseleave of the lines container (hover clear never unpins)", async () => {
    const { container } = renderChiasm();
    await screen.findByText("Test Chiasm");

    fireEvent.click(pinButton("B"));
    fireEvent.mouseLeave(container.querySelector(".chiasmus_lines"));
    expect(container.querySelectorAll(".chiasmus_line.active")).toHaveLength(2);
    expect(container.querySelectorAll(".chiasmus_line.inactive")).toHaveLength(3);
  });

  test("read-in-context calls openScripture with the chiasm reference", async () => {
    renderChiasm();
    await screen.findByText("Test Chiasm");
    fireEvent.click(screen.getByRole("button", { name: "Read in context" }));
    expect(openScripture).toHaveBeenCalledWith("Alma 36:1-30");
  });

  test("copy link writes the current URL and flips the label to Copied!", async () => {
    const writeText = jest.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    renderChiasm();
    await screen.findByText("Test Chiasm");
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(await screen.findByText("Copied!")).toBeInTheDocument();

    delete navigator.clipboard;
  });
});
