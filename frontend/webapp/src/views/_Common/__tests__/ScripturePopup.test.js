import React from "react";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import ScripturePopup, { openScripture } from "../ScripturePopup";
// Real `read` query responses captured from :8201/graphql/en (trimmed to the
// sections these refs touch). Helaman 1:1 and Alma 6:8 come back from the API
// with an exact duplicate line — the bug these tests pin.
import READ from "../__fixtures__/readChapters";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.bookofmormon.online",
}));

beforeEach(() => {
  BoMOnlineAPI.mockReset();
  BoMOnlineAPI.mockImplementation((q) => {
    if (q.read) {
      const ch = q.read[0];
      return Promise.resolve({ read: READ[ch] ? { [ch]: READ[ch] } : {} });
    }
    return Promise.resolve({ scripture: {} });
  });
});

afterEach(() => {
  document.body.classList.remove("noscroll");
  document.documentElement.style.overflow = "";
});

const setup = () =>
  render(
    <MemoryRouter>
      <button type="button">opener</button>
      <ScripturePopup />
    </MemoryRouter>
  );

const open = async (ref) => {
  act(() => openScripture(ref));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(dialog.querySelector(".read-scripture")).not.toBeNull());
  return dialog;
};

// How many times a verse's text (a distinctive prefix) occurs in the dialog.
const occurrences = (dialog, prefix) =>
  dialog.textContent.split(prefix).length - 1;
const verseSups = (dialog, n) =>
  Array.from(dialog.querySelectorAll(".read-scripture sup")).filter((s) => s.textContent === String(n)).length;

test("Helaman 1:1-4 renders verse 1 exactly once (superscription is not a second copy)", async () => {
  setup();
  const dialog = await open("Helaman 1:1-4");
  expect(occurrences(dialog, "And now behold, it came to pass in the commencement")).toBe(1);
  expect(verseSups(dialog, 1)).toBe(1);
  // the superscription itself still renders, as a heading line
  expect(dialog.textContent).toContain("THE BOOK OF HELAMAN");
  for (const n of [2, 3, 4]) expect(verseSups(dialog, n)).toBe(1);
  expect(verseSups(dialog, 5)).toBe(0);
});

test("a comma multi-range ref (Alma 32:21, 27) renders both verses and repeats none", async () => {
  setup();
  const dialog = await open("Alma 32:21, 27");
  expect(verseSups(dialog, 21)).toBe(1);
  expect(verseSups(dialog, 27)).toBe(1);
  expect(dialog.querySelectorAll(".read-scripture sup")).toHaveLength(2);
  // one chapter → one section heading, not the same section twice
  expect(dialog.querySelectorAll(".read-section")).toHaveLength(1);
});

test("a cross-chapter ref (Alma 6:7-8; 7:1) keeps the second chapter and repeats no verse", async () => {
  setup();
  const dialog = await open("Alma 6:7-8; 7:1");
  await waitFor(() => expect(verseSups(dialog, 1)).toBe(1)); // Alma 7:1 present
  expect(verseSups(dialog, 7)).toBe(1);
  expect(verseSups(dialog, 8)).toBe(1);
  expect(occurrences(dialog, "And Alma went and began to declare the word of God")).toBe(1);
});

test("dialog semantics: aria-modal, labelled by its title, focus in, Esc restores focus", async () => {
  setup();
  const opener = screen.getByText("opener");
  opener.focus();
  const dialog = await open("Helaman 1:1-4");
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  const labelId = dialog.getAttribute("aria-labelledby");
  expect(labelId).toBeTruthy();
  expect(document.getElementById(labelId).textContent).toBe("Helaman 1:1–4");
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  expect(document.documentElement.style.overflow).toBe("hidden");

  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(opener);
  expect(document.documentElement.style.overflow).toBe("");
});

test("Tab is trapped inside the dialog: Shift+Tab on first wraps to last, Tab on last wraps to first", async () => {
  // jsdom has no layout, so offsetParent is always null and useModalA11y's
  // visibility filter would see only the active element — making any trap
  // assertion vacuous. Give every attached element a non-null offsetParent.
  const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() { return this.isConnected ? this.parentNode : null; },
  });
  try {
    setup();
    const dialog = await open("Helaman 1:1-4");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    // the Read CTA appears once the fetch confirms BoM content
    const readLink = await waitFor(() => {
      const a = dialog.querySelector("a.samplerScriptureReadLink");
      expect(a).not.toBeNull();
      return a;
    });
    const focusable = Array.from(
      dialog.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')
    );
    expect(focusable.length).toBeGreaterThan(1);
    const close = within(dialog).getByRole("button", { name: /close/i });
    const last = focusable[focusable.length - 1];
    expect(focusable[0]).toBe(close);
    expect(last).not.toBe(close);
    expect(focusable).toContain(readLink);

    close.focus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(close);
  } finally {
    if (desc) Object.defineProperty(HTMLElement.prototype, "offsetParent", desc);
    else delete HTMLElement.prototype.offsetParent;
  }
});

