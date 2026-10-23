import { label } from "src/models/Utils";

// The Discover (sampler) entry's name in nav and tabs. `menu_discover` is the
// dictionary key; until its row exists the label() lookup returns the key
// itself, so fall back to English.
export const discoverLabel = () => {
  const t = label("menu_discover");
  return t && t !== "menu_discover" ? t : "Discover";
};
