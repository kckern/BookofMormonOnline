import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RevealProvider, useReveal } from "../Reveal";
import TileDeepLink from "../TileDeepLink";

// A Layer-1 stand-in: registers a gate on mount (like a truncated ExpandableText),
// then can fire reveal() on click.
const Gate = () => {
  const { reveal, registerGate } = useReveal();
  React.useEffect(registerGate, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <button onClick={reveal}>reveal</button>;
};

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("TileDeepLink", () => {
  test("is hidden while a gate is registered and not yet revealed", () => {
    renderIn(
      <RevealProvider>
        <Gate />
        <TileDeepLink to="/x"><span>deep</span></TileDeepLink>
      </RevealProvider>
    );
    expect(screen.queryByText("deep")).toBeNull();
    fireEvent.click(screen.getByText("reveal"));
    expect(screen.getByText("deep")).toBeInTheDocument();
  });

  test("shows immediately inside a provider when NO gate is registered (short prose)", () => {
    renderIn(
      <RevealProvider>
        <TileDeepLink to="/x"><span>deep</span></TileDeepLink>
      </RevealProvider>
    );
    expect(screen.getByText("deep")).toBeInTheDocument();
  });

  test("`always` shows even with a gate registered", () => {
    renderIn(
      <RevealProvider>
        <Gate />
        <TileDeepLink to="/x" always><span>deep</span></TileDeepLink>
      </RevealProvider>
    );
    expect(screen.getByText("deep")).toBeInTheDocument();
  });

  test("with no provider it is visible (safe default)", () => {
    renderIn(<TileDeepLink to="/x"><span>deep</span></TileDeepLink>);
    const link = screen.getByRole("link");
    expect(within(link).getByText("deep")).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/x");
  });
});
