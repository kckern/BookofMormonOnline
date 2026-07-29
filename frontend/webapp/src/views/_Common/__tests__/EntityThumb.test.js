import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import EntityThumb from "../EntityThumb";

jest.mock("src/models/BoMOnlineAPI", () => ({ assetUrl: "https://cdn.test" }));

describe("EntityThumb", () => {
  test("renders an img pointing at the asset path for its type", () => {
    render(<EntityThumb type="matters" slug="swords" name="Swords" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://cdn.test/matters/swords");
  });

  test("on error it swaps to a gradient placeholder carrying the initials", () => {
    render(<EntityThumb type="matters" slug="swords" name="Sword of Laban" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("SO")).toBeInTheDocument();
  });

  test("the placeholder gradient is stable for a given slug", () => {
    const { container: a } = render(<EntityThumb type="matters" slug="swords" name="Swords" />);
    fireEvent.error(a.querySelector("img"));
    const { container: b } = render(<EntityThumb type="matters" slug="swords" name="Swords" />);
    fireEvent.error(b.querySelector("img"));
    expect(a.querySelector(".entityThumb").style.background)
      .toBe(b.querySelector(".entityThumb").style.background);
  });

  test("a one-word name yields two letters, not one", () => {
    render(<EntityThumb type="people" slug="nephi" name="Nephi" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("NE")).toBeInTheDocument();
  });
});
