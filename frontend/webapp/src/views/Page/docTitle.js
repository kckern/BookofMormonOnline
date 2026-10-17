// Single owner of document.title for the Page view (audit 2026-07-14 §4.4).
// The page sets a BASE title; open rows/panels PUSH keyed entries and POP them
// on close, so closing anything restores what was underneath — the old code
// had 7 independent writers and no restore, leaving stale titles behind.
let base = "";
let stack = []; // [{ key, title }] — top of stack wins

function apply() {
  document.title = stack.length ? stack[stack.length - 1].title : base;
}

function removeKey(key) {
  const i = stack.findIndex((e) => e.key === key);
  if (i >= 0) stack.splice(i, 1);
}

export function setBaseDocTitle(title) {
  base = title || "";
  apply();
}

export function pushDocTitle(key, title) {
  removeKey(key);
  stack.push({ key, title: title || "" });
  apply();
}

export function popDocTitle(key) {
  removeKey(key);
  apply();
}

/**
 * Drop every pushed entry WITHOUT re-applying. Page calls this on unmount: rows
 * left open on the page you navigated away from must not resurface as the tab
 * title of the next page (blind audit r4 commentary D4 — a /commentary/:id
 * arrival kept "3 Nephi 19:10–11 | …" from the previous visit).
 */
export function resetDocTitleStack() {
  stack = [];
}

// Test hook only — module state must not leak between tests.
export function __resetDocTitleForTests() {
  base = "";
  stack = [];
}
