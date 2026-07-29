/** @format */
import { label } from "src/models/Utils";

/**
 * Human-readable relation verb.
 *
 * Utils.label() returns the KEY itself when the dictionary lacks an entry, and
 * " " before it loads — both truthy, so `label(k) || fallback` never falls
 * back. Treat a key-echo or a blank as a miss and de-hyphenate instead.
 */
export function verbLabel(rel) {
  if (!rel) return "";
  const key = "xrel_" + String(rel).replace(/-/g, "_");
  const v = label(key);
  if (v && v !== key && String(v).trim()) return v;
  return String(rel).replace(/-/g, " ");
}

/**
 * Display text for a target that has no record to resolve against — a `group`
 * or `figure`. The backend falls through to `dst_name = dst_slug` for these, so
 * what arrives is a raw slug: "lamanites", "brother-of-jared".
 *
 * Title-cases it while leaving joining words lowercase, so "brother-of-jared"
 * reads "Brother of Jared" rather than "Brother Of Jared". A CSS
 * ::first-letter rule cannot do this — it only reaches the first character,
 * which is why "Brother-of-jared" was the previous result.
 */
const MINOR = new Set(["of", "the", "and", "to", "in", "on", "for", "a", "an"]);

export function tagLabel(slug) {
  if (!slug) return "";
  const words = String(slug).replace(/[-_]+/g, " ").trim().split(/\s+/);
  return words
    .map((w, i) =>
      i > 0 && MINOR.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(" ");
}
