import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import routes from "src/models/Routes";

vi.mock("src/views/Matters/Matters.js", () => ({
  __esModule: true,
  default: ({ group }) => <div data-testid="matters-index">{group || "all"}</div>,
}));

const indexOf = (p) => routes.findIndex((r) => r.path === p);

describe("matters group view-all routes", () => {
  test.each([
    ["/matters/narrative", "narrative"],
    ["/matters/material", "material"],
    ["/matters/concepts", "concept"],
  ])("%s routes to the Matters index (group %s), before the slug route", async (p, group) => {
    const i = indexOf(p);
    const slug = indexOf("/matters/:matterSlug");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(slug).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(slug);

    const Component = routes[i].component;
    render(
      <React.Suspense fallback={null}>
        <Component />
      </React.Suspense>,
    );
    expect(await screen.findByTestId("matters-index")).toHaveTextContent(group);
  });
});
