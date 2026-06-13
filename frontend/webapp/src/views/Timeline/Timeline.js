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
  if (!rd || !rd.length) return undefined
  return {
    borderTopLeftRadius: rd.includes("tl") ? RADIUS : 0,
    borderTopRightRadius: rd.includes("tr") ? RADIUS : 0,
    borderBottomLeftRadius: rd.includes("bl") ? RADIUS : 0,
    borderBottomRightRadius: rd.includes("br") ? RADIUS : 0,
  }
}

function TimeLine() {
  useEffect(() => {
    document.title = label("menu_timeline") + " | " + label("home_title")
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

  if (!timeline) return <Loader />

  const { cols, rows, tiles } = tilesData
  const info = selected ? bySlug[selected] : null

  // Two visual layers in one CSS grid: fills (bands) first, then anchored
  // labels/icons (which overflow their tile) on top.
  const fills = tiles.filter((t) => t.k === "fill")
  const marks = tiles.filter((t) => t.k !== "fill")

  return (
    <div className="timeline-grid-wrap">
      <div className="timeline-grid-scroller">
        <div
          className="timeline-grid"
          style={{ "--cols": cols, "--rows": rows }}
        >
          {fills.map((t, i) => (
            <div
              key={"f" + i}
              className="tg-fill"
              style={{
                gridColumn: `${t.c} / span ${t.w}`,
                gridRow: `${t.r} / span ${t.h}`,
                background: t.bg,
                ...cornerRadius(t.rd),
              }}
            />
          ))}

          {marks.map((t, i) => {
            const pos = {
              gridColumn: `${t.c} / span ${t.w}`,
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
              return (
                <div
                  key={"m" + i}
                  className="tg-anchor tg-battle"
                  style={pos}
                  onClick={() => openInfo(t.slug)}
                  title={t.slug && bySlug[t.slug] ? bySlug[t.slug].heading : "Battle"}
                >
                  <span>💥</span>
                </div>
              )
            }
            // event
            const data = t.slug ? bySlug[t.slug] : null
            const heading = data && data.heading ? data.heading : t.t
            const clickable = !!t.slug
            return (
              <div
                key={"m" + i}
                ref={(n) => {
                  if (n && t.slug) cellRefs.current[t.slug] = n
                }}
                className={
                  "tg-anchor tg-event" +
                  (clickable ? " is-clickable" : "") +
                  (selected && selected === t.slug ? " is-selected" : "")
                }
                style={{
                  ...pos,
                  background: t.bg,
                  color: t.fg || textOn(t.bg),
                  ...cornerRadius(t.rd),
                }}
                onClick={() => clickable && openInfo(t.slug)}
                title={data && data.date ? `${heading} — ${data.date}` : heading}
              >
                <span className="tg-event-label">{replaceNumbers(heading)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {info && (
        <div className="tg-infobox-backdrop" onClick={closeInfo}>
          <div className="tg-infobox" onClick={(e) => e.stopPropagation()}>
            <button className="tg-infobox-close" onClick={closeInfo} aria-label="Close">
              ×
            </button>
            <div className="tg-infobox-head">
              <h2>{replaceNumbers(info.heading || selected)}</h2>
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
