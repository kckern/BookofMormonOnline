// Normalizes the dark-mode preference key. Historical clients wrote
// `dark_mode` (defaults) and `darkMode` (toggle); `darkMode` is canonical.
export const migratePreferences = (prefs, osPrefersDark = false) => {
  const p = { ...(prefs || {}) };
  if (p.darkMode === undefined) {
    p.darkMode = p.dark_mode !== undefined ? !!p.dark_mode : !!osPrefersDark;
  }
  delete p.dark_mode;
  return p;
};
