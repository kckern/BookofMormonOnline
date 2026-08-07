import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { canons } from "./canon";
import { allPairs, divisionBookPairs, bookTotal, partnersFor, headline } from "./aggregate";
import { layoutRibbons, ribbonPath } from "./ribbonLayout";
import TableTwin from "./TableTwin";

const LABEL_PAD = 8;
const FALLBACK_H = 420;
const HAIRLINE = 5; // ribbons with <= this many refs never intercept clicks when idle

// True when the viewport is too narrow for the labeled ribbon chart. Guards for
// environments without matchMedia (jsdom) by reporting false (desktop chart).
function useIsNarrow(maxWidth = 700) {
  const query = `(max-width: ${maxWidth}px)`;
  const get = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;
  const [narrow, setNarrow] = React.useState(get);
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const on = () => setNarrow(mql.matches);
    on();
    mql.addEventListener ? mql.addEventListener("change", on) : mql.addListener(on);
    return () =>
      mql.removeEventListener ? mql.removeEventListener("change", on) : mql.removeListener(on);
  }, [query]);
  return narrow;
}

// Bipartite ribbon overview. Left spine: the Bible's 9 divisions (book-level
// ribbons on both sides read as spaghetti — the division default is the spec's
// §4.1 legibility guardrail); clicking a division expands it into its books.
// Right spine: the Book of Mormon's 15 books. Ribbons are two-tone
// (quote core / phrase sheath).
export default function Overview({ state = {}, navigate }) {
  const mode = state.mode === "table" ? "table" : "chart";
  const isNarrow = useIsNarrow();
  const expanded = state.expanded || null; // Bible division name
  const setMode = (m) =>
    navigate({ view: "overview", mode: m === "table" ? "table" : undefined, expanded: expanded || undefined });
  const setExpanded = (name) =>
    navigate({ view: "overview", mode: mode === "table" ? "table" : undefined, expanded: name || undefined });
  const [active, setActive] = useState(null); // {type:'node'|'ribbon', key}
  const [tip, setTip] = useState(null); // { x, y, text } in wrap-relative px
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ width: 960, height: FALLBACK_H });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let frame = null;
    const measure = () => {
      frame = null;
      // bail when unchanged — the observer re-fires when the svg resizes the
      // wrapper, and echoing identical state back re-triggered it forever
      setSize((prev) => {
        const width = el.clientWidth || 960;
        const height = Math.max(el.clientHeight || 0, FALLBACK_H);
        return prev.width === width && prev.height === height
          ? prev
          : { width, height };
      });
    };
    const schedule = () => {
      if (frame == null) frame = requestAnimationFrame(measure);
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(schedule);
      ro.observe(el);
      return () => {
        ro.disconnect();
        if (frame != null) cancelAnimationFrame(frame);
      };
    }
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("resize", schedule);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, []);

  // Left spine: divisions, with one optionally expanded into its books.
  const { left, links } = useMemo(() => {
    const left = [];
    const leftBookSet = new Set();
    for (const group of canons.kjv.groups) {
      if (group.name === expanded) {
        for (const b of group.books) {
          const weight = bookTotal("kjv", b.name);
          if (!weight) continue; // zero-ref books carry no ribbons
          left.push({ key: b.name, weight, kind: "book", group: group.name });
          leftBookSet.add(b.name);
        }
      } else {
        const weight = group.books.reduce(
          (a, b) => a + bookTotal("kjv", b.name),
          0
        );
        if (!weight) continue;
        left.push({ key: group.name, weight, kind: "division" });
      }
    }
    const links = [];
    for (const p of divisionBookPairs()) {
      if (p.bibleGroup === expanded) continue;
      links.push({ left: p.bibleGroup, right: p.bomBookName, value: p.total, quotes: p.quotes });
    }
    if (expanded) {
      for (const p of allPairs()) {
        if (!leftBookSet.has(p.bibleBookName)) continue;
        links.push({ left: p.bibleBookName, right: p.bomBookName, value: p.total, quotes: p.quotes });
      }
    }
    return { left, links };
  }, [expanded]);

  const right = useMemo(
    () =>
      canons.bom.books
        .map((b) => ({ key: b.name, weight: bookTotal("bom", b.name) }))
        .filter((b) => b.weight > 0),
    []
  );

  const readout = useMemo(() => {
    if (!active) return null;
    if (active.type === "node") {
      const total = links
        .filter((l) => l.left === active.key || l.right === active.key)
        .reduce((a, l) => a + l.value, 0);
      return `${active.key} · ${total} references`;
    }
    const [rightKey, leftKey] = active.key.split("|");
    const link = links.find((l) => l.left === leftKey && l.right === rightKey);
    return link
      ? `${link.left} ↔ ${link.right} · ${link.value} references · ${link.quotes} quotes`
      : null;
  }, [active, links]);

  const plotH = size.height - 40;
  const n = Math.max(left.length, right.length, 1);
  // target a 14px floor; never demand more than the plot can evenly give (plotH/n),
  // which keeps small books at/above the ~9px label threshold whenever plotH allows.
  // (No /2 divisor — on a short viewport plotH/n is the largest floor that still fits
  // all n segments, so small slivers keep their labels down to plotH ≈ 9n.)
  const spineMinPx = Math.min(14, plotH / n);
  const { leftSpine, rightSpine, ribbons } = useMemo(
    () => layoutRibbons({ left, right, links, height: plotH, gap: 3, minPx: 1.5, spineMinPx }),
    [left, right, links, plotH, spineMinPx]
  );

  // reserve room for labels on wide screens; hug the edges on small ones
  const spineW = size.width < 700 ? 24 : 160;
  const x0 = spineW;
  const x1 = size.width - spineW;
  const maxValue = Math.max(...links.map((l) => l.value), 1);

  const isDimmed = (r) => {
    if (!active) return false;
    if (active.type === "node") return r.left !== active.key && r.right !== active.key;
    return `${r.right}|${r.left}` !== active.key;
  };

  const nodeProps = (key, label, onActivate) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    onClick: onActivate,
    onKeyDown: (e) => e.key === "Enter" && onActivate(),
    onMouseEnter: () => setActive({ type: "node", key }),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive({ type: "node", key }),
    onBlur: () => setActive(null),
  });

  const leftSegments = left.map((item) => {
    const pos = leftSpine.get(item.key);
    if (!pos) return null;
    const dim = active?.type === "node" && active.key !== item.key;
    const isBook = item.kind === "book";
    const label = isBook
      ? `${item.key}, ${bookTotal("kjv", item.key)} references, ${partnersFor("kjv", item.key).length} partner books`
      : `${item.key}, ${links
          .filter((l) => l.left === item.key)
          .reduce((a, l) => a + l.value, 0)} references, expand to books`;
    const onActivate = isBook
      ? () => navigate({ view: "anchor", canon: "kjv", book: item.key })
      : () => setExpanded(expanded === item.key ? null : item.key);
    const attrs = isBook ? { "data-book": item.key } : { "data-division": item.key };
    return (
      <g key={item.key} role="listitem">
        <rect
          {...attrs}
          {...nodeProps(item.key, label, onActivate)}
          className={`xref-spineseg ${isBook ? "book" : "division"} ${dim ? "dim" : ""}`}
          x={x0}
          y={pos.y0}
          width={16}
          height={Math.max(pos.y1 - pos.y0, 1)}
        />
        {pos.y1 - pos.y0 > 9 && (
          <text
            className="xref-spinelabel"
            x={x0 - LABEL_PAD}
            y={(pos.y0 + pos.y1) / 2}
            dominantBaseline="middle"
            textAnchor="end"
          >
            {item.key}
          </text>
        )}
      </g>
    );
  });

  const rightSegments = right.map(({ key: name }) => {
    const pos = rightSpine.get(name);
    if (!pos) return null;
    const dim = active?.type === "node" && active.key !== name;
    const label = `${name}, ${bookTotal("bom", name)} references, ${partnersFor("bom", name).length} partner books`;
    return (
      <g key={name} role="listitem">
        <rect
          data-book={name}
          {...nodeProps(name, label, () =>
            navigate({ view: "anchor", canon: "bom", book: name })
          )}
          className={`xref-spineseg book ${dim ? "dim" : ""}`}
          x={x1 - 16}
          y={pos.y0}
          width={16}
          height={Math.max(pos.y1 - pos.y0, 1)}
        />
        {pos.y1 - pos.y0 > 9 && (
          <text
            className="xref-spinelabel"
            x={x1 + LABEL_PAD}
            y={(pos.y0 + pos.y1) / 2}
            dominantBaseline="middle"
            textAnchor="start"
          >
            {name}
          </text>
        )}
      </g>
    );
  });

  const moveTip = (r, e) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    setTip({
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      text: `${r.left} ↔ ${r.right} · ${r.value} refs · ${r.quotes} quotes`,
    });
  };

  return (
    <div className="xref-overview" data-testid="xref-overview">
      <header className="xref-header">
        <h3 className="xref-title">Bible Quotes &amp; Phrases in the Book of Mormon</h3>
        <p className="xref-headline">
          {headline.total.toLocaleString("en-US")} connections ·{" "}
          <span>{headline.quotes.toLocaleString("en-US")} direct quotes</span>
          <span className="xref-legend">
            <span className="xref-swatch quote" /> quote
            <span className="xref-swatch phrase" /> phrase
          </span>
          {!isNarrow && (
            <button
              className="xref-modetoggle"
              aria-pressed={mode === "table"}
              onClick={() => setMode(mode === "chart" ? "table" : "chart")}
            >
              {mode === "chart" ? "View as table" : "View as chart"}
            </button>
          )}
          {expanded && mode === "chart" && (
            <button className="xref-modetoggle" onClick={() => setExpanded(null)}>
              ◂ collapse {expanded}
            </button>
          )}
        </p>
      </header>

      {mode === "table" || isNarrow ? (
        <TableTwin navigate={navigate} />
      ) : (
        <div className="xref-ribbonwrap">
          <p className="xref-hint">
            Click a Bible division to expand its books · click any book to explore it
          </p>
          <p className="xref-readout" data-testid="xref-readout" aria-live="polite">
            {readout || "Hover a ribbon or book for details"}
          </p>
          {/* wrapRef measures THIS box, which holds only the svg — its clientHeight
              is the flex-allocated leftover after hint/readout, never the svg's own
              height, so the ResizeObserver can't feed back through plotH. */}
          <div className="xref-svgbox" ref={wrapRef}>
          {tip && (
            <div
              className="xref-tip"
              aria-hidden="true"
              style={{ left: tip.x, top: tip.y }}
            >
              {tip.text}
            </div>
          )}
          <svg
            className="xref-ribbonsvg"
            width={size.width}
            height={plotH}
            role="img"
            aria-label={`Ribbon diagram of ${headline.total} Bible-to-Book-of-Mormon connections; use the table view for full detail`}
          >
            <text
              className="xref-spinetitle"
              x={size.width < 700 ? 0 : x0}
              y={12}
              textAnchor={size.width < 700 ? "start" : "end"}
            >
              Bible
            </text>
            <text
              className="xref-spinetitle"
              x={size.width < 700 ? size.width : x1}
              y={12}
              textAnchor={size.width < 700 ? "end" : "start"}
            >
              Book of Mormon
            </text>
            <g>
              {[...ribbons].sort((a, b) => a.value - b.value).map((r, i) => {
                const key = `${r.right}|${r.left}`;
                const quoteFrac = r.value ? r.quotes / r.value : 0;
                const lMid = r.lY0 + (r.lY1 - r.lY0) * quoteFrac;
                const rMid = r.rY0 + (r.rY1 - r.rY0) * quoteFrac;
                // de-emphasize the long tail: hairlines fade back, cables lead.
                const emphasis = 0.3 + 0.45 * Math.sqrt(r.value / maxValue);
                // a two-tone split thinner than ~3px reads as noise, not data
                const showQuoteCore =
                  quoteFrac > 0 && (lMid - r.lY0 >= 3 || rMid - r.rY0 >= 3);
                const target = {
                  view: "anchor",
                  canon: "bom",
                  book: r.right,
                  highlight: r.left, // book OR division — both resolve via ?hl=
                };
                return (
                  <g
                    key={key}
                    data-ribbon={key}
                    className={`xref-ribbon ${isDimmed(r) ? "dim" : ""}`}
                    style={{
                      "--i": i,
                      "--emphasis": emphasis,
                      pointerEvents: !active && r.value <= HAIRLINE ? "none" : undefined,
                    }}
                    onClick={() => navigate(target)}
                    onMouseEnter={() => setActive({ type: "ribbon", key })}
                    onMouseMove={(e) => moveTip(r, e)}
                    onMouseLeave={() => {
                      setActive(null);
                      setTip(null);
                    }}
                  >
                    <title>{`${r.left} ↔ ${r.right} · ${r.value} refs · ${r.quotes} quotes`}</title>
                    {showQuoteCore && (
                      <path
                        className="xref-ribbonquote"
                        d={ribbonPath({ lY0: r.lY0, lY1: lMid, rY0: r.rY0, rY1: rMid }, x0 + 16, x1 - 16)}
                      />
                    )}
                    <path
                      className="xref-ribbonphrase"
                      d={ribbonPath(
                        showQuoteCore
                          ? { lY0: lMid, lY1: r.lY1, rY0: rMid, rY1: r.rY1 }
                          : { lY0: r.lY0, lY1: r.lY1, rY0: r.rY0, rY1: r.rY1 },
                        x0 + 16,
                        x1 - 16
                      )}
                    />
                  </g>
                );
              })}
            </g>
            <g role="list" aria-label="Bible divisions and books">
              {leftSegments}
            </g>
            <g role="list" aria-label="Book of Mormon books">
              {rightSegments}
            </g>
          </svg>
          </div>
        </div>
      )}
    </div>
  );
}
