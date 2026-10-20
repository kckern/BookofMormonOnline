import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AppControllerProvider } from "src/contexts/AppControllerContext";

vi.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: vi.fn(), assetUrl: "https://media.test" }));
vi.mock("../User", () => ({ ProfileItems: () => null }));
vi.mock("../Preferences", () => ({ default: () => null }));
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { MobileProgressBox } from "../MobileUser";

// A guest (no token) on a phone opening Sign in / Profile: userprogress has no
// row for the null token, and division rows may carry no progress. The box must
// render 0% instead of throwing — the throw unmounted the whole app (blind R9 P0).
const guest = { states: { user: { token: null, user: null, social: null } }, preLoad: { divisionShell: [] }, functions: { setPopUp: vi.fn() } };

test("renders for a guest whose progress row is missing", async () => {
  BoMOnlineAPI.mockResolvedValue({
    userprogress: {},
    divisionProgress: [{ slug: "lehites", title: "Lehites", progress: null }, { slug: "war", title: "War", progress: { completed: 40 } }],
  });
  render(
    <AppControllerProvider appController={guest}>
      <MobileProgressBox />
    </AppControllerProvider>,
  );
  await waitFor(() => expect(screen.getByText("Lehites")).toBeTruthy());
  expect(screen.getByText("War")).toBeTruthy();
});
