import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { RevealProvider, useReveal } from "../_ds/Reveal";
import ExpandableText from "../ExpandableText";

// Force truncation: jsdom reports 0 for scrollHeight/clientHeight, so stub them
// so ExpandableText's "overflowing" check is true and the read-more renders.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
});

const RevealState = () => {
  const { revealed } = useReveal();
  return <span data-testid="revealed">{revealed ? "yes" : "no"}</span>;
};

test("expanding fires reveal() so a sibling Layer-2 can appear", () => {
  render(
    <RevealProvider>
      <RevealState />
      <ExpandableText lines={2}>
        <span>lots of text that overflows the clamp box</span>
      </ExpandableText>
    </RevealProvider>
  );
  expect(screen.getByTestId("revealed").textContent).toBe("no");
  fireEvent.click(screen.getByRole("button")); // the read-more pill
  expect(screen.getByTestId("revealed").textContent).toBe("yes");
});
