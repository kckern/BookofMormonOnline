/**
 * Compact edition names for tight tile rails: "2013 Salt Lake City (Current)
 * Edition" → "2013 Salt Lake City", "1854 Liverpool 2nd Edition" → "1854
 * Liverpool 2nd ed.", "2011 The Abridging Works: The Epic…" → "2011 The
 * Abridging Works". The full title stays available as the link's title/label.
 */
export const shortEdition = (title) => {
  const t = String(title || "").trim();
  if (!t) return "";
  return t
    .split(":")[0]
    .replace(/\s*\(current\)/i, "")
    .replace(/(\d(?:st|nd|rd|th))\s+edition$/i, "$1 ed.")
    .replace(/\s+edition$/i, "")
    .replace(/\s+/g, " ")
    .trim();
};
