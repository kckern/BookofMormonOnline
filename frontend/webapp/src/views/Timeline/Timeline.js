/** @format */

import React, { useState, useEffect, useMemo, useRef } from "react"
import Parser from "html-react-parser"
import { Link, useRouteMatch } from "react-router-dom"
import { history } from "../../models/routeHistory"
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
  const match = useRouteMatch()
  const cellRefs = useRef({})

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

  // Deep link: /timeline/:markerSlug opens its info box and scrolls to it.
  useEffect(() => {
    const slug = match.params && match.params.markerSlug
    if (!slug || !timeline) return
    setSelected(slug)
    const node = cellRefs.current[slug]
    if (node) node.scrollIntoView({ block: "center", inline: "center" })
  }, [match.params, timeline])

  const openInfo = (slug) => {
    if (!slug) return
    setSelected(slug)
    history.push(`/timeline/${slug}`)
  }
  const closeInfo = () => {
    setSelected(null)
    history.push(`/timeline`)
  }

  // Modal a11y: Escape to close, and move focus into the dialog on open.
  const closeBtnRef = useRef(null)
  useEffect(() => {
    if (!selected) return
    const onKey = (e) => e.key === "Escape" && closeInfo()
    document.addEventListener("keydown", onKey)
    if (closeBtnRef.current) closeBtnRef.current.focus()
    return () => document.removeEventListener("keydown", onKey)
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!timeline) return <Loader />

  const { cols, rows, tiles, dateAxis = [] } = tilesData
  const info = selected ? bySlug[selected] : null

  // Column 1 is the sticky date gutter; content tiles are shifted +1 column.
  const fills = tiles.filter((t) => t.k === "fill")
  const marks = tiles.filter((t) => t.k !== "fill")

  return (
    <div className="timeline-grid-wrap">
      <div className="timeline-grid-scroller">
        <div
          className="timeline-grid"
          style={{ "--cols": cols, "--rows": rows }}
        >
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

      {info && (
        <div className="tg-infobox-backdrop" onClick={closeInfo}>
          <div
            className="tg-infobox"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tg-infobox-title"
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
          </div>
        </div>
      )}
    </div>
  )
}

export default TimeLine
