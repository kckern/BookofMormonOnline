import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { lookup } from "scripture-guide";

// Alma 17 verses 1..8 as one section; the ref is a single verse.
const v = (n) => lookup(`Alma 17:${n}`).verse_ids[0];
vi.mock("src/models/BoMOnlineAPI.js", () => ({
  __esModule: true,
  default: vi.fn(() =>
    Promise.resolve({
      read: {
        "Alma 17": {
          sections: [{
            heading: "Sons of Mosiah", ref: "Alma 17:1-8",
            blocks: [{ voice: "vox_n", lines: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ verse_id: globalThis.__v(n), verse_num: n, text: `verse ${n}` })) }],
          }],
        },
      },
    }),
  ),
  assetUrl: "https://media.test",
}));

import ScriptureExcerpt, { fillWanted } from "../ScriptureExcerpt";

beforeAll(() => { globalThis.__v = v; });

describe("fillWanted (R6 art-A1-excerpt-box)", () => {
  const order = [1, 2, 3, 4, 5, 6, 7, 8];
  test("extends a short ref forward through the chapter", () => {
    expect([...fillWanted(order, new Set([3]), 4)]).toEqual([3, 4, 5, 6]);
  });
  test("at the chapter end it reaches back instead", () => {
    expect([...fillWanted(order, new Set([8]), 3)].sort()).toEqual([6, 7, 8]);
  });
  // R7 art-H3/G2: the window stays inside the ref's own section (a second
  // section header in the clipped box was an unrelated passage and a chip that
  // could sit below the clip line, still in the Tab order).
  test("with sections known, it fills inside the anchor's section first (back, not across)", () => {
    const section = new Map([[1, 0], [2, 0], [3, 0], [4, 0], [5, 1], [6, 1], [7, 1], [8, 1]]);
    expect([...fillWanted(order, new Set([3]), 4, section)].sort()).toEqual([1, 2, 3, 4]);
  });
  test("a section shorter than min still fills (crossing only as a last resort)", () => {
    const section = new Map([[1, 0], [2, 0], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1]]);
    expect([...fillWanted(order, new Set([2]), 4, section)].sort()).toEqual([1, 2, 3, 4]);
  });
  test("a ref already long enough, or unresolved, is untouched", () => {
    const w = new Set([1, 2, 3]);
    expect(fillWanted(order, w, 3)).toBe(w);
    const none = new Set();
    expect(fillWanted(order, none, 5)).toBe(none);
  });
});

test("fillVerses: a single-verse ref renders the following verses so the box is full", async () => {
  const { container } = render(<MemoryRouter><ScriptureExcerpt refText="Alma 17:2" fillVerses={4} hideStudy /></MemoryRouter>);
  await waitFor(() => expect(container.querySelector(".read-block")).not.toBeNull());
  expect(container.textContent).toMatch(/verse 2.*verse 3.*verse 4.*verse 5/s);
  expect(container.textContent).not.toMatch(/verse 6/);
  // a plain mount of the same ref is NOT served the widened excerpt from cache
  const plain = render(<MemoryRouter><ScriptureExcerpt refText="Alma 17:2" hideStudy /></MemoryRouter>);
  await waitFor(() => expect(plain.container.querySelector(".read-block")).not.toBeNull());
  expect(plain.container.textContent).not.toMatch(/verse 3/);
});
