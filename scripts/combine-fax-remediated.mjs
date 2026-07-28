import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";

const root = process.argv[2] || "/Users/kckern/Documents/GitHub/BoMOnlineWorkspace/scripts/out/families";
const out = process.argv[3] || "/Users/kckern/Documents/GitHub/BookofMormonOnline/docs/sql/fax-wip-remediated-2026-07-25.sql";
const versions = ["1842", "1849", "1852", "1854", "1854l", "1858", "1866", "1871", "1874", "1877", "1899", "1902"];
const tuple = /\('(\w+)',\s*'(\d+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\)/g;

const blocks = [];
let total = 0;
for (const version of versions) {
  const file = resolve(root, `${version}-remediated.sql`);
  let text;
  try { text = readFileSync(file, "utf8"); } catch { throw new Error(`missing required artifact: ${file}`); }
  const rows = [];
  let m;
  while ((m = tuple.exec(text))) {
    if (m[1] !== version) throw new Error(`${file}: tuple version ${m[1]} does not match ${version}`);
    rows.push(m[0]);
  }
  if (!rows.length) throw new Error(`${file}: no data rows`);
  total += rows.length;
  blocks.push({ version, rows });
}

const sql = [
  `-- Combined fax remediation update; ${versions.length} editions / ${total} rows.`,
  "-- Generated only from per-edition remediated SQL artifacts.",
  "-- Each edition is scoped by version; no other fax data is touched.",
  "START TRANSACTION;",
  ...blocks.flatMap(({ version, rows }) => [
    `-- ${version}: ${rows.length} rows`,
    `DELETE FROM bom_xtras_fax_index WHERE version='${version}';`,
    ...rows.map(row => `INSERT INTO bom_xtras_fax_index (version, verse_id, page, pageWidth, pageScale, X, Y, W, H, TLW, TLH, BRW, BRH) VALUES ${row};`),
  ]),
  "COMMIT;",
  "",
].join("\n");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, sql);
console.log(`wrote ${out}: ${versions.length} editions / ${total} rows`);
