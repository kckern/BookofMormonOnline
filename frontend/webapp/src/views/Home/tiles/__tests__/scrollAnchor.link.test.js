import { captureTile, pinAnchor, trackAnchor } from "../scrollAnchor";
import { readAnchor, writeAnchor } from "../samplerSession";

// Systemic E1 edges: the reader's place is the LINK they opened, not the
// tile's top. When the tile's own layout above that link differs after the
// remount (a reveal, an image reserve, a row that lands late) — or the tile
// top sat far above the fold — pinning the tile top left the link hundreds of
// px away. The anchor now carries the clicked link and the pin holds IT.

// a real DOM tile with a link `linkAt` px below its top
const mkTile = (id, top, linkAt, href = "/x") => {
  const tile = document.createElement("div");
  tile.className = "tile tile-a";
  tile.dataset.tileId = id;
  const a = document.createElement("a");
  a.setAttribute("href", href);
  tile.appendChild(a);
  tile._top = top;
  tile._linkAt = linkAt;
  tile.getBoundingClientRect = () => ({ top: tile._top, bottom: tile._top + 900, height: 900 });
  a.getBoundingClientRect = () => ({ top: tile._top + tile._linkAt, bottom: tile._top + tile._linkAt + 20, height: 20 });
  document.body.appendChild(tile);
  return { tile, a };
};

afterEach(() => { document.body.innerHTML = ""; sessionStorage.clear(); });

test("captureTile records the clicked link (href, nth, offset) with the tile", () => {
  const { tile, a } = mkTile("fax", -250, 600, "/fax/1891");
  expect(captureTile([tile], a)).toMatchObject({ id: "fax", offset: -250, link: { href: "/fax/1891", n: 0, offset: 350 } });
});

test("the link survives the session round-trip", () => {
  writeAnchor(7, { index: 0, cls: "tile-a", id: "fax", offset: -250, link: { href: "/fax/1891", n: 0, offset: 350 } });
  expect(readAnchor(7)).toMatchObject({ link: { href: "/fax/1891", n: 0, offset: 350 } });
});

test("pin holds the LINK at its offset even when the tile's inner layout differs", () => {
  const { tile } = mkTile("fax", 0, 300, "/fax/1891"); // remounted: link now 300 below the top, not 600
  const frames = [];
  const win = {
    requestAnimationFrame: (cb) => frames.push(cb),
    cancelAnimationFrame: () => {},
    scrollBy: ({ top }) => { tile._top -= top; },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  pinAnchor(() => [tile], { index: 0, cls: "tile-a", id: "fax", offset: -250, link: { href: "/fax/1891", n: 0, offset: 350 } }, { win, now: () => 0 });
  frames.shift()();
  expect(tile._top + tile._linkAt).toBe(350);
});

test("a keyboard Enter (click event on the focused link) records the link too", () => {
  const { tile, a } = mkTile("art", 100, 40, "/art/9");
  const listeners = {};
  const win = {
    location: { pathname: "/home" },
    innerHeight: 900,
    requestAnimationFrame: (cb) => cb(),
    cancelAnimationFrame: () => {},
    addEventListener: (t, f) => { listeners[t] = f; },
    removeEventListener: () => {},
  };
  const saved = [];
  trackAnchor(() => [tile], (x) => saved.push(x), { win });
  listeners.click({ target: a });
  expect(saved.at(-1)).toMatchObject({ id: "art", link: { href: "/art/9", offset: 140 } });
});
