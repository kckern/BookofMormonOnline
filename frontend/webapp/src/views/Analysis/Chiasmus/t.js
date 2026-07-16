import { label } from "src/models/Utils";

// label() returns the raw key when the dictionary lacks it, and a single
// space (" ") when no dictionary is loaded at all — both unreadable for new
// keys. Fall back to supplied English until dictionary rows land.
export const t = (key, fallback) => {
  const val = label(key);
  return val === key || val === " " ? fallback : val;
};
