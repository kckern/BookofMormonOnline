import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { generateReference } from "scripture-guide";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import BiblePhrasesTile, { markShared, candidatePairs, pairPath } from "../BiblePhrasesTile";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.test",
}));
vi.mock("../ScripturePopup", () => ({ openScripture: vi.fn() }));

// A <mark> element vs a plain string: React elements are objects with a `type`.
const isMark = (node) => React.isValidElement(node) && node.type === "mark";
const markedText = (nodes) =>
  nodes.filter(isMark).map((n) => n.props.children).join("|");

describe("markShared", () => {
  test("marks a 4+ word verbatim run in both passages", () => {
    const [a, b] = markShared(
      "and it came to pass that Nephi went up",
      "and it came to pass that Lehi departed"
    );
    // the shared opening clause is >= 4 words → marked on both sides
    expect(markedText(a).toLowerCase()).toContain("and it came to pass");
    expect(markedText(b).toLowerCase()).toContain("and it came to pass");
  });

  test("does not mark an overlap shorter than four words", () => {
    const [a] = markShared("the ark of God", "the temple of Solomon");
    // only "the" (and "of") overlap — never a 4-word run → nothing marked
    expect(a.some(isMark)).toBe(false);
  });

  test("preserves the original casing of the marked fragment", () => {
    const [a] = markShared(
      "And It Came To Pass that they journeyed",
      "and it came to pass that they rested"
    );
    // matching is case-insensitive but the emitted text keeps side A's casing
    expect(markedText(a)).toMatch(/And It Came To Pass/);
  });

  test("returns two node arrays even when nothing is shared", () => {
    const result = markShared("alpha beta", "gamma delta");
    expect(Array.isArray(result[0])).toBe(true);
    expect(Array.isArray(result[1])).toBe(true);
  });

  // H3: highlights split words ('un[to him that knocketh]', '[for the]m') and
  // swallowed leading punctuation ('[, my God, and the rock…]').
  test("marks start and end on word boundaries, never mid-word", () => {
    const [a, b] = markShared(
      "and unto him that knocketh it shall be opened unto them",
      "and to him that knocketh it shall be opened for them"
    );
    for (const side of [a, b]) {
      const marks = side.filter(isMark).map((n) => n.props.children);
      expect(marks.length).toBeGreaterThan(0);
      for (const m of marks) expect(m).toMatch(/^[A-Za-z].*[A-Za-z]$/);
    }
    expect(markedText(a)).toBe("him that knocketh it shall be opened");
  });

  test("a mark never starts on punctuation", () => {
    const [a] = markShared("O Lord, my God, and the rock of my salvation", "my God, and the rock of my strength");
    const m = a.filter(isMark).map((n) => n.props.children);
    expect(m[0]).toBe("my God, and the rock of my");
  });
});

describe("pairing helpers", () => {
  test("candidatePairs: a spread of distinct pairs per seed, different across seeds", () => {
    const a = candidatePairs(3);
    expect(a.length).toBeGreaterThanOrEqual(5);
    expect(new Set(a.map(String)).size).toBe(a.length);
    expect(candidatePairs(4).map(String)).not.toEqual(a.map(String));
  });

  // D4: the deeplink must land on the sampled pair, not the whole book grid;
  // L2: the slug comes from verse ids, not the localized reference.
  test("pairPath deep-links to the pair's two chapters by English slug", () => {
    // Alma 26:12 ↔ Philippians 4:13
    expect(pairPath(34356, 29456)).toBe("/analysis/bible/bom/alma/26~philippians?bch=4");
  });
});

// ---------------------------------------------------------------------------
// The tile: one request for all candidates; empty/minimal payloads collapse.

const VERSE_TEXT = {};
const versesFor = (ids) => Object.fromEntries(ids.map((id) => [id, { verse_id: id, text: VERSE_TEXT[id] || `verse number ${id} text` }]));

const renderTile = (seed = 3) =>
  render(
    <MemoryRouter>
      <BiblePhrasesTile seed={seed} />
    </MemoryRouter>
  );

describe("BiblePhrasesTile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(VERSE_TEXT)) delete VERSE_TEXT[k];
  });

  const respond = (hlFor) =>
    BoMOnlineAPI.mockImplementation(async ({ verses, versehighlights }) => ({
      verses: versesFor(verses || []),
      versehighlights: Object.fromEntries(
        (versehighlights || [])
          .map(([b, k], i) => [`${b},${k}`, hlFor(i, b, k)])
          .filter(([, v]) => v),
      ),
    }));

  test("fetches every candidate pair in ONE request (not a 10-call walk)", async () => {
    respond(() => null);
    renderTile();
    await waitFor(() => expect(BoMOnlineAPI).toHaveBeenCalled());
    expect(BoMOnlineAPI).toHaveBeenCalledTimes(1);
    const arg = BoMOnlineAPI.mock.calls[0][0];
    expect(arg.versehighlights.length).toBe(candidatePairs(3).length);
  });

  test("shows a sized skeleton while loading, never a 2px null shell", () => {
    BoMOnlineAPI.mockImplementation(() => new Promise(() => {}));
    const { container } = renderTile();
    const inner = container.querySelector(".biblePhrasesTile");
    expect(inner).not.toBeNull();
    expect(inner.getAttribute("aria-busy")).toBe("true");
    expect(inner.style.minHeight).toMatch(/px|rem/);
  });

  test("falls back to the next pair when the first shares no phrase", async () => {
    const cands = candidatePairs(3);
    const [b1, k1] = cands[1];
    VERSE_TEXT[b1] = "and behold the Lord God spake unto them saying";
    VERSE_TEXT[k1] = "then the Lord God spake unto Moses saying";
    respond((i) => (i === 1 ? { bom_highlight: ["the Lord God spake unto"], bible_highlight: ["the lord god spake unto"] } : null));
    renderTile();
    await screen.findAllByText("the Lord God spake unto", { selector: "mark" });
    expect(screen.getAllByText("the Lord God spake unto", { selector: "mark" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: generateReference([b1], "en") })).toBeTruthy();
  });

  test("falls back to the best 3-word partial when no pair reaches four", async () => {
    const cands = candidatePairs(3);
    const [b2, k2] = cands[2];
    VERSE_TEXT[b2] = "we did go into the wilderness of Hermounts";
    VERSE_TEXT[k2] = "he fled into the wilderness of Paran";
    respond(() => null);
    renderTile();
    const mark = await screen.findAllByText(/into the wilderness of/, { selector: "mark" });
    expect(mark).toHaveLength(2);
  });

  test("collapses fully (no shell) when no candidate shares a phrase", async () => {
    respond(() => null);
    const { container } = renderTile();
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  test("collapses when the fetch fails", async () => {
    BoMOnlineAPI.mockRejectedValue(new Error("network"));
    const { container } = renderTile();
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  test("CTA uses the 'See in context' verb into the pair's chapter grid; heading → index; pills outside links", async () => {
    const [b0, k0] = candidatePairs(3)[0];
    VERSE_TEXT[b0] = "for behold I say unto you that ye must repent";
    VERSE_TEXT[k0] = "verily I say unto you that ye must be born";
    respond((i) => (i === 0 ? { bom_highlight: ["I say unto you that ye must"], bible_highlight: ["I say unto you that ye must"] } : null));
    const { container } = renderTile();
    const cta = await screen.findByRole("link", { name: "See in context" });
    expect(cta.getAttribute("href")).toBe(pairPath(b0, k0));
    const links = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toContain("/analysis/bible");
    expect(container.querySelectorAll("a button, a .scripture_link")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/undefined|NaN/);
  });
});
