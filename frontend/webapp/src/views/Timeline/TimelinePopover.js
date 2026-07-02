/** @format */
import React from 'react'
import Parser from 'html-react-parser'
import { Link } from 'react-router-dom'
import { assetUrl } from 'src/models/BoMOnlineAPI'
import Loader from '../_Common/Loader'
import { cleanLabel } from './timelineModel'

// Anchored speech-bubble callout (replaces the centered modal on wide screens).
// Positioned by the parent in grid-content coordinates; the tail points at the
// anchor tile. Focus / Escape / URL behavior is owned by Timeline.js.
export default function TimelinePopover({ place, info, slug, loading, onClose, dialogRef, closeBtnRef }) {
  return (
    <div
      className={`tg-popover tg-popover-${place.side}`}
      style={{ left: place.left, top: place.top, '--tail-top': `${place.tailTop}px` }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tg-popover-title"
      ref={dialogRef}
    >
      <button className="tg-infobox-close" onClick={onClose} aria-label="Close" ref={closeBtnRef}>
        ×
      </button>
      {info ? (
        <>
          <div className="tg-infobox-head">
            <h2 id="tg-popover-title">{cleanLabel(info.heading) || slug}</h2>
            {info.date && <span className="tg-infobox-date">{info.date}</span>}
          </div>
          <div
            className="tg-infobox-art"
            role="img"
            aria-label={cleanLabel(info.heading) || slug}
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
          <h2 id="tg-popover-title">Loading…</h2>
          {loading && <Loader />}
        </div>
      )}
    </div>
  )
}
