import { captureAnchor, captureTile, findAnchor, pinAnchor, trackAnchor } from "../scrollAnchor";

const node = (cls, top, height, id) => ({
  classList: ["tile", cls],
  dataset: id ? { tileId: id } : {},
  getBoundingClientRect: () => ({ top: node.offset + top, bottom: node.offset + top + height }),
});
node.offset = 0;

describe("captureAnchor", () => {
  test("picks the first tile still visible below the top third, with its offset", () => {
    node.offset = 0;
    const nodes = [node("tile-a", -500, 400), node("tile-b", -100, 300), node("tile-c", 200, 500)];
    // viewport 900: top third = 300; tile-b bottom is 200 (<300), tile-c bottom 700
    expect(captureAnchor(nodes, 900)).toEqual({ index: 2, cls: "tile-c", offset: 200 });
  });

  test("no tiles → null", () => {
    expect(captureAnchor([], 900)).toBeNull();
  });
});

describe("pinAnchor", () => {
  let frames, scrolled, listeners;
  const win = {
    requestAnimationFrame: (cb) => frames.push(cb),
    cancelAnimationFrame: () => {},
    scrollBy: (o) => { scrolled += o.top; node.offset -= o.top; },
    addEventListener: (t, f) => { listeners[t] = f; },
    removeEventListener: (t) => { delete listeners[t]; },
  };
  const run = (n = 1) => { for (let i = 0; i < n; i++) frames.shift()?.(); };
  beforeEach(() => { frames = []; scrolled = 0; listeners = {}; node.offset = 0; });

  test("keeps the anchored tile at its saved offset while layout above settles", () => {
    const nodes = [node("tile-a", 0, 400), node("tile-c", 600, 500)];
    let now = 0;
    pinAnchor(() => nodes, { index: 1, cls: "tile-c", offset: 200 }, { win, now: () => now, timeoutMs: 3000 });
    run();
    expect(nodes[1].getBoundingClientRect().top).toBe(200);
    // a late image above grows the page by 150px: the tile drifts, the pin corrects it
    node.offset += 150;
    now = 500;
    run();
    expect(nodes[1].getBoundingClientRect().top).toBe(200);
  });

  // blind audit R5 XC-E1: an anchor whose tile sat at or above the viewport
  // top (offset ≤ 0) must pin like any other, including while a tile above
  // re-grows ~120px a beat after the restore (faxVerse remount).
  test.each([-1, 0, -278])("pins a tile saved at offset %i while a tile above re-grows", (offset) => {
    const nodes = [node("tile-faxVerse", 0, 517, "faxVerse"), node("tile-history", 900, 600, "history")];
    let now = 0;
    pinAnchor(() => nodes, { index: 1, cls: "tile-history", id: "history", offset }, { win, now: () => now, timeoutMs: 3500 });
    run();
    expect(nodes[1].getBoundingClientRect().top).toBe(offset);
    node.offset += 120; // the faxVerse above grows back to 637px
    now = 1500;
    run();
    expect(nodes[1].getBoundingClientRect().top).toBe(offset);
  });

  test("stops as soon as the reader scrolls", () => {
    const nodes = [node("tile-c", 600, 500)];
    pinAnchor(() => nodes, { index: 0, cls: "tile-c", offset: 200 }, { win, now: () => 0 });
    listeners.wheel();
    run(3);
    expect(scrolled).toBe(0);
  });

  test("gives up if the anchored tile is a different tile (layout not restored)", () => {
    const nodes = [node("tile-x", 600, 500)];
    pinAnchor(() => nodes, { index: 0, cls: "tile-c", offset: 200 }, { win, now: () => 0, timeoutMs: 100 });
    run(2);
    expect(scrolled).toBe(0);
  });

  test("stops after the timeout", () => {
    const nodes = [node("tile-c", 600, 500)];
    let now = 0;
    pinAnchor(() => nodes, { index: 0, cls: "tile-c", offset: 200 }, { win, now: () => now, timeoutMs: 1000 });
    run();
    now = 1500;
    node.offset += 300;
    run();
    expect(nodes[0].getBoundingClientRect().top).toBe(500);
  });

  // Audit E1 (phone Back from an infinite-batch Profile): on the first frames
  // after Back a tile above the anchor has not mounted yet, so nodes[index] is
  // its neighbour. The pin must not give up — it follows the same-class tile
  // nearest the saved index and keeps it pinned once the layout catches up.
  test("follows the anchored tile when a late tile above shifts the indexes", () => {
    let nodes = [node("tile-a", 0, 400), node("tile-c", 600, 500), node("tile-d", 1200, 300)];
    let now = 0;
    pinAnchor(() => nodes, { index: 2, cls: "tile-c", offset: 200 }, { win, now: () => now, timeoutMs: 3000 });
    run();
    expect(nodes[1].getBoundingClientRect().top).toBe(200); // found one slot early
    // the missing tile mounts above: indexes shift and the page grows 900px
    nodes = [node("tile-a", 0, 400), node("tile-b", 400, 900), ...nodes.slice(1)];
    node.offset += 900;
    now = 400;
    run();
    expect(nodes[2].getBoundingClientRect().top).toBe(200);
  });

  test("keeps waiting (no scroll) while no same-class tile is near the index", () => {
    let nodes = [node("tile-x", 600, 500)];
    let now = 0;
    pinAnchor(() => nodes, { index: 0, cls: "tile-c", offset: 200 }, { win, now: () => now, timeoutMs: 3000 });
    run();
    expect(scrolled).toBe(0);
    nodes = [node("tile-x", 0, 500), node("tile-c", 700, 500)];
    now = 600;
    run();
    expect(nodes[1].getBoundingClientRect().top).toBe(200);
  });
});


