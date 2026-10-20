import { htmlLangFor, applyDocumentLang } from "../documentLang";

// <html lang> stayed "en" on every language host (CRA shell): wrong screen-reader
// voice, no :lang() typography, and Chrome picks a CJK fallback font by lang.
// The app's language codes are not all BCP-47 (jp, vn, swe, tgl, slv …).
describe("htmlLangFor", () => {
  test.each([
    ["en", "en"], ["ko", "ko"], ["fr", "fr"], ["de", "de"], ["es", "es"], ["pt", "pt"],
    ["jp", "ja"], ["vn", "vi"], ["swe", "sv"], ["tgl", "fil"], ["slv", "sl"], ["tr", "tr"], ["ru", "ru"],
  ])("%s → %s", (app, html) => expect(htmlLangFor(app)).toBe(html));
  test("English editions (plain, easy, …) are English; unknown/empty fall back to en", () => {
    ["rlds", "covoc", "str", "plain", "easy", "concise"].forEach((c) => expect(htmlLangFor(c)).toBe("en"));
    expect(htmlLangFor(undefined)).toBe("en");
    expect(htmlLangFor("")).toBe("en");
  });
});

describe("applyDocumentLang", () => {
  test("sets the root lang attribute", () => {
    const doc = { documentElement: { lang: "en" } };
    applyDocumentLang(doc, "ko");
    expect(doc.documentElement.lang).toBe("ko");
    applyDocumentLang(doc, "jp");
    expect(doc.documentElement.lang).toBe("ja");
  });
  test("no document (SSR/tests without DOM) is a no-op", () => {
    expect(() => applyDocumentLang(undefined, "ko")).not.toThrow();
  });
});
