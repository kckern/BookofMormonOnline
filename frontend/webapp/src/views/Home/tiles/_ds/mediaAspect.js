/**
 * The portrait cap for every Home image (systemic A1/F1). A source taller than
 * 3:4 (width/height < 0.75) is shown in a 3:4 box, cropped with object-fit:
 * cover on an upper focal point (faces and titles sit high), so no image — and
 * so no tile — can run to several viewport heights (R6 art: a 186x600 strip
 * made a 1526px desktop / 2837px tablet tile). The full piece is one click away.
 */
export const MAX_PORTRAIT = 3 / 4;
export const PORTRAIT_FOCUS = "50% 25%";

/** width/height, clamped to the cap. Non-positive / NaN → null. */
export function capAspect(wOverH) {
  const r = Number(wOverH);
  if (!(r > 0) || !Number.isFinite(r)) return null;
  return Math.max(r, MAX_PORTRAIT);
}

/** "w / h" or "r" → width/height number, or null. */
export function parseAspect(aspect) {
  if (aspect == null || aspect === "") return null;
  if (typeof aspect === "number") return aspect > 0 ? aspect : null;
  const parts = String(aspect).split("/").map((x) => parseFloat(x));
  const r = parts.length === 2 ? parts[0] / parts[1] : parts[0];
  return r > 0 && Number.isFinite(r) ? r : null;
}

/** True when the cap actually crops this width/height. */
export const isCapped = (wOverH) => Number(wOverH) > 0 && Number(wOverH) < MAX_PORTRAIT - 1e-6;
