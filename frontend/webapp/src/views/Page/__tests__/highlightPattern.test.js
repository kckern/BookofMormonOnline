import { compileHighlightRegex, toHighlightPattern } from "../highlightPattern";

test("compiles an intentional pattern as-is", () => {
  const re = compileHighlightRegex("waters([^a-z]|<[^>]*>)+?of([^a-z]|<[^>]*>)+?Mormon");
  expect(re.test("waters <b>of</b> Mormon")).toBe(true);
});

test("falls back to literal matching for raw text with regex metacharacters", () => {
  const re = compileHighlightRegex("wicked (as to the) King");
  const re2 = compileHighlightRegex("wicked (as to the King");
  expect(re2).not.toBeNull();
  expect(re2.test("and he was wicked (as to the King")).toBe(true);
  expect(re.test("wicked (as to the) King")).toBe(true);
});

test("returns a valid regex for plain alphanumeric input", () => {
  expect(compileHighlightRegex("plain words")).not.toBeNull();
});

test("raw text containing [^ that cannot compile returns null, not a crash", () => {
  // A raw string with an unterminated character class: routed to the as-is
  // branch by the [^ heuristic, fails to compile, returns null (no throw).
  expect(compileHighlightRegex("weird [^ selection")).toBeNull();
});

test("toHighlightPattern strips edge punctuation and bridges non-letters", () => {
  const pattern = toHighlightPattern('"Waters of Mormon!"');
  expect(pattern).toBe("Waters([^a-z]|<[^>]*>)+?of([^a-z]|<[^>]*>)+?Mormon");
  const re = new RegExp(pattern, "gi");
  expect(re.test("waters <b>of</b> Mormon")).toBe(true);
});

test("toHighlightPattern matches a text_highlight excerpt across punctuation and markup", () => {
  // Commentary 1000001101's text_highlight — a verbatim span of the verse, so
  // the internal commas and any inline tags have to be bridged too.
  const re = compileHighlightRegex(
    toHighlightPattern("Yea, I make a record in the language of my father,")
  );
  expect(
    re.test(
      "Yea, I make a record in the <span class='indent'></span>language of my father,"
    )
  ).toBe(true);
});
