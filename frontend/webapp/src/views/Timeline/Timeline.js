/** @format */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Parser from "html-react-parser"
import { Link, useRouteMatch, useHistory } from "react-router-dom"
import { assetUrl } from "src/models/BoMOnlineAPI"
import BoMOnlineAPI from "src/models/BoMOnlineAPI"
import Loader from "../_Common/Loader"
import { label } from "src/models/Utils"
import tilesData from "./gridTiles.json"
import "./Timeline.css"

// Crossed-swords battle marker. currentColor lets the medallion theme it.
const SWORDS = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <line x1="6" y1="18" x2="18" y2="6" />
      <line x1="18" y1="18" x2="6" y2="6" />
    </g>
    <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <line x1="3.5" y1="13.5" x2="9" y2="19" />
      <line x1="15" y1="19" x2="20.5" y2="13.5" />
    </g>
  </svg>
)
const ZOOM_MIN = 0.4
const ZOOM_MAX = 2
const ZOOM_STEP = 1.2
// Below this effective scale, labels collide into an unreadable mass — hide them and let
// the colored bands carry the structure (click/zoom-in to read).
const LABEL_HIDE_BELOW = 0.55

// label() returns a single space when the i18n dictionary isn't loaded yet;
// treat blank as missing so the literal fallbacks apply.
const labelOr = (key, fallback) => (label(key) || "").trim() || fallback

// Fallback for entries with no translated label/heading: turn a kebab slug into
// a readable title (small words stay lowercase unless they lead).
const MINOR = new Set(["of", "the", "and", "vs", "in", "to", "a", "for"])
const humanize = (slug) =>
  (slug || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\S+/g, (w, i) =>
      i > 0 && MINOR.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)
    )

// A few source band colors don't render well: post-Christ cream (#fff2cc) is
// ~invisible on the parchment canvas. Remap at render time (also used for the
// legend swatch so the key matches the band).
const BG_FIX = {
  "#fff2cc": "#e6cf8c", // post-Christ cream: ~invisible on the parchment canvas
  "#274e13": "#2f6f4f", // Nephite-kings green: too close to the judges green
  "#6fa8dc": "#7d8596", // Gadianton blue: too close to Zeniff's blue
}
const fixBg = (c) => (c && BG_FIX[c]) || c

// Source names occasionally carry a disambiguation digit glued to a word
// ("Land of Bountiful1"); strip it for display. Roman numerals (Mosiah II) and
// leading book numbers (1 Nephi) are untouched.
const cleanLabel = (s) => (s || "").replace(/([A-Za-z])\d+\b/g, "$1")

