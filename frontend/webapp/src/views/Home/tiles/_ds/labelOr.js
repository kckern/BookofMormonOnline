import { label } from "src/models/Utils";

/**
 * label() with a real fallback. label() echoes the key when the labels table
 * lacks it and returns " " before the dictionary loads — both truthy — so new
 * keys fall back to the given English until their rows are added. `inserts`
 * fills `$1`, `$2`… in both the DB label and the fallback.
 */
export default function labelOr(key, fallback, inserts) {
  const list = inserts == null ? [] : Array.isArray(inserts) ? inserts : [inserts];
  const v = label(key, list);
  if (v && v !== key && String(v).trim()) return v;
  return String(fallback).replace(/\$(\d+)/g, (m, i) => (list[i - 1] != null ? list[i - 1] : ""));
}

/**
 * Sentence case for the CTA vocabulary ("Start Reading" → "Start reading").
 * Only touches a plain-ASCII Title-Case label (the English table rows); any
 * other script or mixed-case label (proper nouns, acronyms) is left alone.
 */
export function sentenceCase(s) {
  const str = String(s ?? "");
  if (!/^[A-Za-z][A-Za-z ]*$/.test(str)) return str;
  const words = str.split(" ");
  if (!words.every((w) => !w || /^[A-Z][a-z]*$/.test(w))) return str;
  return words.map((w, i) => (i === 0 ? w : w.toLowerCase())).join(" ");
}

/**
 * Lowercase for a table noun used MID-phrase ("11 Members · last month" →
 * "11 members"). Same guard as sentenceCase: only plain-ASCII Title-Case words
 * change; acronyms and other scripts pass through.
 */
export function inlineCase(s) {
  const str = String(s ?? "");
  if (!/^[A-Za-z][A-Za-z ]*$/.test(str)) return str;
  const words = str.split(" ");
  if (!words.every((w) => !w || /^[A-Z][a-z]*$/.test(w))) return str;
  return str.toLowerCase();
}
