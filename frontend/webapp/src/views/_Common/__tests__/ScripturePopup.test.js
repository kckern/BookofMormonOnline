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
  expect(document.getElementById(labelId).textContent).toBe("Helaman 1:1-4");
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
