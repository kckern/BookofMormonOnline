jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));

import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { fetchChiasm, __clearChiasmCache } from "../Chiasm";

const resolveWith = (chiasm) => (query) =>
  Promise.resolve({ chiasm: { [query.chiasm[0]]: chiasm ?? { title: `chiasm ${query.chiasm[0]}` } } });

describe("fetchChiasm", () => {
  beforeEach(() => {
    __clearChiasmCache();
    jest.clearAllMocks();
  });

  test("second call for the same id resolves from cache without a second API call", async () => {
    BoMOnlineAPI.mockImplementation(resolveWith());
    const first = await fetchChiasm("42");
    const second = await fetchChiasm("42");
    expect(first).toEqual({ title: "chiasm 42" });
    expect(second).toBe(first);
    expect(BoMOnlineAPI).toHaveBeenCalledTimes(1);
  });

  test("null/undefined id resolves null without an API call", async () => {
    await expect(fetchChiasm(null)).resolves.toBeNull();
    await expect(fetchChiasm(undefined)).resolves.toBeNull();
    expect(BoMOnlineAPI).not.toHaveBeenCalled();
  });

  test("a failed fetch does not poison the cache", async () => {
    BoMOnlineAPI.mockRejectedValueOnce(new Error("network down"));
    await expect(fetchChiasm("7")).rejects.toThrow("network down");
    BoMOnlineAPI.mockImplementation(resolveWith());
    await expect(fetchChiasm("7")).resolves.toEqual({ title: "chiasm 7" });
    expect(BoMOnlineAPI).toHaveBeenCalledTimes(2);
  });

  test("LRU evicts the oldest entry beyond 10", async () => {
    BoMOnlineAPI.mockImplementation(resolveWith());
    for (let i = 1; i <= 11; i++) await fetchChiasm(String(i));
    expect(BoMOnlineAPI).toHaveBeenCalledTimes(11);
    // id 1 was evicted when id 11 landed
    await fetchChiasm("1");
    expect(BoMOnlineAPI).toHaveBeenCalledTimes(12);
    // id 11 is still cached
    await fetchChiasm("11");
    expect(BoMOnlineAPI).toHaveBeenCalledTimes(12);
  });

  test("a response with no chiasm for the id returns undefined and is not cached", async () => {
    BoMOnlineAPI.mockResolvedValue({ chiasm: {} });
    await expect(fetchChiasm("404")).resolves.toBeUndefined();
    await expect(fetchChiasm("404")).resolves.toBeUndefined();
    expect(BoMOnlineAPI).toHaveBeenCalledTimes(2);
  });

  test("resolves undefined when the id is not in the result", async () => {
    BoMOnlineAPI.mockResolvedValueOnce({ chiasm: {} });
    await expect(fetchChiasm("nonexistent999")).resolves.toBeUndefined();
  });

  test("resolves undefined when the API returns an error object", async () => {
    BoMOnlineAPI.mockResolvedValueOnce({ error: { data: null } });
    await expect(fetchChiasm("nonexistent999")).resolves.toBeUndefined();
  });

  test("resolves undefined when the API maps the missing id to null (live backend shape)", async () => {
    // The real backend answers 200 {"data":{}} for an unknown id; BoMOnlineAPI's
    // structureResults turns that into { chiasm: { <id>: null } }.
    BoMOnlineAPI.mockResolvedValueOnce({ chiasm: { nonexistent999: null } });
    await expect(fetchChiasm("nonexistent999")).resolves.toBeUndefined();
  });
});
