/** @format */

import React, { useState, useEffect, useMemo, useRef } from "react"
import Parser from "html-react-parser"
import { Link, useRouteMatch, useHistory } from "react-router-dom"
import { assetUrl } from "src/models/BoMOnlineAPI"
import BoMOnlineAPI from "src/models/BoMOnlineAPI"
import Loader from "../_Common/Loader"
import { replaceNumbers, label } from "src/models/Utils"
import tilesData from "./gridTiles.json"
import "./Timeline.css"

const RADIUS = "10px"

// Black/white text for legibility over a band color (the sheet's per-cell fg
// is unreliable — often equal to its bg — so we derive contrast).
function textOn(bg) {
  if (!bg) return "#222"
  const h = bg.replace("#", "")
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  const r = parseInt(n.slice(0, 2), 16),
    g = parseInt(n.slice(2, 4), 16),
    b = parseInt(n.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#222" : "#fff"
}

// border-radius from the tile's rounded-corner list (◜◝◟◞/◗ glyphs)
function cornerRadius(rd) {
  if (!rd || !rd.length) return {}
  return {
    borderTopLeftRadius: rd.includes("tl") ? RADIUS : 0,
    borderTopRightRadius: rd.includes("tr") ? RADIUS : 0,
    borderBottomLeftRadius: rd.includes("bl") ? RADIUS : 0,
    borderBottomRightRadius: rd.includes("br") ? RADIUS : 0,
  }
}

function TimeLine() {
  useEffect(() => {
    const t = label("menu_timeline") || "Timeline"
    const home = label("home_title") || "Book of Mormon Online"
    document.title = `${t} | ${home}`
  }, [])

  const [timeline, setTimeline] = useState(null)
  const [selected, setSelected] = useState(null)
  // Map-style zoom via a --scale custom prop (layout-correct + sticky-safe,
  // unlike CSS `zoom`). Start zoomed-out on small screens.
  const [zoom, setZoom] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 640 ? 0.6 : 1
  )
  const match = useRouteMatch()
  const routerHistory = useHistory()
  const markerSlug = (match.params && match.params.markerSlug) || null
  const cellRefs = useRef({})

  const zoomBy = (f) => setZoom((z) => Math.min(2, Math.max(0.4, +(z * f).toFixed(2))))

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
  // (Navigate via the Router's own history; a second history instance would
  // not update match.params.)
  useEffect(() => {
    setSelected(markerSlug)
    if (markerSlug && timeline) {
      const node = cellRefs.current[markerSlug]
      if (node) node.scrollIntoView({ block: "center", inline: "center" })
    }
  }, [markerSlug, timeline])

  const openInfo = (slug) => slug && routerHistory.push(`/timeline/${slug}`)
  const closeInfo = () => routerHistory.push(`/timeline`)

  // Modal a11y: Escape to close, focus into the dialog on open, trap Tab,
  // and restore focus to the opener on close.
  const closeBtnRef = useRef(null)
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!selected) return
    const opener = document.activeElement
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
      if (opener && opener.focus) opener.focus()
    }
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  // The grid is static (tilesData) — render it immediately; only the modal's
  // content needs the GraphQL call, so don't gate the whole feature on it.
  const { cols, rows, tiles, dateAxis = [] } = tilesData
  const loading = timeline === null
  const info = selected && !loading ? bySlug[selected] : null
  // Show the modal when an event is selected and we either have its data or
  // are still loading it; a loaded-but-unknown slug renders nothing (graceful).
  const showModal = !!selected && (info || loading)

  // Column 1 is the sticky date gutter; content tiles are shifted +1 column.
  const fills = tiles.filter((t) => t.k === "fill")
  const marks = tiles.filter((t) => t.k !== "fill")

  return (
    <div className="timeline-grid-wrap">
      <div className="tg-zoom" role="group" aria-label="Zoom timeline">
        <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => setZoom(1)} aria-label="Reset zoom">⤢</button>
        <button type="button" onClick={() => zoomBy(1.2)} aria-label="Zoom in">+</button>
      </div>
      <div className="timeline-grid-scroller">
        <div
          className="timeline-grid"
          style={{ "--cols": cols, "--rows": rows, "--scale": zoom }}
        >
          {/* opaque, continuous sticky backing so the gutter masks content on
              every row during horizontal scroll (not just dated rows) */}
          <div
            className="tg-gutter-bg"
            style={{ gridColumn: 1, gridRow: `1 / ${rows + 1}` }}
          />
          {dateAxis.map((d, i) => (
            <div
              key={"d" + i}
              className="tg-date"
              style={{ gridColumn: 1, gridRow: `${d.r} / span 1` }}
            >
              {d.t}
            </div>
          ))}

          {fills.map((t, i) => (
            <div
              key={"f" + i}
              className="tg-fill"
              style={{
                gridColumn: `${t.c + 1} / span ${t.w}`,
                gridRow: `${t.r} / span ${t.h}`,
                background: t.bg,
                ...cornerRadius(t.rd),
              }}
            />
          ))}

          {marks.map((t, i) => {
            const pos = {
              gridColumn: `${t.c + 1} / span ${t.w}`,
              gridRow: `${t.r} / span ${t.h}`,
            }
            if (t.k === "place") {
              return (
                <div key={"m" + i} className="tg-anchor tg-place" style={pos}>
                  <span>📍 {t.t}</span>
                </div>
              )
            }
            if (t.k === "battle") {
              // Decorative marker — no label/slug in the data, so no false
              // affordance (non-interactive, no pointer/hover).
              return (
                <div
                  key={"m" + i}
                  className="tg-anchor tg-battle"
                  style={pos}
                  aria-hidden="true"
                >
                  <span>💥</span>
                </div>
              )
            }
            // event
            const data = t.slug ? bySlug[t.slug] : null
            const heading = data && data.heading ? data.heading : t.t
            const clickable = !!t.slug
            const evStyle = {
              ...pos,
              background: t.bg,
              color: t.fg || textOn(t.bg),
              ...cornerRadius(t.rd),
            }
            const labelEl = <span className="tg-event-label">{replaceNumbers(heading)}</span>
            if (!clickable) {
              return (
                <div key={"m" + i} className="tg-anchor tg-event" style={evStyle}>
                  {labelEl}
                </div>
              )
            }
            return (
              <button
                key={"m" + i}
                type="button"
                ref={(n) => {
                  if (n) cellRefs.current[t.slug] = n
                }}
                className={
                  "tg-anchor tg-event is-clickable" +
                  (selected === t.slug ? " is-selected" : "")
                }
                style={evStyle}
                onClick={() => openInfo(t.slug)}
                aria-label={data && data.date ? `${heading}, ${data.date}` : heading}
                title={data && data.date ? `${heading} — ${data.date}` : heading}
              >
                {labelEl}
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
                  <h2 id="tg-infobox-title">{replaceNumbers(info.heading || selected)}</h2>
                  {info.date && <span className="tg-infobox-date">{info.date}</span>}
                </div>
                <div
                  className="tg-infobox-art"
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
