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
