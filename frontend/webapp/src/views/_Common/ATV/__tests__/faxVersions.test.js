import { FAX_FOR_SIGLUM, faxCandidates } from "../faxVersions";

test("renderable sigla map to their fax version", () => {
  expect(FAX_FOR_SIGLUM["1"]).toMatchObject({ version: "printer", hasGeometry: true });
  expect(FAX_FOR_SIGLUM["A"]).toMatchObject({ version: "1830", hasGeometry: true, exact: true });
  expect(FAX_FOR_SIGLUM["R"]).toMatchObject({ version: "1920", hasGeometry: true });
  expect(FAX_FOR_SIGLUM["T"]).toMatchObject({ version: "1981", hasGeometry: true });
});

test("J and O are placeholders (exact:false) with the real scan title", () => {
  expect(FAX_FOR_SIGLUM["J"]).toMatchObject({ version: "1888d", exact: false });
  expect(FAX_FOR_SIGLUM["O"]).toMatchObject({ version: "1907", exact: false });
  expect(FAX_FOR_SIGLUM["J"].scanTitle).toMatch(/Deseret News/);
  expect(FAX_FOR_SIGLUM["O"].scanTitle).toMatch(/Deseret News/);
});

test("siglum 0 and the 11 no-geometry editions never yield a crop", () => {
  expect(FAX_FOR_SIGLUM["0"].hasGeometry).toBe(false);
  expect(FAX_FOR_SIGLUM["0"].version).toBe(null);
  for (const s of ["E","F","G","H","K","L","M","N","P","Q","S"]) {
    expect(FAX_FOR_SIGLUM[s].hasGeometry).toBe(false);
    expect(FAX_FOR_SIGLUM[s].version).toBe(null);
  }
});

test("no entry ever uses 1829 (retired)", () => {
  expect(FAX_FOR_SIGLUM["1"].version).toBe("printer");
  expect(Object.values(FAX_FOR_SIGLUM).every((v) => v.version !== "1829")).toBe(true);
});

test("all 22 sigla are present", () => {
  expect(Object.keys(FAX_FOR_SIGLUM).sort()).toEqual("0 1 A B C D E F G H I J K L M N O P Q R S T".split(" ").sort());
});

test("faxCandidates returns geometry-bearing sigla, chronological, 0 skipped", () => {
  expect(faxCandidates(["B","C","D","T"])[0]).toMatchObject({ siglum: "B", version: "1837" });
  expect(faxCandidates(["E","F"])).toEqual([]);
  expect(faxCandidates(["0","A"])[0].siglum).toBe("A");
  // order follows SIGLA_ORDER regardless of input order
  expect(faxCandidates(["T","A","B"]).map(c=>c.siglum)).toEqual(["A","B","T"]);
});
