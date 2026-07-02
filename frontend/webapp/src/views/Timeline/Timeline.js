/** @format */

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react"
import Parser from "html-react-parser"
import { Link, useRouteMatch, useHistory } from "react-router-dom"
import { assetUrl } from "src/models/BoMOnlineAPI"
import BoMOnlineAPI from "src/models/BoMOnlineAPI"
import Loader from "../_Common/Loader"
import { label } from "src/models/Utils"
import tilesData from "./gridTiles.json"
import battleSlugs from './battleSlugs.json'
import "./Timeline.css"
import {
  bandVar, resolvedHex, textOn, humanize, cleanLabel, cornerStyleFor, buildComposite, markerCellPaint,
  anchorOf, chipBg, tierOf, tierVisible, formatAxisTick, isCenturyTick, apiMarkers, popoverPlace,
} from './timelineModel'
import { SWORDS, PIN, CHEV_L, CHEV_R } from './icons'
import TimelinePopover from './TimelinePopover'

// Legacy canvas battle tiles → icon-event marker descriptors. This is a
// STOPGAP data source: when bom_timeline rows gain grid placements +
// grid_icon='battle' (plan Task 7 gate), these tiles retire and DB icon-events
// feed the same marker path.
const canvasMarkers = tilesData.tiles
  .filter((t) => t.k === 'battle')
  .map((t) => ({ r: t.r, c: t.c, bg: t.bg, icon: 'battle' }))
const ZOOM_MIN = 0.4
const ZOOM_MAX = 2
const ZOOM_STEP = 1.2

// label() returns a single space when the i18n dictionary isn't loaded yet;
// treat blank as missing so the literal fallbacks apply.
const labelOr = (key, fallback) => (label(key) || "").trim() || fallback

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
  { c: "#274e13", t: "Nephite kings (Zarahemla)" },
  { c: "#bf9000", t: "Mulekites · missions" },
  { c: "#38761d", t: "Reign of the judges" },
  { c: "#6fa8dc", t: "Gadianton robbers" },
  { c: "#000000", t: "Cataclysmic Destruction" },
  { c: "#fff2cc", t: "After Christ" },
]

