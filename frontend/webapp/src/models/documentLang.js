// The app's language codes (determineLanguage) are host-based and not all BCP-47.
const BCP47 = { jp: "ja", vn: "vi", swe: "sv", tgl: "fil", slv: "sl", ukr: "uk", tam: "ta" };
const ENGLISH_EDITIONS = new Set(["rlds", "covoc", "str", "plain", "easy", "concise"]);

/** The value for <html lang> for an app language code. */
export function htmlLangFor(appLang) {
  if (!appLang) return "en";
  if (ENGLISH_EDITIONS.has(appLang)) return "en";
  return BCP47[appLang] || appLang;
}

/** Point <html lang> at the site's language (the CRA shell hardcodes "en"). */
export function applyDocumentLang(doc, appLang) {
  if (!doc?.documentElement) return;
  doc.documentElement.lang = htmlLangFor(appLang);
}
