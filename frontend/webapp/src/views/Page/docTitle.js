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
  stack.push({ key, title });
  apply();
}

export function popDocTitle(key) {
  removeKey(key);
  apply();
}

// Test hook only — module state must not leak between tests.
export function __resetDocTitleForTests() {
  base = "";
  stack = [];
}
