import { orderByDomAncestry } from "../orderByDomAncestry";

function setupDom(html) {
  document.body.innerHTML = html;
}

describe("orderByDomAncestry", () => {
  test("returns ancestor before descendant", () => {
    setupDom(`
      <div textid="lehites/85"><div class="row"><div textid="lehites/100"></div></div></div>
    `);
    expect(orderByDomAncestry(["lehites/100", "lehites/85"])).toEqual([
      "lehites/85",
      "lehites/100",
    ]);
  });

  test("preserves order when slugs are siblings", () => {
    setupDom(`
      <div textid="lehites/1"></div><div textid="lehites/2"></div>
    `);
    expect(orderByDomAncestry(["lehites/1", "lehites/2"])).toEqual([
      "lehites/1",
      "lehites/2",
    ]);
  });

  test("works regardless of lexical order", () => {
    setupDom(`
      <div textid="lehites/9"><div class="row"><div textid="lehites/100"></div></div></div>
    `);
    // Note: lex sort would put "lehites/100" first because '1' < '9'
    expect(orderByDomAncestry(["lehites/100", "lehites/9"])).toEqual([
      "lehites/9",
      "lehites/100",
    ]);
  });

  test("drops slugs whose elements aren't in the DOM", () => {
    setupDom(`<div textid="lehites/1"></div>`);
    expect(orderByDomAncestry(["lehites/1", "lehites/missing"])).toEqual([
      "lehites/1",
    ]);
  });

  test("handles empty input", () => {
    expect(orderByDomAncestry([])).toEqual([]);
  });
});
