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

const RADIUS = "10px"
const ZOOM_MIN = 0.4
const ZOOM_MAX = 2
const ZOOM_STEP = 1.2
const MOBILE_BREAKPOINT = 640
const MOBILE_ZOOM = 0.6
// Below this zoom, labels collide into an unreadable mass — hide them and let
// the colored bands carry the structure (click/zoom-in to read).
const LABEL_HIDE_BELOW = 0.55

// label() returns a single space when the i18n dictionary isn't loaded yet;
// treat blank as missing so the literal fallbacks apply.
const labelOr = (key, fallback) => (label(key) || "").trim() || fallback

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

// border-radius from a fill tile's rounded-corner list (◜◝◟◞/◗ glyphs).
function cornerRadius(rd) {
  if (!rd || !rd.length) return undefined
  return {
    borderTopLeftRadius: rd.includes("tl") ? RADIUS : 0,
    borderTopRightRadius: rd.includes("tr") ? RADIUS : 0,
    borderBottomLeftRadius: rd.includes("bl") ? RADIUS : 0,
    borderBottomRightRadius: rd.includes("br") ? RADIUS : 0,
  }
}

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
  const [zoom, setZoom] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT
      ? MOBILE_ZOOM
      : 1
  )
  const match = useRouteMatch()
  const routerHistory = useHistory()
  const markerSlug = (match.params && match.params.markerSlug) || null
  const cellRefs = useRef({})
  const closeBtnRef = useRef(null)
  const dialogRef = useRef(null)

  const zoomBy = (f) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z * f).toFixed(2))))

  useEffect(() => {
    BoMOnlineAPI({ timeline: true })
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

  // Fill tiles (lineage bands) never depend on selection/zoom — memoize so a
  // selection change doesn't re-render ~3,000 nodes.
  const fillEls = useMemo(
    () =>
      tiles
        .filter((t) => t.k === "fill")
        .map((t) => (
          <div
            key={`f${t.r}-${t.c}`}
            className="tg-fill"
            style={{ ...gridPos(t), background: t.bg, ...cornerRadius(t.rd) }}
          />
        )),
    [tiles]
  )

  const marks = useMemo(() => tiles.filter((t) => t.k !== "fill"), [tiles])

  if (!tiles || !tiles.length) return <Loader />

  return (
    <div className="timeline-grid-wrap">
      <div className="tg-zoom" role="group" aria-label="Zoom timeline">
        <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={() => setZoom(1)} aria-label="Reset zoom">
          ⤢
        </button>
        <button type="button" onClick={() => zoomBy(ZOOM_STEP)} aria-label="Zoom in">
          +
        </button>
      </div>
      <div className="timeline-grid-scroller">
        <div
          className={"timeline-grid" + (zoom < LABEL_HIDE_BELOW ? " tg-compact" : "")}
          role="region"
          aria-label="Book of Mormon timeline — events by lineage and date"
          style={{ "--cols": cols, "--rows": rows, "--scale": zoom }}
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
              // Decorative marker — no content; non-interactive, hidden from AT.
              return (
                <div key={key} className="tg-anchor tg-battle" style={pos} aria-hidden="true">
                  <span>💥</span>
                </div>
              )
            }

            const data = t.slug ? bySlug[t.slug] : null
            const heading = (data && data.heading) || t.t
            const isPlace = t.k === "place"
            const inner = isPlace ? `📍 ${t.t}` : heading

            if (!t.slug) {
              // No linked event — render as a static, non-interactive label.
              return (
                <div
                  key={key}
                  className={`tg-anchor ${isPlace ? "tg-place" : "tg-event"} is-static`}
                  style={isPlace ? pos : { ...pos, background: t.bg, color: textOn(t.bg) }}
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
                  `tg-anchor ${isPlace ? "tg-place" : "tg-event"} is-clickable` +
                  (selected === t.slug ? " is-selected" : "")
                }
                style={isPlace ? pos : { ...pos, background: t.bg, color: textOn(t.bg) }}
                onClick={() => openInfo(t.slug)}
                aria-label={data && data.date ? `${heading}, ${data.date}` : heading}
                title={data && data.date ? `${heading} — ${data.date}` : heading}
              >
                <span className={isPlace ? undefined : "tg-event-label"}>{inner}</span>
              </button>
            )
          })}
        </div>
      </div>

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
                  <h2 id="tg-infobox-title">{info.heading || selected}</h2>
                  {info.date && <span className="tg-infobox-date">{info.date}</span>}
                </div>
                <div
                  className="tg-infobox-art"
                  role="img"
                  aria-label={info.heading || selected}
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
