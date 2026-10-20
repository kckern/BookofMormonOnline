import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { lookup } from "scripture-guide";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";

const ids = lookup("Jacob 6:10").verse_ids;
vi.mock("src/models/BoMOnlineAPI.js", () => ({
  __esModule: true,
  default: vi.fn(() =>
    Promise.resolve({
      read: {
        "Jacob 6": {
          sections: [
            {
              heading: "Jacob Bids Farewell",
              ref: "Jacob 6",
              blocks: [
                { voice: "vox_jacob", person_slug: "jacob2", lines: [{ verse_id: globalThis.__vid, verse_num: 10, text: "But thus saith the Lord," }] },
                { voice: "vox_lord", person_slug: "lord", lines: [{ verse_id: globalThis.__vid, verse_num: 10, text: "even the captives" }] },
              ],
            },
          ],
        },
      },
    }),
  ),
  assetUrl: "https://media.test",
}));

import ScriptureExcerpt from "../ScriptureExcerpt";

const mount = () => render(<MemoryRouter><ScriptureExcerpt refText="Jacob 6:10" refAsPopup hideStudy /></MemoryRouter>);

describe("ScriptureExcerpt (blind audit R5, faxVerse)", () => {
  beforeAll(() => { globalThis.__vid = ids[0]; });

  test("A7: a verse split across speaker blocks is numbered once", async () => {
    const { container } = mount();
    await waitFor(() => expect(container.querySelectorAll(".read-block")).toHaveLength(2));
    expect(container.querySelectorAll("sup")).toHaveLength(1);
  });

  test("H2: the section chip opens the popup focused on the excerpt's verse", async () => {
    const seen = [];
    const on = (e) => seen.push(e.detail);
    window.addEventListener("samplerScripture", on);
    const { container } = mount();
    await waitFor(() => expect(container.querySelector(".scripture_link")).not.toBeNull());
    container.querySelector(".scripture_link").click();
    window.removeEventListener("samplerScripture", on);
    expect(seen).toEqual([{ ref: "Jacob 6", focus: ids[0] }]);
  });

  test("B1: a remount (Back) paints the passage at once from this session's fetch", async () => {
    const first = mount();
    await waitFor(() => expect(first.container.querySelector(".read-block")).not.toBeNull());
    first.unmount();
    const calls = BoMOnlineAPI.mock.calls.length;
    const again = mount();
    expect(again.container.querySelector(".isLoading")).toBeNull();
    expect(again.container.querySelector(".read-block")).not.toBeNull();
    expect(BoMOnlineAPI.mock.calls.length).toBe(calls);
  });
});
