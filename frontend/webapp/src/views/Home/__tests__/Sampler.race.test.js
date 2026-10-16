import React from "react";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import Sampler from "../Sampler";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

const sampler = (seed, person) => ({
  homesampler: [{ seed, people: [{ slug: person.toLowerCase(), name: person, title: "t" }], places: [] }],
});

const fakeAppController = {
  states: { user: { token: null, user: null }, studyGroup: { groupList: [] } },
  functions: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe("Sampler latest-request-wins (audit B2)", () => {
  test("a slow, superseded homesampler response never overwrites the newer page", async () => {
    const pending = [];
    BoMOnlineAPI.mockImplementation((input) => {
      if (input && "homesampler" in input) return new Promise((res, rej) => pending.push({ res, rej }));
      return Promise.resolve({});
    });
    render(
      <AppControllerProvider appController={fakeAppController}>
        <MemoryRouter>
          <Sampler />
        </MemoryRouter>
      </AppControllerProvider>,
    );
    expect(pending.length).toBe(1); // cold load
    act(() => {
      window.dispatchEvent(new Event("home:resample"));
    });
    expect(pending.length).toBe(2);
    await act(async () => {
      pending[1].res(sampler(7, "Abish"));
    });
    expect(screen.getByText("Abish")).toBeTruthy();
    // the first (superseded) request lands late
    await act(async () => {
      pending[0].res(sampler(3, "Nephi"));
    });
    expect(screen.queryByText("Nephi")).toBeNull();
    expect(screen.getByText("Abish")).toBeTruthy();
  });

  test("a superseded request that fails does not retry", async () => {
    const pending = [];
    BoMOnlineAPI.mockImplementation((input) => {
      if (input && "homesampler" in input) return new Promise((res, rej) => pending.push({ res, rej }));
      return Promise.resolve({});
    });
    render(
      <AppControllerProvider appController={fakeAppController}>
        <MemoryRouter>
          <Sampler />
        </MemoryRouter>
      </AppControllerProvider>,
    );
    act(() => {
      window.dispatchEvent(new Event("home:resample"));
    });
    await act(async () => {
      pending[0].rej(new Error("timeout"));
    });
    expect(pending.length).toBe(2); // no same-seed retry of the stale request
  });
});