describe("trackAnchor", () => {
  const makeWin = (pathname) => {
    const w = {
      location: { pathname },
      innerHeight: 900,
      frames: [],
      listeners: {},
      requestAnimationFrame: (cb) => w.frames.push(cb),
      cancelAnimationFrame: () => {},
      addEventListener: (t, f) => { w.listeners[t] = f; },
      removeEventListener: (t) => { delete w.listeners[t]; },
    };
    w.scroll = () => { w.listeners.scroll?.(); w.frames.splice(0).forEach((f) => f()); };
    return w;
  };

  test("records the anchor as the reader scrolls Home", () => {
    node.offset = 0;
    const win = makeWin("/");
    const saved = [];
    trackAnchor(() => [node("tile-a", -500, 400), node("tile-b", 200, 500)], (a) => saved.push(a), { win });
    win.scroll();
    expect(saved).toEqual([{ index: 1, cls: "tile-b", offset: 200 }]);
  });

  test("ignores the shell's reset-to-top once the URL has left Home (audit people E1)", () => {
    node.offset = 0;
    const win = makeWin("/");
    const saved = [];
    trackAnchor(() => [node("tile-readingplan", 120, 400)], (a) => saved.push(a), { win });
    win.location.pathname = "/people/heth2"; // link clicked: history pushed, shell resets scroll
    win.scroll();
    expect(saved).toEqual([]);
  });

  test("stop() removes the listener", () => {
    const win = makeWin("/");
    const stop = trackAnchor(() => [], () => {}, { win });
    stop();
    expect(win.listeners.scroll).toBeUndefined();
  });
});

// Audit R4 analysis E1: chained link→Back cycles drifted hundreds of px (and
// once 6,496px onto a batch copy of the same family). The anchor was "same span
// class near the saved index", so an index shift (batch rail tiles, a reserve
// that resolved differently) matched a different tile of the family, and the
// scroll capture picked the first tile in DOM order (a tall rail tile), not the
// one the reader opened.
describe("tile-identity anchors (audit analysis E1)", () => {
  test("captureAnchor records the tile id", () => {
    node.offset = 0;
    const nodes = [node("tile-a", -500, 400, "a"), node("tile-chiasmus", 200, 500, "b0:chiasmus:3")];
    expect(captureAnchor(nodes, 900)).toEqual({ index: 1, cls: "tile-chiasmus", id: "b0:chiasmus:3", offset: 200 });
  });

  test("findAnchor matches by id anywhere, never a same-class neighbour", () => {
    node.offset = 0;
    const twin = node("tile-chiasmus", 0, 300, "chiasmus");
    const mine = node("tile-chiasmus", 900, 300, "b1:chiasmus:2");
    const nodes = [twin, ...Array.from({ length: 40 }, (_, i) => node("tile-x", 0, 10, `x${i}`)), mine];
    expect(findAnchor(nodes, { index: 0, cls: "tile-chiasmus", id: "b1:chiasmus:2", offset: 100 })).toBe(mine);
    expect(findAnchor([twin], { index: 0, cls: "tile-chiasmus", id: "b1:chiasmus:2", offset: 100 })).toBeNull();
  });

  test("captureTile anchors the tile holding a clicked element", () => {
    node.offset = 0;
    const t = node("tile-art", 240, 600, "art");
    const nodes = [node("tile-fax", -100, 2000, "fax"), t];
    const target = { closest: () => t };
    expect(captureTile(nodes, target)).toEqual({ index: 1, cls: "tile-art", id: "art", offset: 240 });
    expect(captureTile(nodes, { closest: () => null })).toBeNull();
  });

  const makeWin = () => {
    const w = {
      location: { pathname: "/home" },
      innerHeight: 900,
      frames: [],
      listeners: {},
      requestAnimationFrame: (cb) => w.frames.push(cb),
      cancelAnimationFrame: () => {},
      addEventListener: (t, f) => { w.listeners[t] = f; },
      removeEventListener: (t) => { delete w.listeners[t]; },
    };
    w.fire = (t, e) => { w.listeners[t]?.(e); w.frames.splice(0).forEach((f) => f()); };
    return w;
  };

  test("a click on a tile link records that tile, not the first visible one", () => {
    node.offset = 0;
    const win = makeWin();
    const saved = [];
    const rail = node("tile-fax", -100, 2000, "fax");
    const art = node("tile-art", 240, 600, "art");
    trackAnchor(() => [rail, art], (a) => saved.push(a), { win });
    win.fire("click", { target: { closest: () => art } });
    expect(saved.at(-1)).toMatchObject({ id: "art", offset: 240 });
  });

  test("captures pause while paused() (the Back pin's own scrolls)", () => {
    node.offset = 0;
    const win = makeWin();
    const saved = [];
    let pinning = true;
    trackAnchor(() => [node("tile-b", 200, 500, "b")], (a) => saved.push(a), { win, paused: () => pinning });
    win.fire("scroll");
    expect(saved).toEqual([]);
    pinning = false;
    win.fire("scroll");
    expect(saved).toHaveLength(1);
  });

  test("pinAnchor reports when it stops", () => {
    const frames = [];
    const win = {
      requestAnimationFrame: (cb) => frames.push(cb),
      cancelAnimationFrame: () => {},
      scrollBy: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    let now = 0;
    const onStop = vi.fn();
    pinAnchor(() => [], { index: 0, cls: "tile-c", id: "c", offset: 0 }, { win, now: () => now, timeoutMs: 100, onStop });
    frames.shift()();
    expect(onStop).not.toHaveBeenCalled();
    now = 200;
    frames.shift()();
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
