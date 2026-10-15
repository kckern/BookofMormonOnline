// Notes L5: prod builds hide passage notes in Read (features.yml passageNotes
// hidden → HIDE_PASSAGE_NOTES). The Home Notes tile deep-links into Read, so it
// must be gated by the same constant — in the grid AND the infinite batches.
vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  renderBaseUrl: "http://localhost:5006",
  ApiBaseUrl: "http://localhost:5005",
}));
vi.mock("src/models/featureFlags", async (importOriginal) => ({
  ...(await importOriginal()),
  HIDE_PASSAGE_NOTES: true,
}));

import { tileRegistry, batchTiles } from "../registry";

const payload = { notes: [{ id: "n", text: "x", reference: "Alma 5:2" }] };

test("notes tile is never ready when passage notes are hidden", () => {
  expect(tileRegistry.find((t) => t.key === "notes").isReady(payload)).toBe(false);
  const batch = batchTiles.find((t) => t.key === "notes");
  expect(!batch || batch.isReady(payload) === false).toBe(true);
});
