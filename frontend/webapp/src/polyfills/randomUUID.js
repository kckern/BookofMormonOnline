// `crypto.randomUUID` is only defined in SECURE contexts (https or localhost).
// When the dev app is opened over a plain-http LAN origin (e.g. http://10.0.0.10:8200)
// it's undefined, and vendor libs that call it throw mid-render — which cascades
// into React "removeChild" reconciliation crashes. Polyfill it using getRandomValues
// (which IS available in insecure contexts). Imported first in index.js.
if (
  typeof window !== "undefined" &&
  window.crypto &&
  typeof window.crypto.getRandomValues === "function" &&
  typeof window.crypto.randomUUID !== "function"
) {
  window.crypto.randomUUID = function randomUUID() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (
        c ^
        (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16)
    );
  };
}
