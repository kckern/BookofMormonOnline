// Pure helpers for the search mode (keyword | rich). Kept out of Search.js so the
// branching is unit-testable. VERSE_CAP mirrors the backend constant (searchhist.ts).
export const VERSE_CAP = 100;

export function parseMode(search) {
  return new URLSearchParams(search || "").get("mode") === "rich" ? "rich" : "keyword";
}

export function buildSearchPath(slug, mode) {
  return `/search/${slug}${mode === "rich" ? "?mode=rich" : ""}`;
}

// Keyword search that returned a non-semantic flood: offer topical ranking.
export function shouldOfferRich(mode, semantic, verseTotal) {
  return mode === "keyword" && !semantic && (verseTotal ?? 0) > VERSE_CAP;
}

// Rich search that came back non-semantic means the vector backend was unreachable.
export function isRichDegraded(mode, semantic) {
  return mode === "rich" && semantic === false;
}
