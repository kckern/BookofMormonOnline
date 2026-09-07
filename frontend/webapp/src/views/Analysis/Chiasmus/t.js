import { label } from "src/models/Utils";

// label() returns the raw key when the dictionary lacks it, and a single
// space (" ") when no dictionary is loaded at all — both unreadable for new
// keys. Fall back to supplied English until dictionary rows land.
// `inserts` passes through to label()'s $N substitution; when falling back,
// the same $N substitution is applied to the fallback string.
export const t = (key, fallback, inserts) => {
  const val = label(key, inserts);
  if (val !== key && val !== " ") return val;
  if (inserts == null) return fallback;
  const list = Array.isArray(inserts) ? inserts : [inserts];
  return fallback.replace(/\$(\d+)/g, (match, n) => {
    const v = list[Number(n) - 1];
    return v == null ? match : String(v);
  });
};
