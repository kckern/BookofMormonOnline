import { buildCommentQueue } from "../theaterUtils";

// Comment ids embed a 3-digit source id at string index 5..7
// e.g. "10000192001" → source 192
const com = (sourceId, preview, n = "001") => ({
  id: `10000${sourceId}${n}`,
  title: `t${sourceId}`,
  preview,
});

test("keeps normal sources, drops excluded sources and empty previews", () => {
  const coms = [
    com("099", "a normal comment"),
    com("041", "excluded source"),        // hardcoded exclusion list
    com("100", "   "),                    // empty preview
    com("101", "another normal comment"),
  ];
  const result = buildCommentQueue(coms, [], 100);
  const ids = result.map(c => c.id).sort();
  expect(ids).toEqual([com("099", "x").id, com("101", "x", "001").id].sort());
});

test("note sources pass even when blacklisted", () => {
  const coms = [com("192", "a study note")];
  const result = buildCommentQueue(coms, [192], 100);
  expect(result.length).toBe(1);
});

test("blacklisted sources are dropped", () => {
  const coms = [com("055", "blacklisted comment")];
  expect(buildCommentQueue(coms, [55], 100)).toEqual([]);
});

test("caps the queue at one comment per 5 seconds of duration", () => {
  const coms = Array.from({ length: 10 }, (_, i) =>
    com("099", `comment number ${i}`, String(i).padStart(3, "0"))
  );
  // 25 seconds → at most 5 comments
  expect(buildCommentQueue(coms, [], 25).length).toBeLessThanOrEqual(5);
});
