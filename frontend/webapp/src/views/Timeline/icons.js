// frontend/webapp/src/views/Timeline/icons.js
/** @format */
// Inline SVG iconography for the Timeline. currentColor throughout so CSS themes
// them. NEVER use emoji for canvas iconography — emoji rendering varies per
// OS/browser (📍 renders as tofu in headless Chromium) and can't be themed.
import React from 'react'

export const SWORDS = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <line x1="6" y1="18" x2="18" y2="6" />
      <line x1="18" y1="18" x2="6" y2="6" />
    </g>
    <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <line x1="3.5" y1="13.5" x2="9" y2="19" />
      <line x1="15" y1="19" x2="20.5" y2="13.5" />
    </g>
  </svg>
)

export const PIN = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"
      fill="currentColor"
    />
    <circle cx="12" cy="9" r="2.6" fill="#f7efd9" />
  </svg>
)

// Ocean crossing (migration voyages) — hull + mast + sail, reads at 12px.
export const SHIP = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g fill="currentColor">
      <path d="M4 15h16l-2.4 4.2a1.5 1.5 0 0 1-1.3.8H7.7a1.5 1.5 0 0 1-1.3-.8L4 15z" />
      <path d="M12.8 4.5c3.2.9 5.4 3.6 5.9 6.8l.2 2.2h-6.1V4.5z" />
      <rect x="11" y="3.5" width="1.6" height="10.5" rx="0.8" />
    </g>
  </svg>
)

// Ruins / extinction (Desolation) — skull over crossbones, reads at 12px.
export const SKULL = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="5" y1="20" x2="19" y2="14" />
      <line x1="5" y1="14" x2="19" y2="20" />
    </g>
    <path
      d="M12 2.5c-3.7 0-6.5 2.7-6.5 6.2 0 2.1 1 3.9 2.6 5v2.1c0 .7.5 1.2 1.2 1.2h5.4c.7 0 1.2-.5 1.2-1.2v-2.1c1.6-1.1 2.6-2.9 2.6-5 0-3.5-2.8-6.2-6.5-6.2z"
      fill="currentColor"
    />
    <circle cx="9.4" cy="9" r="1.7" fill="#f7efd9" />
    <circle cx="14.6" cy="9" r="1.7" fill="#f7efd9" />
    <rect x="11.2" y="12.2" width="1.6" height="2.6" rx="0.8" fill="#f7efd9" />
  </svg>
)

// Unknown / disputed event — a question mark, matching the model's "?" glyph.
export const QUERY = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8.6 9.2a3.4 3.4 0 1 1 4.9 3.05c-.9.5-1.5 1-1.5 2.05v.7"
      fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="12" cy="18.4" r="1.5" fill="currentColor" />
  </svg>
)

export const CHEV_L = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M14.5 4 7 12l7.5 8" fill="none" stroke="currentColor" strokeWidth="3.2"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const CHEV_R = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M9.5 4 17 12l-7.5 8" fill="none" stroke="currentColor" strokeWidth="3.2"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
