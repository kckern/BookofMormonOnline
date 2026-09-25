/**
 * Random hex id generator.
 *
 * Replaces `crypto-browserify`, which was the ONLY thing in this app requiring
 * Node polyfills (it drags in Buffer, process.nextTick and readable-stream).
 * Webpack 5 shimmed those; a modern bundler does not, so removing it clears the
 * way off react-scripts. See docs/specs/2026-09-24-react-18-upgrade.md and the
 * CRA→Vite migration notes.
 *
 * Every call site did one of two things:
 *   md5(randomBytes(20).toString("hex")).digest("hex")  -> 32 hex chars
 *   randomBytes(20).toString("hex")                     -> 40 hex chars
 *
 * Hashing random bytes adds nothing over emitting random bytes directly, so
 * these are equivalent: randomHex(16) and randomHex(20) respectively. The values
 * are opaque identifiers — device tokens, thread/tooltip ids, a group url slug —
 * never secrets or signatures, and none is verified against a hash elsewhere.
 */
export function randomHex(bytes = 16) {
  const out = new Uint8Array(bytes);
  // `window` rather than globalThis: eslint-config-react-app's env predates
  // globalThis, and polyfills/randomUUID.js already reads window.crypto.
  const webcrypto = typeof window !== "undefined" ? window.crypto : undefined;
  if (webcrypto && typeof webcrypto.getRandomValues === "function") {
    webcrypto.getRandomValues(out);
  } else {
    // Insecure contexts and older test environments lack Web Crypto. These ids
    // are not security material, so a weaker source is acceptable rather than
    // throwing and taking the app down. Mirrors polyfills/randomUUID's stance.
    for (let i = 0; i < out.length; i++) out[i] = Math.floor(Math.random() * 256);
  }
  let hex = "";
  for (let i = 0; i < out.length; i++) hex += out[i].toString(16).padStart(2, "0");
  return hex;
}

export default randomHex;
