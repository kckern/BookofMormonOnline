/** Shared sampler text hygiene: one implementation, every tile. */

// Re-exported so tiles can keep importing translate-with-fallback from here.
export { tr } from "src/models/Utils";

const SUPS = { 1: "¹", 2: "²", 3: "³", 4: "⁴" };

/** Name-attached disambiguation digits → the app's superscript convention. */
export const supDigits = (str) =>
  (str || "").replace(/([A-Za-z])([1-4])\b/g, (m, a, d) => a + SUPS[d]);

/**
 * Flatten app markup for plain-text contexts: {Name|slug} / [Name|slug] links
 * → display names, HTML stripped, digits superscripted, paren spacing tight.
 */
export const flatten = (html) =>
  supDigits(
    (html || "")
      .replace(/{(.*?)\|(.*?)}/g, "$1")
      .replace(/\[(.*?)\|(.*?)\]/g, "$1")
      .replace(/<[^>]*>/gi, " ")
      .replace(/\s+/g, " "),
  )
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();

/** Typographic verse ranges: hyphens between digits render as en-dashes. */
export const enDash = (s) => (s || "").replace(/(\d)\s*-\s*(\d)/g, "$1–$2");

/**
 * Word-budget truncation that prefers a sentence boundary in the back half,
 * NEVER cuts mid-word, and never strands an open parenthetical.
 */
export const clampWords = (text, words) => {
  const parts = (text || "").split(" ");
  if (parts.length <= words) return text || "";
  let cut = parts.slice(0, words).join(" ");
  const lastEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  if (lastEnd > cut.length * 0.5) return cut.slice(0, lastEnd + 1).trim();
  cut = cut.replace(/\s*\([^)]*$/, "").replace(/[,;:—-]$/, "").trim();
  return cut + "…";
};
