// Phone source drawer for a history doc (blind audit archive witness-D1/D5):
// it used to print the title twice, lead with a dangling "• date" when the doc
// has no source, render a broken facsimile <img> for witness rows (id NULL),
// and had no visible close control.
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import HistoryDrawer from "../HistoryDrawer";
import { historyDocTitle } from "../entity/HistoryBody";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.example",
}));

const DOC = {
  slug: "1875-04-12-john-whitmer",
  id: null,
  pages: 1,
  document: "Whitmer reaffirms his testimony to Davis.",
  teaser: "Whitmer reaffirms his testimony to Davis.",
  principal: "John Whitmer",
  date: "1875-04-12",
  transcript: "<p>Elder Joshua Davis, of Provo, called at this office.</p>",
};

describe("HistoryDrawer", () => {
  beforeEach(() => BoMOnlineAPI.mockResolvedValue({ history: { [DOC.slug]: DOC } }));

  it("shows the title once, a meta line without a dangling bullet, no broken fax and a close button", async () => {
    const onClose = vi.fn();
    const { container } = render(<HistoryDrawer slug={DOC.slug} onClose={onClose} />);
    await waitFor(() => expect(screen.getAllByText(/Elder Joshua Davis/).length).toBeGreaterThan(0));
    expect(screen.getAllByText("Whitmer reaffirms his testimony to Davis.")).toHaveLength(1);
    const meta = container.querySelector(".historyDrawerMeta").textContent;
    expect(meta).toMatch(/John Whitmer/);
    expect(meta).not.toMatch(/^\s*•/);
    expect(container.querySelector("img[src*='null']")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /close/i })[0]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("historyDocTitle", () => {
  it("omits the parenthetical when there is no source", () => {
    expect(historyDocTitle({ document: "A visit", source: undefined })).toBe("A visit");
    expect(historyDocTitle({ document: "A visit", source: "Deseret News" })).toBe("A visit (Deseret News)");
    expect(historyDocTitle(null)).toBe("");
  });
});
