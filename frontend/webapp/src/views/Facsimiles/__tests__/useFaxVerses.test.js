import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { lookupReference } from "scripture-guide";
import { useFaxVerses } from "../useFaxVerses";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({ read: { "Alma 5": { sections: [] } } })),
  renderBaseUrl: "",
}));

function Probe({ left, right }) {
  const { versesByPage, pageScale } = useFaxVerses("1830", left, right);
  const verses = versesByPage.get(10) || [];
  return <div data-testid="out">{`scale=${pageScale};page10=${verses.length}`}</div>;
}

describe("useFaxVerses", () => {
  afterEach(() => { jest.clearAllMocks(); delete global.fetch; });

  test("chunks >40 ids into multiple /fax/boxes calls and hydrates versesByPage", async () => {
    const firstId = lookupReference("Alma 5:1").verse_ids[0];
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        pageScale: 700,
        boxes: [{ verseId: firstId, imagePage: 10, x: 1, y: 2, w: 3, h: 4 }],
      }),
    }));

    render(<Probe left={{ pageReference: "Alma 5:1-41" }} right={null} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    const urls = global.fetch.mock.calls.map((c) => c[0]);
    expect(urls[0]).toContain("/fax/boxes/1830/ids/");
    await waitFor(() => expect(screen.getByTestId("out").textContent).toBe("scale=700;page10=1"));
  });

  test("no version or no ids -> empty state, no fetch", async () => {
    global.fetch = jest.fn();
    render(<Probe left={null} right={null} />);
    await waitFor(() => expect(screen.getByTestId("out").textContent).toBe("scale=700;page10=0"));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
