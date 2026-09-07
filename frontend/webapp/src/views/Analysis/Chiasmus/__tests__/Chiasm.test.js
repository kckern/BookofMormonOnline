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
import { render, screen, fireEvent, act, within } from "@testing-library/react";
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
    fireEvent.click(screen.getByRole("button", { name: /read in context/i }));
    expect(openScripture).toHaveBeenCalledWith("Alma 36:1-30");
  });

  test("shows the error state when the fetch resolves empty", async () => {
    BoMOnlineAPI.mockResolvedValueOnce({ chiasm: {} });
    renderChiasm();
    expect(await screen.findByText(/couldn't load this chiasm/i)).toBeInTheDocument();
  });

  test("shows the error state when the backend maps the id to null (live bad-deep-link shape)", async () => {
    BoMOnlineAPI.mockResolvedValueOnce({ chiasm: { x1: null } });
    renderChiasm();
    expect(await screen.findByText(/couldn't load this chiasm/i)).toBeInTheDocument();
  });

  test("times out to the error state if the fetch never settles", async () => {
    jest.useFakeTimers();
    try {
      BoMOnlineAPI.mockReturnValueOnce(new Promise(() => {})); // never resolves
      renderChiasm();
      act(() => { jest.advanceTimersByTime(16000); });
      expect(await screen.findByText(/couldn't load this chiasm/i)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  test("shows the error state when the fetch resolves empty", async () => {
    BoMOnlineAPI.mockResolvedValueOnce({ chiasm: {} });
    renderChiasm();
    expect(await screen.findByText(/couldn't load this chiasm/i)).toBeInTheDocument();
  });

  test("shows the error state when the backend maps the id to null (live bad-deep-link shape)", async () => {
    BoMOnlineAPI.mockResolvedValueOnce({ chiasm: { x1: null } });
    renderChiasm();
    expect(await screen.findByText(/couldn't load this chiasm/i)).toBeInTheDocument();
  });

  test("times out to the error state if the fetch never settles", async () => {
    jest.useFakeTimers();
    try {
      BoMOnlineAPI.mockReturnValueOnce(new Promise(() => {})); // never resolves
      renderChiasm();
      act(() => { jest.advanceTimersByTime(16000); });
      expect(await screen.findByText(/couldn't load this chiasm/i)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  test("failsafe firing after a successful load does not clobber the content", async () => {
    // Pins the functional updater (c => c === null ? undefined : c): if the
    // failsafe were simplified to setChiasm(undefined), a loaded chiasm would
    // flip to the error state 15s after opening.
    jest.useFakeTimers();
    try {
      renderChiasm();
      await act(async () => { await Promise.resolve(); }); // let the mocked fetch settle
      expect(screen.getByText("Test Chiasm")).toBeInTheDocument();
      act(() => { jest.advanceTimersByTime(16000); });
      expect(screen.getByText("Test Chiasm")).toBeInTheDocument();
      expect(screen.queryByText(/couldn't load this chiasm/i)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  test("renders a collapsed how-to explainer", async () => {
    BoMOnlineAPI.mockResolvedValue({ chiasm: { x1: fixture } });
    renderChiasm();
    await screen.findByText("Test Chiasm");
    const details = screen.getByText(/how to read a chiasm/i).closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(details).toHaveTextContent(/pivot/i);
  });

  test("header has prev/next that follow visible order and hint at arrow keys", async () => {
    BoMOnlineAPI.mockResolvedValue({ chiasm: { x1: fixture } });
    const setChiasmusId = jest.fn();
    render(
      <MemoryRouter>
        <Chiasm chiasm_id="x1" setChiasmusId={setChiasmusId} closeChiasm={jest.fn()} nextId="x2" prevId={null} />
      </MemoryRouter>
    );
    await screen.findByText("Test Chiasm");
    // Prev/Next live in the bottom .chiasmus_nav bar, not the sticky header --
    // dev's own detail-panel redesign (c2b72ec2) moved them there, alongside
    // Read in context, ahead of this test.
    const nav = document.querySelector(".chiasmus_nav");
    const next = within(nav).getByRole("button", { name: /next/i });
    expect(within(nav).getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(next.title).toMatch(/→/);
    fireEvent.click(next);
    expect(setChiasmusId).toHaveBeenCalledWith("x2");
  });

  test("last-in-list state disables next while prev stays enabled", async () => {
    BoMOnlineAPI.mockResolvedValue({ chiasm: { x1: fixture } });
    render(
      <MemoryRouter>
        <Chiasm chiasm_id="x1" setChiasmusId={jest.fn()} closeChiasm={jest.fn()} nextId={null} prevId="x0" />
      </MemoryRouter>
    );
    await screen.findByText("Test Chiasm");
    const nav = document.querySelector(".chiasmus_nav");
    expect(within(nav).getByRole("button", { name: /next/i })).toBeDisabled();
    expect(within(nav).getByRole("button", { name: /previous/i })).toBeEnabled();
  });

  test("header × calls closeChiasm", async () => {
    BoMOnlineAPI.mockResolvedValue({ chiasm: { x1: fixture } });
    const closeChiasm = jest.fn();
    render(
      <MemoryRouter>
        <Chiasm chiasm_id="x1" setChiasmusId={jest.fn()} closeChiasm={closeChiasm} nextId={null} prevId={null} />
      </MemoryRouter>
    );
    await screen.findByText("Test Chiasm");
    fireEvent.click(within(document.querySelector(".chiasm-header")).getByRole("button", { name: /close/i }));
    expect(closeChiasm).toHaveBeenCalledTimes(1);
  });
});
