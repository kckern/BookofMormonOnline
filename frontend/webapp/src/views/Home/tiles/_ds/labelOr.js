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
