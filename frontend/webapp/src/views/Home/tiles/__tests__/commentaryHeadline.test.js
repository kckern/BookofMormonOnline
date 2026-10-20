import { liftHeadline } from "../CommentaryTile";

const LONG =
  "The closing sentence of what is now the last verse in Chapter 1 was “But behold, I, Nephi, will show unto you that the tender mercies of the Lord are over all those whom he hath chosen, because of their faith, to make them mighty even unto the power of deliverance.” This verse is a thesis.";

test("a long opening is cut once: headline ends in … and the body continues, no repeat (audit commentary-H3)", () => {
  const { headline, rest } = liftHeadline([LONG, "Second paragraph."]);
  expect(headline.endsWith("…")).toBe(true);
  expect(headline.length).toBeLessThanOrEqual(92);
  expect(rest[0].startsWith("…")).toBe(true);
  // no overlap: the body picks up exactly where the headline broke off
  expect(rest[0]).not.toContain("The closing sentence");
  expect(LONG.indexOf(rest[0].slice(1))).toBeGreaterThan(headline.length - 3);
  expect(rest[1]).toBe("Second paragraph.");
});

test("a short first sentence lifts whole and leaves the body", () => {
  const { headline, rest } = liftHeadline(["Verse 19 is a promise. It is kept later.", "Next."]);
  expect(headline).toBe("Verse 19 is a promise.");
  expect(rest).toEqual(["It is kept later.", "Next."]);
});
