import { parseTeaser } from "../HistoryTile";

describe("parseTeaser", () => {
  test("extracts the lead paragraph before 'Key Points:' and the <li> bullets after", () => {
    const html =
      "<p>An intro lead sentence.</p> Key Points: <ul><li>First point</li><li>Second point</li></ul>";
    const { lead, bullets } = parseTeaser(html);
    expect(lead).toContain("An intro lead sentence");
    expect(bullets).toEqual(["First point", "Second point"]);
  });

  test("caps bullets at four", () => {
    const html =
      "Lead. Key points: <ul>" +
      "<li>a</li><li>b</li><li>c</li><li>d</li><li>e</li>" +
      "</ul>";
    expect(parseTeaser(html).bullets).toEqual(["a", "b", "c", "d"]);
  });

  test("returns empty bullets and the whole text as lead when there is no list", () => {
    const { lead, bullets } = parseTeaser("Just a plain teaser with no bullets.");
    expect(bullets).toEqual([]);
    expect(lead).toContain("Just a plain teaser");
  });

  test("tolerates empty/nullish input", () => {
    expect(parseTeaser("")).toEqual({ lead: "", bullets: [] });
    expect(parseTeaser(undefined)).toEqual({ lead: "", bullets: [] });
  });
});
