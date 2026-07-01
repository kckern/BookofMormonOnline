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
