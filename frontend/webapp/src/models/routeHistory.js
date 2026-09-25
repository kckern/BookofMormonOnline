/**
 * URL updates the Router deliberately does NOT hear about.
 *
 * This was `createBrowserHistory()` from the `history` package — a SECOND
 * browser-history instance, separate from the one App.js handed to <Router>.
 * Pushing to it changed the address bar WITHOUT re-rendering the Router, and
 * about eleven call sites depend on precisely that: a modal or panel makes
 * itself shareable and Back-closable without the route swapping the view out
 * from under it. See entity/MaximizeButton.js and Entity/EntityPage.js, which
 * call the arrangement out by name.
 *
 * react-router 7 dropped its dependency on `history`, and BrowserRouter owns its
 * instance internally with no way to supply one. So this drives the native
 * History API directly — which is literally what the old instance did
 * underneath. Identical semantics, one fewer package.
 *
 * It is NOT a router: nothing here notifies React, which is the whole point.
 * For navigation that SHOULD change the view, use useNavigate().
 */
const toUrl = (to) =>
  typeof to === "string"
    ? to
    : `${to?.pathname || ""}${to?.search || ""}${to?.hash || ""}`;

export const history = {
  push: (to, state) => window.history.pushState(state ?? null, "", toUrl(to)),
  replace: (to, state) => window.history.replaceState(state ?? null, "", toUrl(to)),
  goBack: () => window.history.back(),
  goForward: () => window.history.forward(),
  go: (n) => window.history.go(n),
  get location() {
    return window.location;
  },
  get length() {
    return window.history.length;
  },
};

export default history;