// Hover discovery: raw band color (sheet hex, identity key) → name.
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
  const [theme, setTheme] = useState('parchment')
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

  const isNarrow = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches

  const [place, setPlace] = useState(null)
  useLayoutEffect(() => {
    if (!showModal || isNarrow()) return setPlace(null)
    const node = cellRefs.current[selected]
    const grid = document.getElementById('tg-grid')
    if (!node || !grid) return setPlace(null)
    setPlace(
      popoverPlace(
        { left: node.offsetLeft, top: node.offsetTop,
          width: node.offsetWidth, height: node.offsetHeight },
        { w: 340, h: 420 },
        { w: grid.scrollWidth, h: grid.scrollHeight }
      )
    )
    // timeline: refs exist only after data renders; scale: zoom moves the anchor
  }, [showModal, selected, timeline, scale])

  // Modal a11y: Escape, focus-in + trap, focus-restore, and background scroll-lock.
  useEffect(() => {
    if (!showModal) return
    const opener = document.activeElement
    const prevOverflow = document.body.style.overflow
    if (isNarrow()) document.body.style.overflow = "hidden"
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

  // Merge canvas battle markers (from gridTiles.json) with any DB icon-events
  // arriving through the API. DB markers carry their own slug; canvas markers
  // fall back to the battleSlugs binding file in the render loop below.
  const markers = useMemo(() => [...canvasMarkers, ...apiMarkers(timeline || [])], [timeline])

  // Unified occupancy/compositing model — see timelineModel.buildComposite.
  // Depends on `timeline` (API bars are a layer) — rebuilds once data arrives.
  const comp = useMemo(() => buildComposite(tilesData, timeline || [], markers), [timeline, markers])
  const { markerFor } = comp

  // Fill tiles (lineage bands) never depend on selection/zoom — memoize so a
  // selection change doesn't re-render ~3,000 nodes.
  const fillEls = useMemo(() => {
    // Access via comp.* so eslint sees comp as the only external dep (bandAt and
    // holePatches are stable derivations of comp — listing comp covers them).
    const { bandAt: ba, holePatches: hp } = comp
    const els = tiles
      .filter((t) => t.k === "fill" && t.bg !== "#ffffff") // drop the stray white artifact cell
      .map((t) => (
        <div
          key={`f${t.r}-${t.c}`}
          className="tg-fill"
          data-lin={linKey(t.bg)}
          style={{ ...gridPos(t), background: bandVar(t.bg), ...cornerStyleFor(t, ba) }}
        />
      ))
    // enclosed single-color holes patched to the band color (interior, no rounding)
    for (const p of hp) {
      els.push(
        <div
          key={`hp${p.r}-${p.c}`}
          className="tg-fill"
          data-lin={linKey(p.bg)}
          style={{
            gridColumn: `${p.c + 1} / span 1`,
            gridRow: `${p.r} / span 1`,
            background: bandVar(p.bg),
          }}
        />
      )
    }
    return els
  }, [tiles, comp])

  // Canvas marks (hardcoded): location pins only. Battles are now icon-events
  // fed through canvasMarkers → the markerFor/markerCellPaint compositor path.
  const marks = useMemo(() => tiles.filter((t) => t.k !== "fill" && t.k !== "battle"), [tiles])

  // Events AND location pins come from the backend (Event.grid placement +
  // Event.label translated text). p distinguishes them: p=true → event tile,
  // p=false → location pin (📍). Clickable when the row has real content.
  const eventEls = useMemo(
    () =>
      (timeline || [])
        .filter((e) => e.grid && e.slug && !e.grid.icon)
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
          const anchor = anchorOf(e)
          const rawBg = chipBg(g, comp)            // identity hex (sheet value or sepia fallback)
          const tcol = textOn(resolvedHex(rawBg))  // contrast math needs a concrete hex, never a var()
          const linAttr = isPlace ? null : { "data-lin": linKey(g.bg) }
          const tier = tierOf(e)
          const cls =
            'tg-anchor ' + (isPlace ? 'tg-place' : 'tg-event') + ` tg-a-${anchor}` +
            ` tg-tier-${tier}` +
            (isPlace ? '' : tcol === '#fff' ? ' tg-on-dark' : ' tg-on-light') +
            (clickable ? ' is-clickable' : ' is-static') +
            (selected === e.slug ? ' is-selected' : '') +
            (tierVisible(tier, scale) ? '' : ' tg-lod-hidden')
          const inner = isPlace ? (
            <span><span className="tg-pin" aria-hidden="true">{PIN}</span> {label}</span>
          ) : (
            <span className="tg-event-label">
              {g.dir === 'l' && <span className="tg-chev" aria-hidden="true">{CHEV_L}</span>}
              {label}
              {g.dir === 'r' && <span className="tg-chev" aria-hidden="true">{CHEV_R}</span>}
            </span>
          )
          const rect = { r: g.row, c: g.col, w: g.colSpan, h: g.rowSpan }
          const capStyle = cornerStyleFor(rect, comp.barAt)
          const style = isPlace ? pos : { ...pos, background: bandVar(rawBg), color: tcol, ...capStyle }
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
            >
              {inner}
            </button>
          )
        }),
    [timeline, selected, openInfo, comp, scale]
  )

  if (!tiles || !tiles.length) return <Loader />

  return (
    <div className={'timeline-grid-wrap' + (theme === 'dark' ? ' tg-theme-dark' : '')}>
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
              <label className="tg-layers-item">
                <input type="checkbox" checked={theme === 'dark'}
                  onChange={(e) => setTheme(e.target.checked ? 'dark' : 'parchment')} />
                <span className="tg-layers-text" aria-hidden="true">◐</span>
                Dark canvas
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
                <span className="tg-key-sw" style={{ background: bandVar(l.c) }} aria-hidden="true" />
                {l.t}
              </li>
            ))}
            <li>
              <span className="tg-key-pin" aria-hidden="true">{PIN}</span>
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
          className={"timeline-grid" + (!layers.labels ? " tg-compact" : "")}
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
            <React.Fragment key={`dt${d.r}`}>
              <div className="tg-date" style={{ gridColumn: 1, gridRow: `${d.r} / span 1` }}>
                {formatAxisTick(d.t)}
              </div>
              {isCenturyTick(d.t) && (
                <div className="tg-century-rule" aria-hidden="true"
                     style={{ gridColumn: `2 / ${cols + 2}`, gridRow: `${d.r} / span 1` }} />
              )}
            </React.Fragment>
          ))}

          {fillEls}

          {marks.map((t) => {
            const key = `${t.k}-${t.r}-${t.c}`
            const pos = gridPos(t)

            const data = t.slug ? bySlug[t.slug] : null
            const heading = cleanLabel((data && data.heading) || t.t)
            const isPlace = t.k === "place"
            const placeName = cleanLabel(t.t)
            const inner = isPlace ? (
              <><span className="tg-pin" aria-hidden="true">{PIN}</span> {placeName}</>
            ) : heading
            const tipText = isPlace ? placeName : heading
            // Clickable iff it has a slug AND real content (t.nc, set at build
            // time for headingless labels, marks the empty-modal cases). Using
            // the build-time flag keeps this synchronous — no affordance flip
            // when the API resolves.
            const clickable = !!t.slug && !t.nc

            const tcol = textOn(resolvedHex(t.bg))
            const tone = isPlace ? "" : tcol === "#fff" ? " tg-on-dark" : " tg-on-light"

            if (!clickable) {
              return (
                <div
                  key={key}
                  className={`tg-anchor ${isPlace ? "tg-place" : "tg-event"}${isPlace ? " tg-a-above" : ""}${tone} tg-tier-3 is-static${tierVisible(3, scale) ? '' : ' tg-lod-hidden'}`}
                  style={isPlace ? pos : { ...pos, background: bandVar(t.bg), color: tcol }}
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
                  `tg-anchor ${isPlace ? "tg-place" : "tg-event"}${isPlace ? " tg-a-above" : ""}${tone} tg-tier-3 is-clickable` +
                  (selected === t.slug ? " is-selected" : "") +
                  (tierVisible(3, scale) ? '' : ' tg-lod-hidden')
                }
                style={isPlace ? pos : { ...pos, background: bandVar(t.bg), color: tcol }}
                onClick={() => openInfo(t.slug)}
                aria-label={data && data.date ? `${tipText}, ${data.date}` : tipText}
                title={data && data.date ? `${tipText} — ${data.date}` : tipText}
              >
                <span className={isPlace ? undefined : "tg-event-label"}>{inner}</span>
              </button>
            )
          })}

          {/* Battle markers — rendered through the unified compositor path.
              When layers.battles is ON: render the icon marker (with attacker tab
              for incursions). The cell background is only set for notch cells
              (paint non-null) — battles over a real surface never paint parchment.
              When layers.battles is OFF: only notch cells get a territory patch to
              keep band continuity; cells over real surfaces render nothing. */}
          {layers.battles && markers.map((m) => {
            const { incursion, territory, attacker } = markerFor(m)
            const paint = markerCellPaint(comp, m) // null when a real surface is beneath
            const slug = m.slug || battleSlugs[`${m.r},${m.c}`] || null
            const data = slug ? bySlug[slug] : null
            const clickable = !!(data && (data.heading || data.html))
            const battleLabel = clickable
              ? `Battle: ${cleanLabel(data.heading) || humanize(slug)}${data.date ? `, ${data.date}` : ''}`
              : 'Battle'
            const Cell = clickable ? 'button' : 'div'
            return (
              <Cell
                key={`mk-${m.r}-${m.c}`}
                {...(clickable
                  ? { type: 'button', onClick: () => openInfo(slug), 'aria-label': battleLabel,
                      ref: (n) => { if (n) cellRefs.current[slug] = n } }
                  : { role: 'img', 'aria-label': 'Battle', title: battleLabel })}
                className={
                  'tg-anchor tg-battle' + (incursion ? ' tg-battle-inc' : '') +
                  (clickable ? ' is-clickable' : '') + (selected === slug ? ' is-selected' : '')
                }
                style={paint
                  ? { gridColumn: `${m.c + 1} / span 1`, gridRow: `${m.r} / span 1`, background: bandVar(paint) }
                  : { gridColumn: `${m.c + 1} / span 1`, gridRow: `${m.r} / span 1` }}
                data-lin={territory ? linKey(territory) : undefined}
              >
                {incursion && (
                  <span
                    className="tg-battle-tab"
                    aria-hidden="true"
                    data-lin={linKey(attacker)}
                    style={{
                      background: bandVar(attacker),
                      borderTopRightRadius: 'calc(10px * var(--scale))',
                      borderBottomRightRadius: 'calc(10px * var(--scale))',
                    }}
                  />
                )}
                <span className="tg-battle-medallion">{SWORDS}</span>
              </Cell>
            )
          })}
          {!layers.battles && markers.map((m) => {
            const paint = markerCellPaint(comp, m)
            return paint ? (
              <div
                key={`mkp-${m.r}-${m.c}`}
                className="tg-fill"
                data-lin={linKey(paint)}
                style={{
                  gridColumn: `${m.c + 1} / span 1`,
                  gridRow: `${m.r} / span 1`,
                  background: bandVar(paint),
                }}
              />
            ) : null
          })}

          {/* events + location pins from the backend (Event.grid + Event.label) */}
          {eventEls}

          {place && (
            <TimelinePopover place={place} info={info} slug={selected} loading={loading}
              onClose={closeInfo} dialogRef={dialogRef} closeBtnRef={closeBtnRef} />
          )}
        </div>
      </div>

      {hoverLin && COLOR_NAMES[hoverLin] && (
        <div className="tg-statusbar" aria-live="polite">
          <span
            className="tg-status-sw"
            style={{ background: bandVar('#' + hoverLin) }}
            aria-hidden="true"
          />
          {COLOR_NAMES[hoverLin]}
        </div>
      )}

      {showModal && !place && (
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
