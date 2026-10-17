import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { lookup } from "scripture-guide";

const ids = lookup("Alma 17:7").verse_ids;
vi.mock("src/models/BoMOnlineAPI.js", () => ({
  __esModule: true,
  default: vi.fn(() =>
    Promise.resolve({
      read: {
        "Alma 17": {
          sections: [
            {
              heading: "Ammon Sets Out",
              ref: "Alma 17:7",
              blocks: [{ voice: "vox_mormon", person_slug: "mormon2", lines: [{ verse_id: globalThis.__vid, text: "they took their swords" }] }],
            },
          ],
        },
      },
    }),
  ),
  assetUrl: "https://media.test",
}));

import ScriptureExcerpt from "../ScriptureExcerpt";

describe("ScriptureExcerpt inside a tile (refAsPopup)", () => {
  beforeAll(() => { globalThis.__vid = ids[0]; });

  test("section ref is a native button.scripture_link that opens the popup (audit G1)", async () => {
    const seen = [];
    const on = (e) => seen.push(e.detail);
    window.addEventListener("samplerScripture", on);
    const { container } = render(<MemoryRouter><ScriptureExcerpt refText="Alma 17:7" refAsPopup hideStudy /></MemoryRouter>);
    await waitFor(() => expect(container.querySelector(".scripture_link")).not.toBeNull());
    const chip = container.querySelector(".scripture_link");
    expect(chip.tagName).toBe("BUTTON");
    expect(chip.getAttribute("type")).toBe("button");
    chip.click();
    expect(seen).toEqual(["Alma 17:7"]);
    window.removeEventListener("samplerScripture", on);
  });

  test("gutter portrait is decorative: no raw vox_* label key as alt (audit G3)", async () => {
    const { container } = render(<MemoryRouter><ScriptureExcerpt refText="Alma 17:7" refAsPopup hideStudy /></MemoryRouter>);
    await waitFor(() => expect(container.querySelector(".left-gutter img")).not.toBeNull());
    expect(container.querySelector(".left-gutter img").getAttribute("alt")).toBe("");
  });

  // blind audit r4 refpill-popup G1: a <button> nested in the section <a> is
  // invalid interactive nesting and a second tab stop for the same target.
  test("the Study label inside the section link is not a nested button", async () => {
    const { container } = render(<MemoryRouter><ScriptureExcerpt refText="Alma 17:7" /></MemoryRouter>);
    await waitFor(() => expect(container.querySelector(".read-section-header a")).not.toBeNull());
    const a = container.querySelector(".read-section-header a");
    expect(a.querySelector("button, a, [tabindex]")).toBeNull();
    expect(a.querySelector(".btn")).not.toBeNull();
  });
});
