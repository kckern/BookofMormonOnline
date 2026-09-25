import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import MaximizeButton from "../MaximizeButton";

const fixture = () => ({
  states: { popUp: { open: true, type: "people", ids: ["noah2"], activeId: "noah2" } },
  preLoad: {},
  popUpData: {},
  functions: { setPopUp: vi.fn(), closePopUp: vi.fn() },
});

const renderAt = (type, path, appController) => {
  const history = createMemoryHistory({ initialEntries: [path] });
  vi.spyOn(history, "replace");
  vi.spyOn(history, "push");
  // The component reads window.location, because the address bar (written by
  // the OTHER history instance) is the source of truth for the entity URL.
  window.history.replaceState({}, "", path);
  render(
    <AppControllerProvider appController={appController}>
      <Router history={history}>
        <MaximizeButton type={type} />
      </Router>
    </AppControllerProvider>,
  );
  return history;
};

describe("MaximizeButton", () => {
  test("promotes the modal to the page without changing the URL", () => {
    const app = fixture();
    const history = renderAt("people", "/people/noah2", app);
    fireEvent.click(screen.getByTitle(/full page/i));
    // replace, not push: same URL, no new history entry.
    expect(history.replace).toHaveBeenCalledWith("/people/noah2");
    expect(history.push).not.toHaveBeenCalled();
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