test("backdrop click closes; phone width renders the same dialog (bottom sheet), not a side drawer", async () => {
  const prev = window.innerWidth;
  window.innerWidth = 390;
  try {
    setup();
    const dialog = await open("Helaman 1:1-4");
    expect(dialog.classList.contains("samplerScriptureCard")).toBe(true);
    expect(document.querySelector(".scripturePopupDrawer")).toBeNull();
    fireEvent.click(dialog.parentElement); // the shaded backdrop
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // a click inside the card does not close
    await open("Helaman 1:1-4");
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.click(screen.getByRole("dialog").parentElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  } finally {
    window.innerWidth = prev;
  }
});

test("scroll lock keeps the reader's place: body is not clipped and scrollY is restored (audit E3)", async () => {
  setup();
  const spy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 1700 });
  const dialog = await open("Helaman 1:1-4");
  // body.noscroll on a height:100% body clips the page to one viewport and
  // throws the reader to scrollY 0 — only the root scroller is locked now
  expect(document.body.classList.contains("noscroll")).toBe(false);
  expect(document.documentElement.style.overflow).toBe("hidden");
  window.scrollY = 0; // something moved the page while open
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(spy).toHaveBeenCalledWith(0, 1700);
  spy.mockRestore();
  delete window.scrollY;
});

test("popup title uses the same en-dash range as the pill that opened it (audit A7)", async () => {
  setup();
  const dialog = await open("Helaman 1:1-4");
  const title = dialog.querySelector(".samplerScriptureHead b");
  expect(title.textContent).toBe("Helaman 1:1–4");
});

describe("scroll place across open/close (audit xc-popup-E3)", () => {
  let y;
  let scrollTo;
  let scrollBy;
  beforeEach(() => {
    y = 942;
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => y });
    scrollTo = vi.spyOn(window, "scrollTo").mockImplementation((_x, ny) => { y = ny; });
    scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(({ top }) => { y += top; });
  });
  afterEach(() => {
    scrollTo.mockRestore();
    scrollBy.mockRestore();
    delete window.scrollY;
  });

  test("a jump between the click and the mount is undone: the place is taken at the click", async () => {
    setup();
    // the jump lands synchronously right after the open event, before effects
    act(() => {
      openScripture("Helaman 1:1-4");
      y = 111;
    });
    await screen.findByRole("dialog");
    expect(y).toBe(942);
    fireEvent.keyDown(document.activeElement, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(y).toBe(942);
  });

  test("a layout jump while open is reverted, and close keeps the opener where it was on screen", async () => {
    setup();
    const opener = screen.getByText("opener");
    let top = 300;
    opener.getBoundingClientRect = () => ({ top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20 });
    act(() => openScripture("Helaman 1:1-4", { opener }));
    await screen.findByRole("dialog");
    act(() => {
      y = 4882;
      window.dispatchEvent(new Event("scroll"));
    });
    expect(y).toBe(942);
    // content above the opener grew by 40px meanwhile: close keeps the opener at 300
    top = 340;
    fireEvent.keyDown(document.activeElement, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(y).toBe(982);
  });
});

// blind audit R5 faxVerse-H2: a tile's section chip ("Jacob 6") opened the
// popup at v.1 with the tile's verse below the card's fold. An open carrying
// `focus` scrolls the popup body to that verse and marks it.
test("an open with a focus verse scrolls the body to it and marks it", async () => {
  const { lookup } = await import("scripture-guide");
  const id = lookup("Helaman 1:3").verse_ids[0];
  setup();
  const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function () {
    const top = this.classList?.contains(`verse_${id}`) ? 500 : this.classList?.contains("samplerScriptureBody") ? 100 : 0;
    return { top, bottom: top + 20, left: 0, right: 100, width: 100, height: 20, x: 0, y: top };
  });
  act(() => window.dispatchEvent(new CustomEvent("samplerScripture", { detail: { ref: "Helaman 1", focus: id } })));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(dialog.querySelector(`.verse_${id}`)).not.toBeNull());
  const body = dialog.querySelector(".samplerScriptureBody");
  await waitFor(() => expect(body.scrollTop).toBe(400 - 12));
  expect(dialog.querySelector(`.verse_${id}`).classList.contains("samplerScriptureFocus")).toBe(true);
  rect.mockRestore();
});

// R7 art-D5: landing on the focus verse LINE cut the speaker's face off above
// the sheet and left a bare voice label floating; land on the verse's block
// (face included) when that keeps the verse in the upper half of the body.
import { focusLandingDelta } from "../ScripturePopup";
describe("focusLandingDelta", () => {
  test("lands on the block top (face included) when the verse is near it", () => {
    expect(focusLandingDelta({ verseTop: 300, blockTop: 240, bodyTop: 100, bodyHeight: 600 })).toBe(240 - 100 - 12);
  });
  test("a verse deep in a long block lands on the verse line", () => {
    expect(focusLandingDelta({ verseTop: 900, blockTop: 200, bodyTop: 100, bodyHeight: 600 })).toBe(900 - 100 - 12);
  });
  test("no block: the verse line", () => {
    expect(focusLandingDelta({ verseTop: 300, blockTop: null, bodyTop: 100, bodyHeight: 600 })).toBe(188);
  });
});