// Black/white text for legibility over a band color (the sheet's per-cell fg is
// unreliable, so we derive contrast from the background).
function textOn(bg) {
  if (!bg) return "#222"
  const h = bg.replace("#", "")
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  const r = parseInt(n.slice(0, 2), 16),
    g = parseInt(n.slice(2, 4), 16),
    b = parseInt(n.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#222" : "#fff"
}

const RAD = `var(--rad)` // corner radius; --rad set on the grid, scales with zoom/fit

// Per-tile corner rounding computed from band occupancy (replaces the sparse,
// unreliable static `rd` glyph data). A corner is rounded ONLY when both of its
// orthogonal neighbour cells are empty parchment — i.e. it's a true outer
// perimeter corner of a self-contained band. Where another band (or the same
// band continuing) sits against that edge, the corner stays square — that's a
// junction/connector. Net effect: bands read as rounded ribbons with square
// joins, no hard corners except at intersections.
// Corner rounding — see docs/reference/timeline-corner-rounding.md.
// Round a corner IFF both orthogonal neighbours differ from this band AND the
// diagonal is empty parchment. That rounds true outer-perimeter corners and
// open-diagonal protrusions (revealing the parchment background, like prod's
// inter-segment gaps), while keeping junctions/intersections square: where the
// band continues (orthogonal == own) or where another band meets diagonally
// (handoff / ≥2 lineages). Reveal is always parchment — no underlying-band layer.
function cornerStyle(t, colorAt) {
  const own = t.bg
  const top = t.r,
    left = t.c,
    right = t.c + (t.w || 1) - 1,
    bottom = t.r + (t.h || 1) - 1
  const round = (oh, ov, od) => oh !== own && ov !== own && od === null
  const tl = round(colorAt(top, left - 1), colorAt(top - 1, left), colorAt(top - 1, left - 1))
  const tr = round(colorAt(top, right + 1), colorAt(top - 1, right), colorAt(top - 1, right + 1))
  const bl = round(colorAt(bottom, left - 1), colorAt(bottom + 1, left), colorAt(bottom + 1, left - 1))
  const br = round(colorAt(bottom, right + 1), colorAt(bottom + 1, right), colorAt(bottom + 1, right + 1))
  if (!(tl || tr || bl || br)) return undefined
  return {
    borderTopLeftRadius: tl ? RAD : 0,
    borderTopRightRadius: tr ? RAD : 0,
    borderBottomLeftRadius: bl ? RAD : 0,
    borderBottomRightRadius: br ? RAD : 0,
  }
}

// Verified color → lineage mapping, derived from each event's grid_bg (the
// migration design doc's mapping was wrong — e.g. maroon is Lamanites, not
// Nephites). Drives the legend. Ordered roughly by first appearance.
const LINEAGES = [
  { c: "#134f5c", t: "Jaredites" },
  { c: "#351c75", t: "Lehi’s family" },
  { c: "#1c4587", t: "Nephites (Land of Nephi)" },
  { c: "#85200c", t: "Lamanites" },
  { c: "#3c78d8", t: "Zeniff’s colony" },
  { c: "#b45f06", t: "Alma’s people" },
  { c: "#2f6f4f", t: "Nephite kings (Zarahemla)" },
  { c: "#bf9000", t: "Mulekites · missions" },
  { c: "#38761d", t: "Reign of the judges" },
  { c: "#7d8596", t: "Gadianton robbers" },
  { c: "#000000", t: "Cataclysmic Destruction" },
  { c: "#e6cf8c", t: "After Christ" },
]

// Hover discovery: raw band color (as stored in the data, pre-fixBg) → name.
// Keyed without the leading "#" so it doubles as the data-lin attribute value.
const COLOR_NAMES = {
  "134f5c": "Jaredites",
  "351c75": "Lehi’s family",
  "1c4587": "Nephites (Land of Nephi)",
  "073763": "Nephite lands",
  "85200c": "Lamanites",
  "3c78d8": "Zeniff’s colony",
  "b45f06": "Alma’s people",
  "274e13": "Nephite kings (Zarahemla)",
  "bf9000": "Mulekites · missions",
  "38761d": "Reign of the judges",
  "6fa8dc": "Gadianton robbers",
  "000000": "Cataclysmic Destruction",
  "fff2cc": "After Christ",
}
const linKey = (bg) => (bg ? bg.replace("#", "") : null)

const gridPos = (t) => ({
  gridColumn: `${t.c + 1} / span ${t.w}`, // +1: column 1 is the date gutter
  gridRow: `${t.r} / span ${t.h}`,
})

// Dominant surrounding band color for a marker cell (which has no fill of its
// own). Used to detect a battle that is an *incursion* into another people's
// territory (e.g. a Lamanite battle inside Nephite lands).
function dominantNeighbor(t, colorAt) {
  const ns = [
    colorAt(t.r - 1, t.c),
    colorAt(t.r + 1, t.c),
    colorAt(t.r, t.c - 1),
    colorAt(t.r, t.c + 1),
    colorAt(t.r, t.c - 2),
    colorAt(t.r, t.c + 2),
  ].filter(Boolean)
  if (!ns.length) return null
  const count = {}
  let best = null,
    bestN = 0
  for (const c of ns) {
    count[c] = (count[c] || 0) + 1
    if (count[c] > bestN) {
      bestN = count[c]
      best = c
    }
  }
  return best
}

function TimeLine() {
  useEffect(() => {
    document.title = `${labelOr("menu_timeline", "Timeline")} | ${labelOr(
      "home_title",
      "Book of Mormon Online"
    )}`
  }, [])

  const [timeline, setTimeline] = useState(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const [layers, setLayers] = useState({ battles: true, labels: true })
  const [hoverLin, setHoverLin] = useState(null) // band key currently hovered
  const [zoom, setZoom] = useState(1)
  // Responsive base: shrink the whole grid to fit the viewport width (keeping the
  // cell aspect ratio) so we never need a horizontal scrollbar at rest; capped at
  // 1 so we honor the natural max-width when there's room. zoom multiplies this.
  const [fitScale, setFitScale] = useState(1)
  const match = useRouteMatch()
  const routerHistory = useHistory()
  const markerSlug = (match.params && match.params.markerSlug) || null
  const cellRefs = useRef({})
  const closeBtnRef = useRef(null)
  const dialogRef = useRef(null)
  const scrollerRef = useRef(null)

  const zoomBy = (f) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z * f).toFixed(2))))

  // Natural (scale-1) grid width: date gutter + cols × col width (must match CSS).
  const naturalW = 70 + (tilesData.cols || 0) * 26
  useEffect(() => {
    const el = scrollerRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    let raf = 0
    const recompute = () => {
      const avail = el.clientWidth - 40 // grid right padding
      const next = Math.min(1, Math.max(0.2, avail / naturalW))
      // epsilon guard avoids re-render thrash from scrollbar width flips
      setFitScale((prev) => (Math.abs(next - prev) < 0.005 ? prev : next))
    }
    // Defer to the next frame so the observer callback never mutates layout in
    // the same tick — that's what throws "ResizeObserver loop completed with
    // undelivered notifications" (which CRA surfaces as a fatal overlay).
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(recompute)
    })
    ro.observe(el)
    recompute()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [naturalW])

  const scale = +(zoom * fitScale).toFixed(3)

  useEffect(() => {
    // Bypass the IndexedDB cache: a copy cached before the grid migration has no
    // `grid` field, so eventEls would filter every event out (no labels) and the
    // cache hit means no server refetch ever happens. The timeline is small and
    // its grid placement is essential, so always fetch it fresh.
    BoMOnlineAPI({ timeline: true }, { useCache: false })
      .then((r) => setTimeline((r && r.timeline) || []))
      .catch(() => setTimeline([]))
  }, [])

  const bySlug = useMemo(() => {
    const m = {}
    for (const t of timeline || []) m[t.slug] = t
    return m
  }, [timeline])

  // Selection is derived from the URL so browser Back/Forward stay in sync.
  const selected = markerSlug
  useEffect(() => {
    if (markerSlug && timeline) {
      const node = cellRefs.current[markerSlug]
      if (node) node.scrollIntoView({ block: "center", inline: "center" })
    }
  }, [markerSlug, timeline])

  const openInfo = useCallback(
    (slug) => slug && routerHistory.push(`/timeline/${slug}`),
    [routerHistory]
  )
  const closeInfo = useCallback(() => routerHistory.push(`/timeline`), [routerHistory])

  const { cols, rows, tiles, dateAxis = [] } = tilesData
  const loading = timeline === null
  const info = selected && !loading ? bySlug[selected] : null
  const showModal = !!selected && (info || loading)

  // Modal a11y: Escape, focus-in + trap, focus-restore, and background scroll-lock.
  useEffect(() => {
    if (!showModal) return
    const opener = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e) => {
      if (e.key === "Escape") return closeInfo()
      if (e.key !== "Tab" || !dialogRef.current) return
      const f = dialogRef.current.querySelectorAll(
        'a[href],button,[tabindex]:not([tabindex="-1"])'
      )
      if (!f.length) return
      const first = f[0],
        last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    if (closeBtnRef.current) closeBtnRef.current.focus()
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
      if (opener && opener.focus) opener.focus()
    }
  }, [showModal, closeInfo])

  // Band occupancy map (cell → raw color) drives the corner-rounding algorithm.
  // Battle cells are folded in with their *effective* band color so the national
  // area stays continuous beneath them (no parchment notches rounding around the
  // battle): a home battle counts as its own band; an incursion counts as the
  // territory it sits in (the attacker chip is drawn on top).
  const { colorAt, battleInfo, holePatches } = useMemo(() => {
    const fill = new Map()
    for (const t of tiles) {
      if (t.k !== "fill" || t.bg === "#ffffff") continue
      for (let dr = 0; dr < (t.h || 1); dr++)
        for (let dc = 0; dc < (t.w || 1); dc++) fill.set(`${t.r + dr},${t.c + dc}`, t.bg)
    }
    const fillAt = (r, c) => fill.get(`${r},${c}`) || null
    const combined = new Map(fill)
    const info = new Map()
    for (const t of tiles) {
      if (t.k !== "battle") continue
      const surround = dominantNeighbor(t, fillAt)
      const incursion = !!(surround && surround !== t.bg)
      const eff = incursion ? surround : t.bg
      info.set(`${t.r},${t.c}`, { incursion, eff })
      combined.set(`${t.r},${t.c}`, eff)
    }

    // Fill enclosed single-color holes (e.g. the Helam band's interior gap) so
    // they don't render as parchment notches/rectangles inside a band. A hole is
    // an interior empty region not connected to the outside; fill it ONLY when it
    // borders exactly one band color (duration-bar gaps border 2+ colors and are
    // left alone). Filling also stops the corner algorithm rounding into the hole.
    const rows = tilesData.rows,
      cols = tilesData.cols
    const isEmpty = (r, c) => !combined.has(`${r},${c}`)
    const outside = new Set()
    const st = []
    for (let c = 0; c <= cols + 1; c++) st.push([0, c], [rows + 1, c])
    for (let r = 0; r <= rows + 1; r++) st.push([r, 0], [r, cols + 1])
    while (st.length) {
      const [r, c] = st.pop()
      if (r < 0 || r > rows + 1 || c < 0 || c > cols + 1) continue
      const k = `${r},${c}`
      if (outside.has(k) || !isEmpty(r, c)) continue
      outside.add(k)
      st.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1])
    }
    const holePatches = []
    const seen = new Set()
    for (let r = 1; r <= rows; r++)
      for (let c = 1; c <= cols; c++) {
        const k = `${r},${c}`
        if (!isEmpty(r, c) || outside.has(k) || seen.has(k)) continue
        const comp = []
        const colors = new Set()
        const q = [[r, c]]
        seen.add(k)
        while (q.length) {
          const [rr, cc] = q.pop()
          comp.push([rr, cc])
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nr = rr + dr,
              nc = cc + dc,
              nk = `${nr},${nc}`
            const nv = combined.get(nk)
            if (nv) colors.add(nv)
            else if (isEmpty(nr, nc) && !outside.has(nk) && !seen.has(nk)) {
              seen.add(nk)
              q.push([nr, nc])
            }
          }
        }
        if (colors.size === 1) {
          const col = [...colors][0]
          for (const [rr, cc] of comp) {
            combined.set(`${rr},${cc}`, col)
            holePatches.push({ r: rr, c: cc, bg: col })
          }
        }
      }

    return {
      colorAt: (r, c) => combined.get(`${r},${c}`) || null,
      battleInfo: (t) => info.get(`${t.r},${t.c}`) || { incursion: false, eff: t.bg },
      holePatches,
    }
  }, [tiles])

  // Fill tiles (lineage bands) never depend on selection/zoom — memoize so a
  // selection change doesn't re-render ~3,000 nodes.
  const fillEls = useMemo(() => {
    const els = tiles
      .filter((t) => t.k === "fill" && t.bg !== "#ffffff") // drop the stray white artifact cell
      .map((t) => (
        <div
          key={`f${t.r}-${t.c}`}
          className="tg-fill"
          data-lin={linKey(t.bg)}
          style={{ ...gridPos(t), background: fixBg(t.bg), ...cornerStyle(t, colorAt) }}
        />
      ))
    // enclosed single-color holes patched to the band color (interior, no rounding)
    for (const p of holePatches) {
      els.push(
        <div
          key={`hp${p.r}-${p.c}`}
          className="tg-fill"
          data-lin={linKey(p.bg)}
          style={{
            gridColumn: `${p.c + 1} / span 1`,
            gridRow: `${p.r} / span 1`,
            background: fixBg(p.bg),
          }}
        />
      )
    }
    return els
  }, [tiles, colorAt, holePatches])

  // Canvas marks (hardcoded): location pins + battle icons. No events here.
  const marks = useMemo(() => tiles.filter((t) => t.k !== "fill"), [tiles])

  // Events AND location pins come from the backend (Event.grid placement +
  // Event.label translated text). p distinguishes them: p=true → event tile,
  // p=false → location pin (📍). Clickable when the row has real content.
  const eventEls = useMemo(
    () =>
      (timeline || [])
        .filter((e) => e.grid && e.slug)
        .map((e) => {
          const g = e.grid
          const isPlace = !e.p
          const label = cleanLabel(e.label || e.heading || humanize(e.slug))
          const clickable = !!(e.heading || e.html)
          const pos = {
            gridColumn: `${g.col + 1} / span ${g.colSpan}`,
            gridRow: `${g.row} / span ${g.rowSpan}`,
          }
          const ref = (n) => {
            if (n) cellRefs.current[e.slug] = n
          }
          const bg = fixBg(g.bg)
          const tcol = textOn(bg)
          const linAttr = isPlace ? null : { "data-lin": linKey(g.bg) }
          const cls =
            "tg-anchor " +
            (isPlace ? "tg-place" : "tg-event") +
            (isPlace ? "" : tcol === "#fff" ? " tg-on-dark" : " tg-on-light") +
            (clickable ? " is-clickable" : " is-static") +
            (selected === e.slug ? " is-selected" : "")
          const inner = isPlace ? (
            <span>📍 {label}</span>
          ) : (
            <span className="tg-event-label">{label}</span>
          )
          const style = isPlace ? pos : { ...pos, background: bg || "#5a5a5a", color: tcol }
          if (!clickable) {
            return (
              <div
                key={`e-${e.slug}-${g.row}-${g.col}`}
                ref={ref}
                className={cls}
                style={style}
                title={e.date ? `${label} — ${e.date}` : label}
                {...linAttr}
              >
                {inner}
              </div>
            )
          }
          return (
            <button
              key={`e-${e.slug}-${g.row}-${g.col}`}
              type="button"
              ref={ref}
              className={cls}
              style={style}
              {...linAttr}
              onClick={() => openInfo(e.slug)}
              aria-label={e.date ? `${label}, ${e.date}` : label}
              title={e.date ? `${label} — ${e.date}` : label}
            >
              {inner}
            </button>
          )
        }),
    [timeline, selected, openInfo]
  )

  if (!tiles || !tiles.length) return <Loader />

  return (
    <div className="timeline-grid-wrap">
      <a className="tg-skip" href="#tg-grid">
        Skip to timeline
      </a>

      <header className="tg-titlebar">
        <h1 className="tg-title">Book of Mormon Timeline</h1>
        <button
          type="button"
          className="tg-info-toggle"
          onClick={() => setInfoOpen((o) => !o)}
          aria-expanded={infoOpen}
          aria-controls="tg-infopanel"
        >
          <span aria-hidden="true">ⓘ</span> How to read
        </button>
        <div className="tg-layers">
          <button
            type="button"
            className="tg-info-toggle"
            onClick={() => setLayersOpen((o) => !o)}
            aria-expanded={layersOpen}
            aria-controls="tg-layers-menu"
          >
            <span aria-hidden="true">⧉</span> Layers
          </button>
          {layersOpen && (
            <div className="tg-layers-menu" id="tg-layers-menu" role="group" aria-label="Layers">
              <label className="tg-layers-item">
                <input
                  type="checkbox"
                  checked={layers.battles}
                  onChange={(e) => setLayers((l) => ({ ...l, battles: e.target.checked }))}
                />
                <span className="tg-layers-mini" aria-hidden="true">
                  {SWORDS}
                </span>
                Battles
              </label>
              <label className="tg-layers-item">
                <input
                  type="checkbox"
                  checked={layers.labels}
                  onChange={(e) => setLayers((l) => ({ ...l, labels: e.target.checked }))}
                />
                <span className="tg-layers-text" aria-hidden="true">
                  Aa
                </span>
                Labels
              </label>
            </div>
          )}
        </div>
        <div className="tg-zoom" role="group" aria-label="Zoom timeline">
          <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label="Zoom out" title="Zoom out">
            −
          </button>
          <button type="button" onClick={() => setZoom(1)} aria-label="Reset zoom" title="Reset zoom">
            ⤢
          </button>
          <button type="button" onClick={() => zoomBy(ZOOM_STEP)} aria-label="Zoom in" title="Zoom in">
            +
          </button>
        </div>
      </header>

      {infoOpen && (
        <div className="tg-infopanel" id="tg-infopanel">
          <p className="tg-infopanel-note">
            Time runs <strong>top → bottom</strong> (dates at left, approximate). Each column band
            is a people or land of the record. Hover a band to highlight it; click an event for
            details.
          </p>
          <ul className="tg-infopanel-keys">
            {LINEAGES.map((l) => (
              <li key={l.c}>
                <span className="tg-key-sw" style={{ background: l.c }} aria-hidden="true" />
                {l.t}
              </li>
            ))}
            <li>
              <span className="tg-key-pin" aria-hidden="true">
                📍
              </span>
              Place / land
            </li>
            <li>
              <span className="tg-key-mini" aria-hidden="true">
                {SWORDS}
              </span>
              Battle
            </li>
          </ul>
        </div>
      )}

      <div className="timeline-grid-scroller" ref={scrollerRef}>
        <div
          id="tg-grid"
          tabIndex={-1}
          className={
            "timeline-grid" + (scale < LABEL_HIDE_BELOW || !layers.labels ? " tg-compact" : "")
          }
          role="region"
          aria-label="Book of Mormon timeline — events by lineage and date. Use Tab to move between events."
          style={{ "--cols": cols, "--rows": rows, "--scale": scale }}
          data-hover={hoverLin || undefined}
          onMouseOver={(e) => {
            const el = e.target.closest("[data-lin]")
            setHoverLin(el ? el.getAttribute("data-lin") : null)
          }}
          onMouseLeave={() => setHoverLin(null)}
        >
          {/* opaque continuous backing so the gutter masks content on every row */}
          <div className="tg-gutter-bg" style={{ gridColumn: 1, gridRow: `1 / ${rows + 1}` }} />
          {dateAxis.map((d) => (
            <div
              key={`dt${d.r}`}
              className="tg-date"
              style={{ gridColumn: 1, gridRow: `${d.r} / span 1` }}
            >
              {d.t}
            </div>
          ))}

          {fillEls}

          {marks.map((t) => {
            const key = `${t.k}-${t.r}-${t.c}`
            const pos = gridPos(t)

            if (t.k === "battle") {
              const { incursion, eff } = battleInfo(t)
              // Battles layer off: keep the band continuous (territory fill) but
              // drop the marker — no parchment hole where the battle cell was.
              if (!layers.battles) {
                return (
                  <div
                    key={key}
                    className="tg-fill"
                    style={{ ...pos, background: fixBg(eff) }}
                    data-lin={linKey(eff)}
                  />
                )
              }
              // Marker — non-interactive, announced/tooltipped as "Battle". A
              // battle whose own color differs from the surrounding band is an
              // *incursion* (Lamanites into Nephite land): the attacker land
              // encroaches one cell with TR+BR rounding, medallion on top.
              // Incursion: the attacker's land encroaches ONE cell into the
              // defender's territory — a tab of attacker color with its right
              // corners (TR+BR) rounded, revealing the territory behind, with the
              // battle medallion on top. Home battle: just the medallion on the band.
              const cellBg = fixBg(eff)
              // Layered cell: the base carries the territory color (data-lin = eff)
              // so highlighting the territory band ALSO lights up this cell; the
              // attacker tab is its own layer (data-lin = t.bg) that lights up with
              // the attacker band.
              return (
                <div
                  key={key}
                  className={"tg-anchor tg-battle" + (incursion ? " tg-battle-inc" : "")}
                  style={{ ...pos, background: cellBg }}
                  data-lin={linKey(eff)}
                  role="img"
                  aria-label="Battle"
                  title="Battle"
                >
                  {incursion && (
                    <span
                      className="tg-battle-tab"
                      aria-hidden="true"
                      data-lin={linKey(t.bg)}
                      style={{
                        background: fixBg(t.bg),
                        borderTopRightRadius: RAD,
                        borderBottomRightRadius: RAD,
                      }}
                    />
                  )}
                  <span className="tg-battle-medallion">{SWORDS}</span>
                </div>
              )
            }

            const data = t.slug ? bySlug[t.slug] : null
            const heading = cleanLabel((data && data.heading) || t.t)
            const isPlace = t.k === "place"
            const placeName = cleanLabel(t.t)
            const inner = isPlace ? `📍 ${placeName}` : heading
            const tipText = isPlace ? placeName : heading
            // Clickable iff it has a slug AND real content (t.nc, set at build
            // time for headingless labels, marks the empty-modal cases). Using
            // the build-time flag keeps this synchronous — no affordance flip
            // when the API resolves.
            const clickable = !!t.slug && !t.nc

            const bg = fixBg(t.bg)
            const tcol = textOn(bg)
            const tone = isPlace ? "" : tcol === "#fff" ? " tg-on-dark" : " tg-on-light"

            if (!clickable) {
              return (
                <div
                  key={key}
                  className={`tg-anchor ${isPlace ? "tg-place" : "tg-event"}${tone} is-static`}
                  style={isPlace ? pos : { ...pos, background: bg, color: tcol }}
                  title={tipText}
                >
                  <span className={isPlace ? undefined : "tg-event-label"}>{inner}</span>
                </div>
              )
            }

            return (
              <button
                key={key}
                type="button"
                ref={(n) => {
                  if (n) cellRefs.current[t.slug] = n
                }}
                className={
                  `tg-anchor ${isPlace ? "tg-place" : "tg-event"}${tone} is-clickable` +
                  (selected === t.slug ? " is-selected" : "")
                }
                style={isPlace ? pos : { ...pos, background: bg, color: tcol }}
                onClick={() => openInfo(t.slug)}
                aria-label={data && data.date ? `${tipText}, ${data.date}` : tipText}
                title={data && data.date ? `${tipText} — ${data.date}` : tipText}
              >
                <span className={isPlace ? undefined : "tg-event-label"}>{inner}</span>
              </button>
            )
          })}

          {/* events + location pins from the backend (Event.grid + Event.label) */}
          {eventEls}
        </div>
      </div>

      {hoverLin && COLOR_NAMES[hoverLin] && (
        <div className="tg-statusbar" aria-live="polite">
          <span
            className="tg-status-sw"
            style={{ background: fixBg("#" + hoverLin) }}
            aria-hidden="true"
          />
          {COLOR_NAMES[hoverLin]}
        </div>
      )}

      {showModal && (
        <div className="tg-infobox-backdrop" onClick={closeInfo}>
          <div
            className="tg-infobox"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tg-infobox-title"
            ref={dialogRef}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="tg-infobox-close"
              onClick={closeInfo}
              aria-label="Close"
              ref={closeBtnRef}
            >
              ×
            </button>
            {info ? (
              <>
                <div className="tg-infobox-head">
                  <h2 id="tg-infobox-title">{cleanLabel(info.heading) || selected}</h2>
                  {info.date && <span className="tg-infobox-date">{info.date}</span>}
                </div>
                <div
                  className="tg-infobox-art"
                  role="img"
                  aria-label={cleanLabel(info.heading) || selected}
                  style={{ backgroundImage: `url(${assetUrl}/timeline/art/${info.slug})` }}
                />
                {info.html && <div className="tg-infobox-body">{Parser(info.html)}</div>}
                {info.text && info.text.slug && (
                  <Link className="tg-infobox-link" to={`/${info.text.slug}`}>
                    Read in the Book of Mormon →
                  </Link>
                )}
              </>
            ) : (
              <div className="tg-infobox-loading">
                <h2 id="tg-infobox-title">Loading…</h2>
                <Loader />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TimeLine
