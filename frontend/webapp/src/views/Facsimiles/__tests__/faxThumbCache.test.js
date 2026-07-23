import { prefetchThumbs, isThumbWarm, __resetThumbCache } from "../faxThumbCache";

describe("faxThumbCache", () => {
  beforeEach(() => __resetThumbCache());

  test("isThumbWarm is false before prefetch, true after image load", () => {
    const loaders = [];
    const factory = () => { const img = {}; loaders.push(img); return img; };
    expect(isThumbWarm("a.jpg")).toBe(false);
    prefetchThumbs(["a.jpg"], factory);
    loaders[0].onload();
    expect(isThumbWarm("a.jpg")).toBe(true);
  });

  test("prefetch is idempotent — a warm/in-flight url is not re-fetched", () => {
    let created = 0;
    const factory = () => { created++; return {}; };
    prefetchThumbs(["a.jpg", "a.jpg"], factory);
    prefetchThumbs(["a.jpg"], factory);
    expect(created).toBe(1);
  });

  test("ignores falsy urls", () => {
    let created = 0;
    const factory = () => { created++; return {}; };
    prefetchThumbs([null, undefined, ""], factory);
    expect(created).toBe(0);
  });
});
