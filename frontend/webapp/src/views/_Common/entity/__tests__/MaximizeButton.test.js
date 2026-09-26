import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import MaximizeButton from "../MaximizeButton";

const fixture = () => ({
  states: { popUp: { open: true, type: "people", ids: ["noah2"], activeId: "noah2" } },
  preLoad: {},
  popUpData: {},
  functions: { setPopUp: vi.fn(), closePopUp: vi.fn() },
});

// react-router 7 owns its history, so these tests can no longer spy on a
// history object. useNavigationType() reports PUSH vs REPLACE directly, which is
// what the old `expect(history.replace).toHaveBeenCalledWith(...)` was really
// checking — and it also verifies the resulting URL rather than the call.
function NavProbe({ sink }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  sink.location = location;
  if (sink.lastKey !== location.key) {
    sink.lastKey = location.key;
    sink.types.push(navigationType);
  }
  return null;
}

const renderAt = (type, path, appController) => {
  const sink = { lastKey: null, types: [] };
  // The component reads window.location, because the address bar (written by
  // the OTHER history instance) is the source of truth for the entity URL.
  window.history.replaceState({}, "", path);
  render(
    <AppControllerProvider appController={appController}>
      <MemoryRouter initialEntries={[path]}>
        <MaximizeButton type={type} />
        <NavProbe sink={sink} />
      </MemoryRouter>
    </AppControllerProvider>,
  );
  return {
    get location() { return sink.location; },
    get types() { return sink.types; },
  };
};

describe("MaximizeButton", () => {
  test("promotes the modal to the page without changing the URL", () => {
    const app = fixture();
    const history = renderAt("people", "/people/noah2", app);
    fireEvent.click(screen.getByTitle(/full page/i));
    // replace, not push: same URL, no new history entry.
    expect(history.location.pathname).toBe("/people/noah2");
    expect(history.types).not.toContain("PUSH");
    // keepSlug, or closePopUp's setSlug(underSlug) would rewrite the URL to the index.
    expect(app.functions.closePopUp).toHaveBeenCalledWith({ keepSlug: true });
  });

  test.each(["people", "places", "place", "matters", "history"])("renders for %s", (type) => {
    renderAt(type, `/${type}/x`, fixture());
    expect(screen.getByTitle(/full page/i)).toBeInTheDocument();
  });

  test.each(["commentary", "victory"])("renders nothing for %s", (type) => {
    renderAt(type, "/commentary/1", fixture());
    expect(screen.queryByTitle(/full page/i)).toBeNull();
  });
});
