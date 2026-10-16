import { captureAnchor, pinAnchor } from "../scrollAnchor";

const node = (cls, top, height) => ({
  classList: ["tile", cls],
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

