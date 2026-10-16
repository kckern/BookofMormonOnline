// Infinite batches re-sample the same archives, so the witness / Joseph Smith
// tiles repeated statements down the feed (blind audit witness-H4: the same
// Hyrum Smith quote in two consecutive witness tiles; josephSmith-H1: the same
// statement twice). A new batch is arranged against what the feed already showed.
import { arrangeArchives, featuredArchiveKeys } from "../archiveFeed";

const w = (slug, principal) => ({ slug, principal, moneyQuote: `Q ${slug}` });

describe("featuredArchiveKeys", () => {
  test("collects the featured witness statement, its principal and the JS statement", () => {
    const k = featuredArchiveKeys([
      { witnesses: [{ slug: "x", principal: "A" }, w("a1", "A"), w("b1", "B")], josephSmith: { slug: "js1" } },
      { witnesses: [w("c1", "C")], josephSmith: null },
    ]);
    expect([...k.witnessSlugs]).toEqual(["a1", "c1"]);
    expect([...k.jsSlugs]).toEqual(["js1"]);
    expect(k.lastPrincipal).toBe("C");
  });
});

describe("arrangeArchives", () => {
  const seen = (payloads) => featuredArchiveKeys(payloads);
  test("a repeated statement is not featured again; an unseen one by another witness leads", () => {
    const prev = [{ witnesses: [w("hs1", "Hyrum Smith")] }];
    const batch = { witnesses: [w("hs1", "Hyrum Smith"), w("hs2", "Hyrum Smith"), w("mh1", "Martin Harris")] };
    const out = arrangeArchives(batch, seen(prev));
    expect(out.witnesses[0].slug).toBe("mh1");
    expect(out.witnesses).toHaveLength(3);
  });
  test("falls back to an unseen statement by the same witness", () => {
    const prev = [{ witnesses: [w("hs1", "Hyrum Smith")] }];
    const out = arrangeArchives({ witnesses: [w("hs1", "Hyrum Smith"), w("hs2", "Hyrum Smith")] }, seen(prev));
    expect(out.witnesses[0].slug).toBe("hs2");
  });
  test("drops the witnesses when every statement was already featured (tile skips)", () => {
    const prev = [{ witnesses: [w("hs1", "Hyrum Smith")] }];
    const out = arrangeArchives({ witnesses: [w("hs1", "Hyrum Smith")] }, seen(prev));
    expect(out.witnesses).toEqual([]);
  });
  test("a Joseph Smith statement already shown is dropped from the batch", () => {
    const prev = [{ josephSmith: { slug: "js1" } }];
    expect(arrangeArchives({ josephSmith: { slug: "js1" } }, seen(prev)).josephSmith).toBeNull();
    expect(arrangeArchives({ josephSmith: { slug: "js2" } }, seen(prev)).josephSmith.slug).toBe("js2");
  });
  test("returns the payload untouched when nothing collides", () => {
    const p = { witnesses: [w("a", "A")], josephSmith: { slug: "j" } };
    expect(arrangeArchives(p, seen([{ witnesses: [w("b", "B")] }]))).toBe(p);
  });
});
