// Campaign arbiter for all programmatic scrolling (see Task 2 for the rest).

// Tiny abort token (CRA's jest/jsdom predates AbortController; this also
// gives us abort *reasons* without polyfills).
export function createAbortToken() {
  const listeners = new Set();
  const token = {
    aborted: false,
    reason: null,
    abort(reason = "aborted") {
      if (token.aborted) return;
      token.aborted = true;
      token.reason = reason;
      listeners.forEach((fn) => fn());
      listeners.clear();
    },
    onAbort(fn) {
      if (token.aborted) {
        fn();
        return () => {};
      }
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return token;
}
