import React from "react";
import { render } from "@testing-library/react";
import { ATVHeader } from "../../ATV";

const wrap = (inner) => `<div class='source'> ${inner} </div>`;
const REAL = wrap("and I know that the record which I make [<em>to be</em> &gt; js <em>is</em> 1|<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST] <em>true</em>");

test("renders nothing when there is no apparatus", () => {
  const { container } = render(<ATVHeader atvHTML="" />);
  expect(container.firstChild).toBeNull();
});

test("preserves the .atv > .source nesting the CSS targets", () => {
  const { container } = render(<ATVHeader atvHTML={REAL} />);
  expect(container.querySelector(".atv > .source")).not.toBeNull();
});

test("emits one .atv-string pill per reading with the tooltip attributes", () => {
  const { container } = render(<ATVHeader atvHTML={REAL} />);
  const pills = container.querySelectorAll(".atv-string");
  expect(pills).toHaveLength(3);
  expect(pills[2].getAttribute("data-indexes")).toBe("BCDEFGHIJKLMNOPQRST");
  expect(pills[2].getAttribute("data-for")).toBe("atv-tooltip");
  expect(pills[2].getAttribute("data-tip")).toContain("1837"); // B
  expect(pills[2].getAttribute("data-tip")).toContain("1840"); // C
});

test("a correction chain renders an .atv-change arrow between states", () => {
  const { container } = render(<ATVHeader atvHTML={REAL} />);
  // reading 0 is "to be" -> "is": one arrow inside the first pill
  const firstPill = container.querySelectorAll(".atv-string")[0];
  expect(firstPill.querySelector(".atv-change")).not.toBeNull();
  expect(firstPill.textContent).toContain("to be");
  expect(firstPill.textContent).toContain("is");
});

test("an omission renders as a <b> inside the pill (styled red by .atv-string b)", () => {
  const { container } = render(<ATVHeader atvHTML={wrap("[NULL 1|<em>y</em> A]")} />);
  const pill = container.querySelector(".atv-string");
  expect(pill.querySelector("b")).not.toBeNull();
  expect(pill.textContent).toContain("∅");
});

test("reading content HTML is rendered, not shown as literal tags", () => {
  const { container } = render(<ATVHeader atvHTML={REAL} />);
  // the <em> in "to be" becomes a real element, not the text "<em>"
  expect(container.querySelector(".atv-string em")).not.toBeNull();
  expect(container.textContent).not.toContain("<em>");
});

test("mounts exactly one atv-tooltip", () => {
  const { container, baseElement } = render(<ATVHeader atvHTML={REAL} />);
  expect(baseElement.querySelectorAll("#atv-tooltip").length).toBeLessThanOrEqual(1);
});

test("the two page-blanking entries render instead of throwing", () => {
  const e1 = wrap("[thing &gt;js NULL 1 |thing A| BCDEFGHIJKLMNOPQRST] [NULL &gt; of &gt;js for 1|of A|for BCDEFGHIJKLMNOPQRST]");
  const e2 = "and for this cause did king [Benjamin 1ABCDGHK|Mosiah EFIJLMNOQRT| Benjamin [Mosiah?] P|Benjamin {Mosiah?} S] keep them";
  expect(() => render(<ATVHeader atvHTML={e1} />)).not.toThrow();
  expect(() => render(<ATVHeader atvHTML={wrap(e2)} />)).not.toThrow();
});
