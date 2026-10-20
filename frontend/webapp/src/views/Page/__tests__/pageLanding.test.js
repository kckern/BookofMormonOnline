import { resetsToTopOnLanding, rowSlugDuringNoteLanding } from "../pageLanding";

test("note deeplinks reset to the top while the host page resolves (audit commentary-D5)", () => {
  expect(resetsToTopOnLanding({ pageSlug: undefined, commentaryId: "1527009101" })).toBe(true);
  expect(resetsToTopOnLanding({ imageId: "42" })).toBe(true);
  expect(resetsToTopOnLanding({ pageSlug: "jesus" })).toBe(true);
});

test("row/section/fax deeplinks keep positioning themselves", () => {
  expect(resetsToTopOnLanding({ pageSlug: "jesus", textId: "74" })).toBe(false);
  expect(resetsToTopOnLanding({ pageSlug: "jesus", goToSection: "x" })).toBe(false);
  expect(resetsToTopOnLanding({ pageSlug: "jesus", faxVersion: "p" })).toBe(false);
});

test("the host row open does not rewrite a /commentary/:id URL while landing", () => {
  expect(rowSlugDuringNoteLanding({ resolvingNoteLink: true, slug: "jesus/74" })).toBeNull();
  expect(rowSlugDuringNoteLanding({ resolvingNoteLink: false, slug: "jesus/74" })).toBe("jesus/74");
});
