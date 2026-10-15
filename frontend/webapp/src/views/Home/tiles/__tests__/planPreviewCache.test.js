import { readPlanPreview, loadPlanPreview, PLAN_PREVIEW_TTL_MS, _resetForTests } from "../planPreviewCache";

vi.mock("src/models/BoMOnlineAPI.js", () => ({ __esModule: true, default: vi.fn() }));
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";

const mockApi = () =>
  BoMOnlineAPI.mockImplementation(async (q) => {
    if ("readingplanprograms" in q) return { readingplanprograms: { a: { title: "BoM in a Year", durationLabel: "52 weeks", config: "cfg" } } };
    if ("readingplanpreview" in q) return { readingplanpreview: { segments: [{ ref: "1 Ne 1" }, { ref: "1 Ne 2" }] } };
    return {};
  });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  _resetForTests();
});

describe("planPreviewCache", () => {
  test("loads program + preview segments and caches them for a synchronous read", async () => {
    mockApi();
    expect(readPlanPreview()).toBeNull();
    const p = await loadPlanPreview();
    expect(p).toEqual({ title: "BoM in a Year", durationLabel: "52 weeks", segments: [{ ref: "1 Ne 1" }, { ref: "1 Ne 2" }] });
    expect(readPlanPreview()).toEqual(p);
  });

  test("concurrent callers share one fetch", async () => {
    mockApi();
    await Promise.all([loadPlanPreview(), loadPlanPreview()]);
    expect(BoMOnlineAPI).toHaveBeenCalledTimes(2); // programs + preview, once
  });

  test("a cached entry past the TTL is not returned", async () => {
    mockApi();
    await loadPlanPreview();
    expect(readPlanPreview(Date.now() + PLAN_PREVIEW_TTL_MS + 1)).toBeNull();
  });

  test("a failed fetch resolves null and can be retried", async () => {
    BoMOnlineAPI.mockRejectedValueOnce(new Error("down"));
    expect(await loadPlanPreview()).toBeNull();
    mockApi();
    expect((await loadPlanPreview()).segments).toHaveLength(2);
  });
});
