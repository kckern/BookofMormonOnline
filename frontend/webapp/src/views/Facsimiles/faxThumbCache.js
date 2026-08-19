const warm = new Set();      // urls whose image has fired onload
const inflight = new Set();  // urls currently being fetched

export function isThumbWarm(url) {
  return !!url && warm.has(url);
}

export function markThumbWarm(url) {
  if (url) { inflight.delete(url); warm.add(url); }
}

/**
 * Prefetch thumbnail urls via Image(). Idempotent: skips warm/in-flight urls.
 * `factory` is injectable for tests (defaults to `new Image()`).
 */
export function prefetchThumbs(urls, factory = () => new Image()) {
  for (const url of urls || []) {
    if (!url || warm.has(url) || inflight.has(url)) continue;
    inflight.add(url);
    const img = factory();
    img.onload = () => { inflight.delete(url); warm.add(url); };
    img.onerror = () => { inflight.delete(url); };
    img.src = url;
  }
}

// test-only
export function __resetThumbCache() { warm.clear(); inflight.clear(); }
