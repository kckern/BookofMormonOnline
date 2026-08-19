// Per-image aspect-ratio cache (width / height), keyed by asset URL.
//
// Why: the desktop spread derives page dimensions from each page's aspect ratio,
// which was previously discovered asynchronously via Image.onload — so a freshly
// turned-to spread rendered at the 0.75 default for one frame, then snapped to
// the real ratio. That post-turn resize is the visible "jitter" (and it re-fired
// the ResizeObservers). Caching ratios lets the viewer seed the correct ratio
// synchronously when it lands on a page whose scan has already loaded (adjacent
// pages are preloaded), so there's nothing to settle.
const ratios = new Map();

/** First cached ratio among the given URLs (thumb + full share the same scan). */
export const getFaxRatio = (...urls) => {
  for (const u of urls) {
    if (u && ratios.has(u)) return ratios.get(u);
  }
  return null;
};

export const setFaxRatio = (url, r) => {
  if (url && Number.isFinite(r) && r > 0) ratios.set(url, r);
};
