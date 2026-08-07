import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { RevealProvider, useReveal } from "../Reveal";

function Probe() {
  const { revealed, gated, reveal, registerGate } = useReveal();
  return (
    <div>
      <span data-testid="revealed">{revealed ? "y" : "n"}</span>
      <span data-testid="gated">{gated ? "y" : "n"}</span>
      <button onClick={reveal}>reveal</button>
      <button onClick={registerGate}>gate</button>
    </div>
  );
}

describe("Reveal", () => {
  test("starts un-revealed and un-gated inside a provider", () => {
    render(<RevealProvider><Probe /></RevealProvider>);
    expect(screen.getByTestId("revealed").textContent).toBe("n");
    expect(screen.getByTestId("gated").textContent).toBe("n");
  });

  test("registerGate() flips gated; reveal() flips revealed", () => {
    render(<RevealProvider><Probe /></RevealProvider>);
    fireEvent.click(screen.getByText("gate"));
    expect(screen.getByTestId("gated").textContent).toBe("y");
    fireEvent.click(screen.getByText("reveal"));
    expect(screen.getByTestId("revealed").textContent).toBe("y");
  });
});
