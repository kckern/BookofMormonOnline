import { countFaxFromIndex, mergeCounts } from "../pageCommentCounts";

test("countFaxFromIndex groups fax versions by verse num", () => {
  const index = { fax: { "21.a": {}, "21.b": {}, "3.a": {} } };
  expect(countFaxFromIndex(index)).toEqual({
    21: { fax: ["a", "b"] },
    3: { fax: ["a"] },
  });
});

test("countFaxFromIndex tolerates missing fax key", () => {
  expect(countFaxFromIndex({})).toEqual({});
  expect(countFaxFromIndex(undefined)).toEqual({});
});

test("mergeCounts merges server com/img with client fax per verse", () => {
  const server = { 21: { com: [1, 2] }, 5: { img: [9] } };
  const fax = { 21: { fax: ["a"] }, 7: { fax: ["b"] } };
  expect(mergeCounts(server, fax)).toEqual({
    21: { com: [1, 2], fax: ["a"] },
    5: { img: [9] },
    7: { fax: ["b"] },
  });
});

test("mergeCounts tolerates null server counts (stripped empty object)", () => {
  expect(mergeCounts(null, { 1: { fax: ["a"] } })).toEqual({ 1: { fax: ["a"] } });
});
